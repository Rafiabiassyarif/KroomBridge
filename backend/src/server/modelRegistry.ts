// ============================================================
// MODEL REGISTRY — Daftar model yang tersedia di tiap upstream
// ============================================================
// Menyimpan daftar model dari:
//   • Kroma AI  (https://kroma.kroombox.com) — model "Kroma asli"
//   • 9r        (https://9r.kii.lat) — model LiteLLM (LM Studio / Ollama lokal)
//
// Gateway memakai registry ini untuk memutuskan jalur (routing):
//   model ada di Kroma  → target kroma.kroombox.com
//   model ada di 9r     → target 9r.kii.lat
//   tidak ketemu        → fallback ke 9r (default, karena mayoritas model)
//
// Registry di-refresh setiap 5 menit supaya model baru langsung
// kepakai tanpa restart server.

import { db } from "./db.js";

export const KROMA_API_URL =
  process.env.KROMA_API_URL || "https://kroma.kroombox.com";
export const NINER_API_URL = process.env.NINER_API_URL || "https://9r.kii.lat";

// Key upstream (dari env, jangan hardcode di kode!)
export const getKromaApiKey = () =>
  db.getMeta()?.apiKeys?.find((k: any) => k.provider === "kroma")?.key ||
  db.getMeta()?.kromaApiKey ||
  process.env.KROMA_API_KEY ||
  "";
export const getNinerApiKey = () =>
  process.env.NINER_API_KEY ||
  db.getMeta()?.ninerApiKey ||
  "";

// ─── Cache daftar model ────────────────────────────────────
let kromaModels: string[] = [];
let ninerModels: string[] = [];
let lastSyncAt = 0;
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 menit

function modelId(m: any): string {
  return m?.id || "";
}

