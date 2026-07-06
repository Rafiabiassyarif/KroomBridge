#!/usr/bin/env node
/**
 * KroomBridge GPU Agent (standalone, no dependencies)
 * ====================================================
 * Jalankan file ini DI PC yang punya GPU (PC Putih / PC Hitam).
 *
 * Cara pakai:
 *   1. Copy file ini ke PC Putih
 *   2. Edit konstanta CONFIG di bawah, atau set lewat env variable
 *   3. node gpu-agent.js
 *
 * Tidak butuh install dependency — pakai Node.js stdlib saja.
 */

const { exec } = require("child_process");
const http = require("http");
const https = require("https");
const { URL } = require("url");

// ─── KONFIGURASI ──────────────────────────────────────────
const CONFIG = {
  apiUrl: process.env.KROOMBRIDGE_API_URL || "http://127.0.0.1:3000",
  secret:
    process.env.GPU_REPORT_SECRET || "kroombridge_gpu_report_secret_GANTI_INI!",
  hostId: process.env.GPU_HOST_ID || "pc-putih",
  hostName: process.env.GPU_HOST_NAME || "PC Putih",
  intervalMs: parseInt(process.env.GPU_POLL_INTERVAL || "3000"),
};

// ─── BACA NVIDIA-SMI ──────────────────────────────────────
function pollGPU() {
  const cmd =
    "nvidia-smi --query-gpu=index,name,temperature.gpu,utilization.gpu," +
    "memory.used,memory.total,power.draw,power.limit,fan.speed," +
    "clocks.current.graphics --format=csv,noheader,nounits";

  exec(cmd, { timeout: 5000 }, (err, stdout) => {
    if (err) {
      logError(`nvidia-smi gagal: ${err.message}`);
      return;
    }

    const gpus = stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(",").map((v) => v.trim());
        const toN = (v) => {
          const n = parseFloat(
            String(v).replace("[N/A]", "0").replace("Not Supported", "0"),
          );
          return isFinite(n) ? n : 0;
        };
        return {
          index: toN(parts[0]),
          name: parts[1],
          temperature: toN(parts[2]),
          utilization: toN(parts[3]),
          memoryUsed: toN(parts[4]),
          memoryTotal: toN(parts[5]),
          powerDraw: toN(parts[6]),
          powerLimit: toN(parts[7]),
          fanSpeed: toN(parts[8]),
          clock: toN(parts[9]),
        };
      });

    if (gpus.length === 0) {
      logError("Tidak ada GPU terbaca dari nvidia-smi");
      return;
    }

    sendMetrics(aggregateGpus(gpus));
  });
}

// ─── AGREGASI multi-GPU ──────────────────────────────────
function aggregateGpus(gpus) {
  const count = gpus.length;
  const sumLoad = gpus.reduce((s, g) => s + g.utilization, 0);
  const sumVramUsed = gpus.reduce((s, g) => s + g.memoryUsed, 0);
  const sumVramTotal = gpus.reduce((s, g) => s + g.memoryTotal, 0);
  const maxTemp = Math.max(...gpus.map((g) => g.temperature));
  const sumPower = gpus.reduce((s, g) => s + g.powerDraw, 0);
  const sumFan = gpus.reduce((s, g) => s + g.fanSpeed, 0);
  const maxClock = Math.max(...gpus.map((g) => g.clock));

  return {
    hostId: CONFIG.hostId,
    hostName: CONFIG.hostName,
    gpuName: count > 1 ? `${count}× ${gpus[0].name}` : gpus[0].name,
    gpuLoad: Math.round(sumLoad / count),
    vramUsed: +(sumVramUsed / 1024).toFixed(2), // MiB → GB
    vramTotal: +(sumVramTotal / 1024).toFixed(2),
    temperature: Math.round(maxTemp),
    powerDraw: Math.round(sumPower),
    fanSpeed: Math.round(sumFan / count),
    clockMhz: Math.round(maxClock),
    agentVersion: "node-agent-1.0.0",
    gpuCount: count,
  };
}

// ─── KIRIM KE KROOMBRIDGE ────────────────────────────────
function sendMetrics(payload) {
  const url = new URL(`${CONFIG.apiUrl}/api/gpu/report`);
  const body = JSON.stringify(payload);
  const lib = url.protocol === "https:" ? https : http;

  const req = lib.request(
    {
      hostname: url.hostname,
      port: url.port || (url.protocol === "https:" ? 443 : 80),
      path: url.pathname,
      method: "POST",
      timeout: 6000,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "X-GPU-Secret": CONFIG.secret,
        "User-Agent": "KroomBridge-Node-Agent/1.0",
      },
    },
    (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          logOk(payload);
        } else {
          logError(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`);
        }
      });
    },
  );

  req.on("error", (err) => logError(`Network error: ${err.message}`));
  req.on("timeout", () => {
    req.destroy();
    logError("Request timeout (>6 dtk)");
  });
  req.write(body);
  req.end();
}

// ─── LOGGING ─────────────────────────────────────────────
function ts() {
  return new Date().toLocaleTimeString("id-ID", { hour12: false });
}

function logOk(p) {
  console.log(
    `[${ts()}] ✅ ${p.hostId}: ${p.gpuLoad}% load · ${p.vramUsed.toFixed(1)}/${p.vramTotal}GB VRAM · ${p.temperature}°C · ${p.powerDraw}W` +
      (p.gpuCount > 1 ? ` (${p.gpuCount} GPUs)` : ""),
  );
}

function logError(msg) {
  console.error(`[${ts()}] ❌ ${msg}`);
}

// ─── START ───────────────────────────────────────────────
console.log("=".repeat(60));
console.log("KroomBridge GPU Agent");
console.log("=".repeat(60));
console.log(`API URL    : ${CONFIG.apiUrl}`);
console.log(`Host ID    : ${CONFIG.hostId}`);
console.log(`Host Name  : ${CONFIG.hostName}`);
console.log(`Interval   : ${CONFIG.intervalMs}ms`);
console.log("=".repeat(60));

pollGPU();
setInterval(pollGPU, CONFIG.intervalMs);

process.on("SIGINT", () => {
  console.log("\nAgent dihentikan oleh user.");
  process.exit(0);
});
