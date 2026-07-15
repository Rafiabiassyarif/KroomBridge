// ============================================================
// GPU LOCAL POLLER — Baca nvidia-smi dari mesin yang sama
// ============================================================
// Jalankan child_process.exec ke `nvidia-smi` setiap N detik dan
// langsung simpan ke gpuMetrics store. Dipakai kalau server
// KroomBridge dijalankan di PC yang sama dengan GPU-nya
// (mis. PC Putih = server + GPU node).
//
// Konfigurasi via env:
//   GPU_LOCAL_ENABLED=true              (default: auto-deteksi)
//   GPU_LOCAL_HOST_ID=pc-putih          (default: pc-local)
//   GPU_LOCAL_HOST_NAME=PC Putih
//   GPU_LOCAL_POLL_INTERVAL_MS=3000

import { exec } from "child_process";
import { recordGpuMetric } from "./gpuMetrics.js";

const CONFIG = {
  enabled: process.env.GPU_LOCAL_ENABLED === "true",
  hostId: process.env.GPU_LOCAL_HOST_ID || "pc-local",
  hostName: process.env.GPU_LOCAL_HOST_NAME || "PC Local",
  intervalMs: parseInt(process.env.GPU_LOCAL_POLL_INTERVAL_MS || "3000"),
};

const NVSMI_CMD =
  "nvidia-smi --query-gpu=index,name,temperature.gpu,utilization.gpu," +
  "memory.used,memory.total,power.draw,power.limit,fan.speed," +
  "clocks.current.graphics --format=csv,noheader,nounits";

let interval: NodeJS.Timeout | null = null;
let consecutiveFailures = 0;

function toN(v: string): number {
  const cleaned = String(v).replace("[N/A]", "0").replace("Not Supported", "0");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

function pollGPU() {
  exec(NVSMI_CMD, { timeout: 5000 }, (err, stdout) => {
    if (err) {
      consecutiveFailures++;
      if (consecutiveFailures === 1 || consecutiveFailures % 20 === 0) {
        console.error(
          `[GPU Local] ❌ nvidia-smi gagal (${consecutiveFailures}×): ${err.message}`,
        );
      }
      return;
    }

    const lines = stdout.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return;

    const gpus = lines.map((line) => {
      const p = line.split(",").map((v) => v.trim());
      return {
        index: toN(p[0]),
        name: p[1],
        temperature: toN(p[2]),
        utilization: toN(p[3]),
        memoryUsed: toN(p[4]),
        memoryTotal: toN(p[5]),
        powerDraw: toN(p[6]),
        fanSpeed: toN(p[8]),
        clock: toN(p[9]),
      };
    });

    if (consecutiveFailures > 0) {
      console.log(
        `[GPU Local] ✅ Recovered after ${consecutiveFailures} failures`,
      );
      consecutiveFailures = 0;
    }

    const count = gpus.length;
    const sumLoad = gpus.reduce((s, g) => s + g.utilization, 0);
    const sumVramUsed = gpus.reduce((s, g) => s + g.memoryUsed, 0);
    const sumVramTotal = gpus.reduce((s, g) => s + g.memoryTotal, 0);
    const sumPower = gpus.reduce((s, g) => s + g.powerDraw, 0);
    const sumFan = gpus.reduce((s, g) => s + g.fanSpeed, 0);
    const maxTemp = Math.max(...gpus.map((g) => g.temperature));
    const maxClock = Math.max(...gpus.map((g) => g.clock));

    recordGpuMetric({
      hostId: CONFIG.hostId,
      hostName: CONFIG.hostName,
      gpuName: count > 1 ? `${count}× ${gpus[0].name}` : gpus[0].name,
      gpuLoad: Math.round(sumLoad / count),
      vramUsed: +(sumVramUsed / 1024).toFixed(2),
      vramTotal: +(sumVramTotal / 1024).toFixed(2),
      temperature: Math.round(maxTemp),
      powerDraw: Math.round(sumPower),
      fanSpeed: Math.round(sumFan / count),
      clockMhz: Math.round(maxClock),
      agentVersion: "local-poller-1.0.0",
    });
  });
}

export function startGpuLocalPoller() {
  if (!CONFIG.enabled) {
    console.log(
      "[GPU Local] ℹ️  GPU_LOCAL_ENABLED=false — local poller tidak aktif. " +
        "Set GPU_LOCAL_ENABLED=true di .env kalau server ini punya GPU NVIDIA.",
    );
    return;
  }

  if (interval) return;
  console.log(
    `[GPU Local] 🚀 Local poller aktif: ${CONFIG.hostId} (${CONFIG.hostName}) tiap ${CONFIG.intervalMs}ms`,
  );
  pollGPU();
  interval = setInterval(pollGPU, CONFIG.intervalMs);
}

export function stopGpuLocalPoller() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
