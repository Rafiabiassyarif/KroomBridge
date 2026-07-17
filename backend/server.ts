import "dotenv/config";
import express from "express";
import cors from "cors";

import path from "path";
import { fileURLToPath } from "url";

import { authRouter } from "./src/server/auth.js";
import { adminRouter } from "./src/server/admin.js";
import { gatewayRouter } from "./src/server/gateway.js";
import { integrationRouter } from "./src/server/integration.js";
import { db, initMySQL } from "./src/server/db.js";
import { broadcast } from "./src/server/eventBus.js";
import { gpuRouter } from "./src/server/gpuMetrics.js";
import { eventRouter } from "./src/server/eventBus.js";
import { startGpuSshPoller } from "./src/server/gpuSshPoller.js";
import { startGpuLocalPoller } from "./src/server/gpuLocalPoller.js";
import { setupCloudflareAccessTokens } from "./src/server/cloudflareToken.js";
import swaggerUi from "swagger-ui-express";
import YAML from "yamljs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type ProxyHistoryEntry = {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  timeMs: number;
  sizeBytes: number;
  size: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
  cookies: string[];
};

const proxyHistory: ProxyHistoryEntry[] = [];

const pushProxyHistory = (entry: ProxyHistoryEntry) => {
  proxyHistory.unshift(entry);
  if (proxyHistory.length > 50) proxyHistory.pop();
};

// ============================================================
// AUTO MONTHLY QUOTA RESET
// ============================================================
// AUTO MONTHLY QUOTA RESET
// ============================================================
function checkAndResetMonthlyQuota() {
  const meta = db.getMeta();
  const today = new Date();
  const todayDate = today.getDate();
  const currentMonth = today.toISOString().slice(0, 7); // YYYY-MM
  const resetMode = meta.quotaResetMode || "monthly";

  if (resetMode === "monthly") {
    // Mode "Awal Bulan": reset semua klien pada tanggal yang dipilih user di Settings.
    // Prioritas: meta.quotaResetDay (dari UI) > env QUOTA_RESET_DAY > 1.
    const resetDay =
      meta.quotaResetDay ?? parseInt(process.env.QUOTA_RESET_DAY || "1");

    // Reset jika hari ini sudah >= tanggal reset DAN belum direset bulan ini.
    // Pakai >= (bukan ===) supaya kalau server mati saat tanggal reset,
    // begitu nyala lagi langsung kejar reset bulan ini.
    if (todayDate >= resetDay && meta.lastQuotaReset !== currentMonth) {
      const count = db.resetMonthlyUsage();
      console.log(
        `[Scheduler] ✅ Kuota bulanan ${count} klien berhasil direset (${currentMonth}, mode: monthly, tanggal config: ${resetDay}, hari ini: ${todayDate})`,
      );
    }
  } else if (resetMode === "annual") {
    // Mode "Tahunan (Tanggal & Bulan)": reset semua klien pada tanggal & bulan yang dipilih.
    const resetDay = meta.quotaResetDay ?? 1;
    const resetMonth = meta.quotaResetMonth ?? 1; // 1-12
    const currentYear = String(today.getFullYear());
    const todayMonth = today.getMonth() + 1; // 1-12

    if (
      todayMonth === resetMonth &&
      todayDate >= resetDay &&
      meta.lastAnnualQuotaReset !== currentYear
    ) {
      const count = db.resetMonthlyUsage();
      db.updateMeta({ lastAnnualQuotaReset: currentYear });
      console.log(
        `[Scheduler] ✅ Kuota tahunan ${count} klien berhasil direset (Tahun ${currentYear}, mode: annual, config: ${resetDay}/${resetMonth}, hari ini: ${todayDate}/${todayMonth})`,
      );
    }
  } else if (resetMode === "purchase") {
    // Mode "Tanggal Pembelian": setiap klien direset pada tanggal sesuai createdAt-nya.
    const clients = db.getClients();
    let resetCount = 0;
    const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const daysInMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
    ).getDate();

    clients.forEach((client) => {
      if (!client.createdAt) return;
      const purchaseDate = new Date(client.createdAt).getDate();
      // Batasi tanggal reset sesuai hari maksimum di bulan ini (misal pembelian tgl 31, di Februari direset tgl 28/29)
      const targetResetDate = Math.min(purchaseDate, daysInMonth);
      const lastReset = client.lastReset || "";
      const expectedReset = `${yearMonth}-${String(targetResetDate).padStart(2, "0")}`;

      if (todayDate >= targetResetDate && lastReset !== expectedReset) {
        db.updateClient(client.id, {
          usageThisMonth: 0,
          quotaAlertSent: false,
          lastReset: expectedReset,
        });
        resetCount++;
      }
    });

    if (resetCount > 0) {
      console.log(
        `[Scheduler] ✅ Kuota ${resetCount} klien direset berdasarkan tanggal pembelian (${today.toDateString()})`,
      );
    }
  }
}