/** Ambil daftar model dari satu upstream (OpenAI /v1/models). */
async function fetchModels(
  baseUrl: string,
  apiKey: string,
): Promise<string[]> {
  if (!apiKey) return [];
  try {
    const res = await fetch(`${baseUrl}/v1/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data || []).map(modelId).filter(Boolean);
  } catch {
    return [];
  }
}

/** Refresh cache daftar model kedua upstream. Idempotent. */
export async function refreshModelRegistry(): Promise<void> {
  const kromaKey = getKromaApiKey();
  const ninerKey = getNinerApiKey();

  const [kroma, niner] = await Promise.all([
    fetchModels(KROMA_API_URL, kromaKey),
    fetchModels(NINER_API_URL, ninerKey),
  ]);

  kromaModels = kroma;
  ninerModels = niner;
  lastSyncAt = Date.now();
  console.log(
    `[ModelRegistry] Sync: Kroma=${kromaModels.length} model, 9r=${ninerModels.length} model`,
  );
}

/** Pastikan registry terisi (panggil sekali saat gateway pertama dipakai). */
export async function ensureModelRegistry(): Promise<void> {
  if (kromaModels.length === 0 && ninerModels.length === 0) {
    await refreshModelRegistry();
  } else if (Date.now() - lastSyncAt > SYNC_INTERVAL_MS) {
    refreshModelRegistry().catch(() => {
      /* best-effort */
    });
  }
}

// ─── Normalisasi nama model ────────────────────────────────
// Beberapa klien mengirim prefix (oc/, pcp/, pc-putih/, test/, dll).
// Bersihkan supaya bisa dicocokkan dengan daftar model.
export function normalizeModelName(raw: string): string {
  let m = String(raw || "").trim();

  // Bersihkan prefix sembarangan dari aplikasi pihak ke-3 (misal 9router)
  if (m.includes("commandcode-go/")) m = m.slice(m.indexOf("commandcode-go/"));
  else if (m.includes("commandcode/")) m = m.slice(m.indexOf("commandcode/"));
  else if (m.includes("pcp/")) m = m.slice(m.indexOf("pcp/"));
  else if (m.includes("pc-putih/")) m = m.slice(m.indexOf("pc-putih/"));
  else if (m.includes("oc/")) m = m.slice(m.indexOf("oc/") + 3);
  else if (m.includes("/")) m = m.substring(m.indexOf("/") + 1); // fallback: buang prefix pertama

  return m;
}

// ─── Routing: tentukan upstream untuk sebuah model ─────────
export type RouteTarget = {
  url: string; // base URL upstream (tanpa trailing slash)
  is9r: boolean;
};

export function resolveRouteTarget(
  requestedModel: string,
): RouteTarget {
  const raw = String(requestedModel || "").trim();

  // Nama asli (untuk cocokkan daftar) + versi bersih (untuk fallback prefix)
  const clean = normalizeModelName(raw);

  // Model yang jelas milik Kroma (by prefix) → Kroma
  const kromaPrefixes = [
    "airforce/",
    "commandcode-go",
    "pchitam/",
    "pc-putih/",
    "pcp/",
  ];
  const isKromaByPrefix = kromaPrefixes.some((p) =>
    raw.toLowerCase().includes(p.toLowerCase()),
  );

  // Model yang jelas milik 9r (by prefix) → 9r
  // cmc/ = Model-model premium yang ada di 9r
  const ninerPrefixes = ["lmstudio/", "ollama-local/", "cmc/"];
  const is9rByPrefix = ninerPrefixes.some((p) =>
    raw.toLowerCase().startsWith(p.toLowerCase()),
  );

  // Cocokkan dengan daftar model yang pernah di-sync
  const inKromaList = kromaModels.some(
    (m) => m === raw || m === clean || m.endsWith("/" + clean),
  );
  const inNinerList = ninerModels.some(
    (m) => m === raw || m === clean || m.endsWith("/" + clean),
  );

  // Prioritas: daftar model > prefix > default
  if (inKromaList && !inNinerList) return { url: KROMA_API_URL, is9r: false };
  if (inNinerList && !inKromaList) return { url: NINER_API_URL, is9r: true };
  if (isKromaByPrefix && !is9rByPrefix)
    return { url: KROMA_API_URL, is9r: false };
  if (is9rByPrefix && !isKromaByPrefix) return { url: NINER_API_URL, is9r: true };

  // Default: 9r (mayoritas model ada di sana, dan kromaSync route nunjuk ke sana)
  return { url: NINER_API_URL, is9r: true };
}

/** Nama model yang dikirim ke upstream (dengan prefix provider untuk 9r/LiteLLM). */
export function rewriteModelForUpstream(
  model: string,
  target: RouteTarget,
): string {
  let m = String(model || "").trim();

  // Bersihkan prefix "sampah" dari aplikasi pihak ke-3 (9router dll),
  // TAPI pertahankan prefix provider yang valid (pchitam/, ollama-local/, lmstudio/, airforce/)
  const validPrefixes = [
    "pchitam/",
    "ollama-local/",
    "lmstudio/",
    "airforce/",
    "commandcode-go/",
    "commandcode/",
    "pcp/",
    "pc-putih/",
    "cmc/",
  ];
  const hasValidPrefix = validPrefixes.some((p) =>
    m.toLowerCase().startsWith(p.toLowerCase()),
  );
  if (!hasValidPrefix) {
    if (m.includes("oc/")) m = m.slice(m.indexOf("oc/") + 3);
    else if (m.includes("/")) m = m.substring(m.indexOf("/") + 1);
  } else if (m.includes("pcp/")) {
    m = m.slice(m.indexOf("pcp/"));
  } else if (m.includes("pc-putih/")) {
    m = m.slice(m.indexOf("pc-putih/"));
  }

  if (target.is9r) {
    // Untuk LiteLLM/9r: pastikan ada prefix provider (lmstudio/ atau ollama-local/)
    if (!m.includes("/")) {
      if (m.includes("gemma") || (m.includes("qwen") && m.includes(":"))) {
        m = "ollama-local/" + m;
      } else {
        m = "lmstudio/" + m;
      }
    }
  }
  // Untuk Kroma, kirim nama model apa adanya (dengan prefix pchitam/ dll).

  return m;
}

// ─── Helper untuk response /models ─────────────────────────
// Daftar model yang TERSEDIA (gabungan kedua upstream) untuk ditampilkan
// ke klien lewat endpoint /v1/models — hanya yang belum di-disable admin.
export function getAvailableModels(): string[] {
  const meta = db.getMeta();
  const disabled = meta.disabledModels || [];
  return [...new Set([...kromaModels, ...ninerModels])].filter(
    (m) => !disabled.some((d: string) => m === d || m.endsWith("/" + d)),
  );
}
