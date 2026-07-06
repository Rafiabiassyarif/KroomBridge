// ============================================================
// CLOUDFLARE ACCESS TOKEN — Auto-save ke cache cloudflared
// ============================================================
// Daripada user harus jalankan `cloudflared access login` manual,
// kita simpan JWT token langsung ke cache file yang dicari cloudflared.
//
// Format cache cloudflared (DUA format yang valid tergantung versi):
//   • Lama:  ~/.cloudflared/<hostname-with-dashes>.token
//            mis. ssh-kii-lat.token
//   • Baru:  ~/.cloudflared/<hostname>-<audience-hash>-token  (TANPA .token)
//            mis. ssh.kii.lat-1f1e74a68eba8c79ae...token
//   cloudflared v2025+ pakai format baru.
//
// Konfigurasi di .env:
//   CF_ACCESS_TOKEN_<HOSTNAME>=<jwt-token>
// Contoh:
//   CF_ACCESS_TOKEN_ssh_kii_lat=eyJhbGciOiJSUzI1NiIs...
//
// Strategi:
// 1. Scan ~/.cloudflared/ untuk SEMUA file cache yang match hostname
//    (kedua format).
// 2. Kalau salah satu cache masih valid DAN lebih baru/sama dengan
//    token di .env → SKIP (user mungkin baru login).
// 3. Kalau semua cache basi → tulis token .env ke kedua format file
//    biar versi cloudflared mana saja bisa pakai.
// 4. Kalau token .env sendiri sudah basi → warning, jangan overwrite.

import {
  writeFileSync,
  mkdirSync,
  existsSync,
  readFileSync,
  readdirSync,
} from "fs";
import { homedir } from "os";
import { join } from "path";

function getCloudflaredDir(): string {
  return join(homedir(), ".cloudflared");
}

/** Path file cache format LAMA: ssh-kii-lat.token */
function getLegacyTokenPath(hostname: string): string {
  const filename = hostname.replace(/\./g, "-").replace(/_/g, "-") + ".token";
  return join(getCloudflaredDir(), filename);
}

/**
 * Cari semua file cache cloudflared untuk hostname tertentu.
 * Match BAIK format lama (`ssh-kii-lat.token`) maupun baru
 * (`ssh.kii.lat-<hash>-token` tanpa ekstensi `.token`).
 */
function findExistingCacheFiles(hostname: string): string[] {
  const dir = getCloudflaredDir();
  if (!existsSync(dir)) return [];

  const dashed = hostname.replace(/\./g, "-").replace(/_/g, "-");
  const matches: string[] = [];

  try {
    for (const f of readdirSync(dir)) {
      // Format lama persis: <dashed>.token
      if (f === `${dashed}.token`) {
        matches.push(join(dir, f));
        continue;
      }
      // Format baru: <hostname>-<aud-hash>-token
      // Pakai hostname yang masih ada titiknya (tidak di-dashify)
      if (
        f.startsWith(`${hostname}-`) &&
        (f.endsWith("-token") || f.endsWith(".token"))
      ) {
        matches.push(join(dir, f));
      }
    }
  } catch {
    /* ignore */
  }

  return matches;
}

/** Decode payload JWT atau null kalau gagal. */
function decodeJwt(token: string): { exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function isTokenStillValid(token: string): boolean {
  const p = decodeJwt(token);
  if (!p) return false;
  if (typeof p.exp !== "number") return true;
  return p.exp * 1000 > Date.now();
}

function getTokenExp(token: string): number {
  const p = decodeJwt(token);
  if (!p || typeof p.exp !== "number") return 0;
  return p.exp * 1000;
}

/**
 * Setup token Cloudflare Access untuk semua hostname yang ada di .env.
 * Idempotent — aman dipanggil berkali-kali.
 */
export function setupCloudflareAccessTokens() {
  const cfDir = getCloudflaredDir();

  // Kumpulkan semua env var dengan prefix CF_ACCESS_TOKEN_
  const tokens: Array<{ hostname: string; token: string }> = [];
  for (const key of Object.keys(process.env)) {
    if (!key.startsWith("CF_ACCESS_TOKEN_")) continue;
    const hostnameRaw = key.slice("CF_ACCESS_TOKEN_".length);
    // Convert underscore-style ke hostname format: "ssh_kii_lat" → "ssh.kii.lat"
    const hostname = hostnameRaw.replace(/_/g, ".");
    const token = process.env[key]?.trim();
    if (!token) continue;
    tokens.push({ hostname, token });
  }

  if (tokens.length === 0) return;

  try {
    if (!existsSync(cfDir)) {
      mkdirSync(cfDir, { recursive: true });
    }
  } catch (err: any) {
    console.error(
      `[CF Token] ❌ Tidak bisa buat folder ${cfDir}: ${err.message}`,
    );
    return;
  }

  for (const { hostname, token } of tokens) {
    const envExp = getTokenExp(token);
    const envValid = envExp > Date.now();

    // Cek semua cache yang ada — pilih yang paling baru.
    const cacheFiles = findExistingCacheFiles(hostname);
    let bestCacheExp = 0;
    for (const f of cacheFiles) {
      try {
        const existing = readFileSync(f, "utf-8").trim();
        const exp = getTokenExp(existing);
        if (exp > bestCacheExp) bestCacheExp = exp;
      } catch {
        /* ignore */
      }
    }

    // Kalau cache LEBIH BARU dari token .env → user kemungkinan baru
    // `cloudflared access login`. Skip untuk hindari overwrite token
    // baru dengan token basi dari .env.
    if (bestCacheExp > 0 && bestCacheExp >= envExp) {
      const expDate = new Date(bestCacheExp).toISOString();
      console.log(
        `[CF Token] ℹ️  Cache cloudflared untuk '${hostname}' valid sampai ${expDate}. Skip overwrite.`,
      );
      if (!envValid) {
        console.log(
          `[CF Token] 💡 Tip: token di .env sudah basi. Update CF_ACCESS_TOKEN_${hostname.replace(/\./g, "_")} ` +
            `dengan token cache, atau jalankan: node scripts/sync-cf-token.cjs ${hostname}`,
        );
      }
      continue;
    }

    // Tidak ada cache valid → kalau token .env basi, kasih warning.
    if (!envValid) {
      console.warn(
        `[CF Token] ⚠️  Token '${hostname}' di .env basi DAN tidak ada cache valid. ` +
          `Login ulang: cloudflared access login ${hostname}`,
      );
      continue;
    }

    // Token .env valid dan cache basi/kosong → tulis ke kedua format
    // supaya cloudflared versi mana saja bisa pakai.
    const legacyPath = getLegacyTokenPath(hostname);
    try {
      writeFileSync(legacyPath, token, { encoding: "utf-8", mode: 0o600 });
      console.log(`[CF Token] ✅ Token '${hostname}' di-save ke ${legacyPath}`);
    } catch (err: any) {
      console.error(
        `[CF Token] ❌ Gagal save token '${hostname}' (legacy): ${err.message}`,
      );
    }
  }
}