// Cek reset tiap 5 menit (lebih responsif dari 1 jam — kalau tanggal baru
// menit pertama, reset langsung jalan).
setInterval(checkAndResetMonthlyQuota, 5 * 60 * 1000);

// ============================================================
// MAIN SERVER
// ============================================================
async function startServer() {
  await initMySQL();
  checkAndResetMonthlyQuota(); // Cek saat startup (setelah MySQL ready)

  const app = express();
  const PORT = parseInt(process.env.PORT || "3000");
  const isDev = process.env.NODE_ENV !== "production";

  // ─── CORS ─────────────────────────────────────────────────
  const allowedOrigins = (
    process.env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:5173"
  )
    .split(",")
    .map((o) => o.trim());

  app.use(
    cors({
      origin: (origin, callback) => {
        // Izinkan request tanpa origin (curl, Postman, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
          return callback(null, true);
        }
        
        // Izinkan akses dari IP lokal / Tailscale
        if (origin.match(/^https?:\/\/(localhost|127\.0\.0\.1|100\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$/)) {
          return callback(null, true);
        }

        callback(new Error(`CORS: Origin '${origin}' tidak diizinkan.`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "webhook_secret",
        "x-webhook-secret",
        "x-forwarded-for",
      ],
    }),
  );

  // ─── Body Parsing ──────────────────────────────────────────
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ─── Request Logger (dev only) ────────────────────────────
  if (isDev) {
    app.use((req, res, next) => {
      // Daftar path yang akan disembunyikan log-nya agar terminal tidak "berisik"
      const silentPaths = [
        "dashboard-stats",
        "gpu",
        "timeseries",
        "clients",
        "packages",
        "users",
      ];
      const isSilentPath = silentPaths.some((path) => req.path.includes(path));

      const start = Date.now();
      res.on("finish", () => {
        // Hanya tampilkan log jika:
        // 1. Bukan path statistik rutin, ATAU
        // 2. Terjadi error (status code >= 400)
        if (!isSilentPath || res.statusCode >= 400) {
          const duration = Date.now() - start;
          const statusColor = res.statusCode >= 400 ? "\x1b[31m" : "\x1b[32m";
          console.log(
            `${statusColor}[${res.statusCode}]\x1b[0m ${req.method} ${req.path} — ${duration}ms`,
          );
        }
      });
      next();
    });
  }

  // ─── Health Check ─────────────────────────────────────────
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "Kroombox API Gateway",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "development",
    });
  });

  // ─── Public API Info ──────────────────────────────────────
  app.get("/api/info", (req, res) => {
    const packages = db.getPackages().map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      monthlyQuota: p.monthlyQuota,
      maxRequestsPerMinute: p.maxRequestsPerMinute,
      allowOverage: p.allowOverage,
    }));

    const routes = db
      .getRoutes()
      .filter((r) => r.isActive)
      .map((r) => ({
        path: r.path,
        description: r.description,
        method: r.method || "ALL",
      }));

    res.json({
      name: "Kroombox API Gateway",
      version: "1.0.0",
      description:
        "API Gateway untuk layanan WhatsApp, AI, dan lainnya dari Kroombox.",
      baseUrl: process.env.APP_URL || `http://localhost:${PORT}`,
      endpoints: {
        auth: {
          token: "POST /api/auth/token",
          refresh: "POST /api/auth/refresh",
          validate: "POST /api/auth/validate",
        },
        gateway: "ALL /gateway/*",
        admin: "POST /api/admin/login (then use token)",
        integration:
          "POST /api/integration/webhook/* (requires webhook_secret)",
      },
      availablePackages: packages,
      availableRoutes: routes,
      rateLimit: "Per paket (lihat availablePackages)",
    });
  });

  // ─── API Proxy for API Tester (Bypass CORS) ───────────────
  app.post("/api/proxy", async (req, res) => {
    const { method, url, headers, body, timeoutMs, followRedirects } = req.body;
    console.log("[PROXY] Incoming Headers:", headers);
    let targetUrl = url;
    if (targetUrl.includes("//localhost")) {
      targetUrl = targetUrl.replace("//localhost", "//127.0.0.1");
    }

    try {
      const startTime = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        Number(timeoutMs) || 10000,
      );
      const fetchOptions: RequestInit = {
        method: method || "GET",
        headers: headers || {},
        signal: controller.signal,
        redirect: followRedirects === false ? "manual" : "follow",
      };
      if (method !== "GET" && method !== "HEAD" && body) {
        fetchOptions.body =
          typeof body === "string" ? body : JSON.stringify(body);
      }

      const upstreamRes = await fetch(targetUrl, fetchOptions).finally(() =>
        clearTimeout(timeout),
      );
      const endTime = Date.now();

      if (req.headers["x-proxy-stream"] === "true") {
        const responseHeaders: Record<string, string> = {};
        upstreamRes.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        const headersToSet: any = {
          ...responseHeaders,
          "access-control-expose-headers": "*",
        };
        delete headersToSet["transfer-encoding"];
        delete headersToSet["content-encoding"];
        delete headersToSet["content-length"];

        res.writeHead(upstreamRes.status, headersToSet);

        // Log initiation
        const logData = {
          timestamp: new Date().toISOString(),
          clientId: "admin_tester",
          clientName: "API Tester (Stream)",
          routeId: "tester_proxy_stream",
          method: method || "GET",
          path: url,
          statusCode: upstreamRes.status,
          durationMs: endTime - startTime,
          ipAddress: (req.headers["x-forwarded-for"] || req.socket.remoteAddress) as string,
          userAgent: req.headers["user-agent"],
        };
        const entry = db.addLog(logData);
        broadcast({ type: "log:new", data: entry });

        if (upstreamRes.body) {
          // Node 18+ global fetch returns ReadableStream
          const reader = (upstreamRes.body as any as ReadableStream<Uint8Array>).getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        }
        return res.end();
      }

      const text = await upstreamRes.text();
      let data: any = text;
      try {
        data = JSON.parse(text);
      } catch (e) {}

      // Kalau response itu HTML dengan status 5xx, biasanya itu error page
      // dari Cloudflare/CDN/load-balancer. Parse jadi struktur yang readable
      // supaya user gak bingung lihat raw HTML di response panel.
      const looksLikeHtml =
        typeof data === "string" && /^\s*(<!DOCTYPE|<html|<HTML)/i.test(data);
      if (looksLikeHtml && upstreamRes.status >= 500) {
        const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
        const errCodeMatch = text.match(
          /(?:error\s*code|code-label[^>]*>)\s*[: ]?\s*(\d{3,4})/i,
        );
        const cfRayMatch = text.match(
          /Cloudflare\s+Ray\s+ID:[^<>]*<[^>]+>([\w-]+)</i,
        );
        const hostMatch = text.match(
          /<span class="md:block w-full truncate">([^<]+)<\/span>\s*<h3[^>]*>\s*<a[^>]*>\s*Cloudflare/i,
        );
        const originHostMatch = text.match(/utm_campaign=([\w.-]+)/);
        const isCloudflare =
          /cloudflare/i.test(text) || /cf-error|cf-wrapper/i.test(text);

        data = {
          error: titleMatch ? titleMatch[1].trim() : "Upstream HTML error",
          provider: isCloudflare ? "Cloudflare" : "Unknown CDN/Proxy",
          errorCode: errCodeMatch
            ? errCodeMatch[1]
            : String(upstreamRes.status),
          origin: originHostMatch ? originHostMatch[1] : undefined,
          cfRayId: cfRayMatch ? cfRayMatch[1] : undefined,
          hint:
            upstreamRes.status === 502
              ? "Origin server di balik domain target lagi mati / unreachable. Cek apakah server di-host pada domain itu masih hidup."
              : upstreamRes.status === 503
                ? "Origin server lagi sibuk atau maintenance."
                : upstreamRes.status === 504
                  ? "Origin timeout — server-nya lambat atau gak respon."
                  : "Cek dashboard Cloudflare untuk detail.",
          rawHtmlSize: text.length,
        };
      }

      const sizeBytes = Buffer.byteLength(text, "utf-8");
      const sizeFormatted =
        sizeBytes > 1024
          ? (sizeBytes / 1024).toFixed(2) + " KB"
          : sizeBytes + " B";

      const responseHeaders: Record<string, string> = {};
      upstreamRes.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const cookieHeader = upstreamRes.headers.get("set-cookie");
      const cookies = cookieHeader
        ? cookieHeader.split(/,(?=[^;]+?=)/).map((v) => v.trim())
        : [];

      const logData = {
        timestamp: new Date().toISOString(),
        clientId: "admin_tester",
        clientName: "API Tester",
        routeId: "tester_proxy",
        method: method || "GET",
        path: url,
        statusCode: upstreamRes.status,
        durationMs: endTime - startTime,
        ipAddress: (req.headers["x-forwarded-for"] ||
          req.socket.remoteAddress) as string,
        userAgent: req.headers["user-agent"],
      };

      const entry = db.addLog(logData);
      broadcast({ type: "log:new", data: entry });

      pushProxyHistory({
        id: entry.id,
        timestamp: logData.timestamp,
        method: logData.method,
        url,
        status: upstreamRes.status,
        timeMs: logData.durationMs,
        sizeBytes,
        size: sizeFormatted,
        requestHeaders: headers || {},
        responseHeaders,
        cookies,
      });

      res.json({
        status: upstreamRes.status,
        timeMs: endTime - startTime,
        time: endTime - startTime + " ms",
        size: sizeFormatted,
        headers: responseHeaders,
        cookies,
        data: data,
      });
    } catch (e: any) {
      const errLog = {
        timestamp: new Date().toISOString(),
        clientId: "admin_tester",
        clientName: "API Tester",
        routeId: "tester_proxy",
        method: method || "GET",
        path: url,
        statusCode: e?.name === "AbortError" ? 408 : 500,
        durationMs: 0,
        ipAddress: (req.headers["x-forwarded-for"] ||
          req.socket.remoteAddress) as string,
        userAgent: req.headers["user-agent"],
        error: e.message,
      };
      const entry = db.addLog(errLog);
      broadcast({ type: "log:new", data: entry });

      if (e?.name === "AbortError") {
        return res.json({
          status: 408,
          timeMs: 0,
          time: "0 ms",
          size: "0 B",
          headers: {},
          cookies: [],
          data: {
            error: "Request timeout",
            hint: "Naikkan timeout di Settings atau periksa URL.",
          },
        });
      }
      res.json({
        status: 500,
        timeMs: 0,
        time: "0 ms",
        size: "0 B",
        headers: {},
        cookies: [],
        data: { error: e.message || "Failed to fetch proxy" },
      });
    }
  });

  app.get("/api/proxy/history", (req, res) => {
    res.json(proxyHistory);
  });

  app.delete("/api/proxy/history", (req, res) => {
    proxyHistory.length = 0;
    res.json({ success: true });
  });

  // ─── API Routes ───────────────────────────────────────────
  // Swagger Documentation
  const swaggerDocument = YAML.load(path.join(__dirname, "src/server/swagger.yaml"));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/integration", integrationRouter);
  app.use("/api/gpu", gpuRouter);
  app.use("/api/events", eventRouter);
  app.use("/gateway", gatewayRouter);

  // ─── 404 Handler untuk /api/* ─────────────────────────────
  app.use("/api/*", (req, res) => {
    res.status(404).json({
      error: "Endpoint API tidak ditemukan.",
      path: req.path,
      method: req.method,
    });
  });

  // ─── Static Fallback ────────────────
  // Backend akan melayani file UI statis dari folder /frontend/dist jika ada.
  const distPath = path.join(__dirname, "..", "frontend", "dist");
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"), (err) => {
      if (err) {
        res.status(404).json({
          status: "API is running",
          message: "KroomBridge Backend is active, but Frontend UI (dist) is not found. Did you forget to build the frontend?",
        });
      }
    });
  });

  // ─── Global Error Handler ─────────────────────────────────
  app.use(
    (
      err: any,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      console.error("[Server Error]", err.message);

      if (err.message?.includes("CORS")) {
        return res.status(403).json({ error: err.message });
      }

      res.status(500).json({
        error: "Internal server error.",
        details: isDev ? err.message : undefined,
      });
    },
  );

  // ─── Start ────────────────────────────────────────────────
  app.listen(PORT, "0.0.0.0", () => {
    console.log("\n╔══════════════════════════════════════════════╗");
    console.log("║      Kroombox API Gateway — v1.0.0           ║");
    console.log("╠══════════════════════════════════════════════╣");
    console.log(`║  🚀 Server   : http://localhost:${PORT}         ║`);
    console.log(
      `║  🌍 Mode     : ${(process.env.NODE_ENV || "development").padEnd(28)}║`,
    );
    console.log(
      `║  📦 Packages : ${db.getPackages().length} paket terdaftar               ║`,
    );
    console.log(
      `║  👥 Clients  : ${db.getClients().length} klien terdaftar                ║`,
    );
    console.log(
      `║  🛣️  Routes   : ${db.getRoutes().length} route aktif                    ║`,
    );
    console.log("╚══════════════════════════════════════════════╝\n");

    // Setup Cloudflare Access tokens (auto-write ke cache cloudflared)
    // supaya tidak perlu manual `cloudflared access login` setiap kali.
    setupCloudflareAccessTokens();

    // Start GPU SSH poller setelah server siap.
    // Hosts dikonfigurasi via env GPU_SSH_HOSTS (lihat .env.example).
    startGpuSshPoller();

    // Start local GPU poller (kalau server ini sendiri punya GPU NVIDIA).
    // Diaktifkan via env GPU_LOCAL_ENABLED=true.
    startGpuLocalPoller();
  });
}

startServer().catch((err) => {
  console.error("[Fatal] Gagal menjalankan server:", err);
  process.exit(1);
});