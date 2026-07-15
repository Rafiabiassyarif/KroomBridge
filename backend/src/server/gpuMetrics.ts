// ============================================================
// GPU METRICS — In-memory store untuk monitoring GPU realtime
// ============================================================
// PC Putih dan PC Hitam menjalankan agent Python yang mengirim
// metrik GPU (load, vram, temp, dll) tiap N detik via POST
// /api/gpu/report. Frontend dashboard fetch GET /api/admin/gpu
// untuk render kartu GPU monitor secara realtime.

import express, { Request, Response, NextFunction } from "express";
import { broadcast } from "./eventBus.js";

export interface GpuMetricSnapshot {
  hostId: string; // 'pc-putih' | 'pc-hitam' (atau identitas custom)
  hostName: string; // 'PC Putih', 'PC Hitam'
  status: "online" | "offline";
  gpuName?: string; // 'NVIDIA GeForce RTX 4090', dll
  gpuLoad: number; // 0–100 %
  vramUsed: number; // GB
  vramTotal: number; // GB
  temperature: number; // °C
  powerDraw: number; // Watt
  fanSpeed: number; // 0–100 %
  clockMhz?: number; // core clock

  // ── System metrics (CPU & RAM) ──
  cpuLoad?: number; // 0–100 %
  cpuCores?: number; // jumlah logical core
  cpuModel?: string; // mis. "Intel Xeon E5-2680"
  memUsed?: number; // GB
  memTotal?: number; // GB
  uptime?: number; // detik
  loadAvg1?: number; // load average 1 menit
  diskUsed?: number; // GB (root partition)
  diskTotal?: number; // GB

  receivedAt: string; // server timestamp (ISO)
  agentVersion?: string;
  meta?: Record<string, any>;
}

const STORE: Map<string, GpuMetricSnapshot> = new Map();
const HISTORY: Map<string, GpuMetricSnapshot[]> = new Map();
const HISTORY_LIMIT = 60; // simpan 60 sample terakhir per host
const OFFLINE_AFTER_MS = 30_000; // anggap offline jika tidak ada laporan > 30 dtk

// ─── PUBLIC API ────────────────────────────────────────────
export function recordGpuMetric(
  input: Partial<GpuMetricSnapshot> & { hostId: string },
) {
  const now = new Date().toISOString();
  const existing = STORE.get(input.hostId);

  const snapshot: GpuMetricSnapshot = {
    hostId: input.hostId,
    hostName: input.hostName ?? existing?.hostName ?? input.hostId,
    status: "online",
    gpuName: input.gpuName ?? existing?.gpuName,
    gpuLoad: input.gpuLoad !== undefined ? clamp(num(input.gpuLoad, 0), 0, 100) : (existing?.gpuLoad ?? 0),
    vramUsed: input.vramUsed !== undefined ? Math.max(0, num(input.vramUsed, 0)) : (existing?.vramUsed ?? 0),
    vramTotal: input.vramTotal !== undefined ? Math.max(0, num(input.vramTotal, existing?.vramTotal ?? 0)) : (existing?.vramTotal ?? 0),
    temperature: input.temperature !== undefined ? num(input.temperature, 0) : (existing?.temperature ?? 0),
    powerDraw: input.powerDraw !== undefined ? Math.max(0, num(input.powerDraw, 0)) : (existing?.powerDraw ?? 0),
    fanSpeed: input.fanSpeed !== undefined ? clamp(num(input.fanSpeed, 0), 0, 100) : (existing?.fanSpeed ?? 0),
    clockMhz: input.clockMhz !== undefined ? num(input.clockMhz, 0) : existing?.clockMhz,

    // ── System metrics ──
    cpuLoad: input.cpuLoad !== undefined ? clamp(num(input.cpuLoad, 0), 0, 100) : existing?.cpuLoad,
    cpuCores: input.cpuCores !== undefined ? input.cpuCores : existing?.cpuCores,
    cpuModel: input.cpuModel !== undefined ? input.cpuModel : existing?.cpuModel,
    memUsed: input.memUsed !== undefined ? Math.max(0, num(input.memUsed, 0)) : existing?.memUsed,
    memTotal: input.memTotal !== undefined ? Math.max(0, num(input.memTotal, 0)) : existing?.memTotal,
    uptime: input.uptime !== undefined ? input.uptime : existing?.uptime,
    loadAvg1: input.loadAvg1 !== undefined ? input.loadAvg1 : existing?.loadAvg1,
    diskUsed: input.diskUsed !== undefined ? input.diskUsed : existing?.diskUsed,
    diskTotal: input.diskTotal !== undefined ? input.diskTotal : existing?.diskTotal,

    receivedAt: now,
    agentVersion: input.agentVersion ?? existing?.agentVersion,
    meta: input.meta ? { ...(existing?.meta || {}), ...input.meta } : existing?.meta,
  };

  STORE.set(input.hostId, snapshot);

  // Simpan history (untuk sparkline / trend kalau dibutuhkan nanti)
  const hist = HISTORY.get(input.hostId) ?? [];
  hist.push(snapshot);
  if (hist.length > HISTORY_LIMIT) hist.shift();
  HISTORY.set(input.hostId, hist);

  // Broadcast ke semua dashboard yang subscribe
  try {
    broadcast({ type: "gpu:update", data: snapshot });
  } catch {
    /* fail silently */
  }

  return snapshot;
}

export function getAllGpuMetrics(): GpuMetricSnapshot[] {
  const now = Date.now();
  return Array.from(STORE.values()).map((s) => {
    const age = now - new Date(s.receivedAt).getTime();
    return { ...s, status: age > OFFLINE_AFTER_MS ? "offline" : "online" };
  });
}

export function getGpuHistory(hostId: string): GpuMetricSnapshot[] {
  return HISTORY.get(hostId) ?? [];
}

// ─── HELPERS ───────────────────────────────────────────────
function num(v: any, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && isFinite(n) ? n : fallback;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

// ─── ROUTER ────────────────────────────────────────────────
// Mount di server.ts: app.use('/api/gpu', gpuRouter)

export const gpuRouter = express.Router();

const REPORT_SECRET =
  process.env.GPU_REPORT_SECRET ||
  process.env.WEBHOOK_SECRET ||
  "kroombridge_internal_secret";

const verifyReportSecret = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const provided =
    req.headers["x-gpu-secret"] ||
    req.headers["x-webhook-secret"] ||
    req.headers["webhook_secret"] ||
    (typeof req.headers["authorization"] === "string"
      ? req.headers["authorization"].replace(/^Bearer\s+/i, "")
      : undefined);

  if (!provided || provided !== REPORT_SECRET) {
    return res.status(401).json({
      error: "Secret GPU report tidak valid.",
      hint: "Kirim header 'X-GPU-Secret: <GPU_REPORT_SECRET>'",
    });
  }
  next();
};

// POST /api/gpu/report — dipanggil agent dari PC Putih / PC Hitam
gpuRouter.post("/report", verifyReportSecret, (req: Request, res: Response) => {
  const body = req.body;

  if (!body || !body.hostId) {
    return res.status(400).json({ error: "Field 'hostId' wajib diisi" });
  }

  const snapshot = recordGpuMetric(body);
  res.json({ ok: true, snapshot });
});

// GET /api/gpu/health — buat agent cek konektivitas (no auth)
gpuRouter.get("/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), hosts: STORE.size });
});
