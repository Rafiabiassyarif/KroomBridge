import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db.js";
import { broadcast } from "./eventBus.js";

const JWT_SECRET = process.env.JWT_SECRET || "kroombox_super_secret_key_123!";

function estimateTokens(data: any): number {
  if (typeof data === "string") {
    return Math.ceil(data.length / 4);
  }
  if (typeof data === "object" && data !== null) {
    try {
      return Math.ceil(JSON.stringify(data).length / 4);
    } catch {
      return 10;
    }
  }
  return 0;
}

// ─── In-memory Rate Limiter ────────────────────────────────
// Map: clientId → { count, resetAt }
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Bersihkan map setiap 5 menit agar tidak memory leak
setInterval(
  () => {
    const now = Date.now();
    for (const [key, val] of rateLimitMap.entries()) {
      if (now > val.resetAt + 60000) rateLimitMap.delete(key);
    }
  },
  5 * 60 * 1000,
);

// ─── Anomaly Detection ────────────────────────────────────
// Map: clientId → requestsInLastSecond
const anomalyMap = new Map<string, { count: number; resetAt: number }>();

// ============================================================
// GATEWAY MIDDLEWARE
// ============================================================
export const gatewayMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const security = db.getSecurity();
  const clientIp =
    req.headers["x-forwarded-for"] ||
    req.headers["x-real-ip"] ||
    req.socket.remoteAddress ||
    "";
  const ipStr = (Array.isArray(clientIp) ? clientIp[0] : String(clientIp))
    .split(",")[0]
    .trim();

  // ── 1. Cek HTTPS (jika diaktifkan) ──
  if (security.requireHttps) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    if (proto !== "https") {
      return res
        .status(403)
        .json({ error: "HTTPS wajib digunakan untuk mengakses gateway ini." });
    }
  }

  // ── 2. Cek IP Denylist ──
  const deniedEntry = security.ipDenylist.find(
    (d) => ipStr === d.ip || ipStr.includes(d.ip) || d.ip.includes(ipStr),
  );
  if (deniedEntry) {
    return res.status(403).json({
      error: "IP Address Anda telah diblokir dari akses gateway ini.",
      reason: deniedEntry.reason,
    });
  }

  // ── 3. Cek IP Allowlist (jika ada isinya) ──
  if (security.ipAllowlist.length > 0) {
    const isAllowed = security.ipAllowlist.some(
      (a) => ipStr === a.ip || ipStr.includes(a.ip) || a.ip.includes(ipStr),
    );
    if (!isAllowed) {
      return res.status(403).json({
        error: "IP Address Anda tidak terdaftar dalam allowlist gateway.",
        yourIp: ipStr,
      });
    }
  }

  // ── 4. Verifikasi API Key atau JWT Access Token ──
  const authHeader = req.headers.authorization;
  const xApiKey = req.headers["x-api-key"] || req.headers["api-key"];
  
  let token = "";
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (typeof xApiKey === "string") {
    token = xApiKey;
  }

  if (!token) {
    return res.status(401).json({
      error: "Kredensial otorisasi hilang atau format salah.",
      hint: "Gunakan header: 'Authorization: Bearer <api_key>' ATAU 'x-api-key: <api_key>'",
    });
  }

  let client = db.getClientBySecretKey(token);

  if (!client) {
    // Fallback: coba verifikasi sebagai JWT (Backward Compatibility)
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      client = db.getClient(decoded.clientId);
      
      if (client) {
        // Reject token kalau secret key udah di-rotasi setelah token issued.
        const currentKeyVersion = client.keyVersion ?? 1;
        if ((decoded.keyVersion ?? 1) < currentKeyVersion) {
          return res.status(401).json({
            error: "Access token sudah dicabut karena Secret Key di-rotasi.",
            hint: "Gunakan API Key Anda secara langsung.",
          });
        }
      }
    } catch (err: any) {
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          error: "Access token JWT sudah kedaluwarsa.",
          hint: "Gunakan API Key Anda secara langsung (tanpa perlu JWT).",
        });
      }
      return res.status(401).json({ error: "API Key atau Token tidak valid" });
    }
  }

  if (!client) {
    return res.status(403).json({ error: "Klien tidak ditemukan dalam sistem." });
  }

  if (!client.isActive) {
    return res.status(403).json({
      error: "Akun klien Anda ditangguhkan. Hubungi admin untuk bantuan.",
    });
  }

  const clientId = client.id;
  const pkg = db.getPackage(client.packageId);
  if (!pkg) {
    return res
      .status(500)
      .json({ error: "Paket langganan klien tidak valid. Hubungi admin." });
  }

  // ── 5. Cek Kuota Bulanan ──
    const activeQuota =
      client.customQuota != null ? client.customQuota : pkg.monthlyQuota;
    if (client.usageThisMonth >= activeQuota) {
      if (!pkg.allowOverage) {
        return res.status(429).json({
          error: "Kuota bulanan Anda sudah habis.",
          hint: "Silakan hubungi admin untuk upgrade paket atau topup kuota.",
          usage: client.usageThisMonth,
          quota: activeQuota,
        });
      }
      // Overage diizinkan, lanjut dengan info peringatan
      res.setHeader("X-Quota-Status", "overage");
    }

    // ── 6. Rate Limit per Menit ──
    const now = Date.now();
    let limitData = rateLimitMap.get(clientId);

    if (!limitData || now > limitData.resetAt) {
      limitData = { count: 0, resetAt: now + 60 * 1000 };
    }

    if (limitData.count >= pkg.maxRequestsPerMinute) {
      const retryAfter = Math.ceil((limitData.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      res.setHeader("X-RateLimit-Limit", String(pkg.maxRequestsPerMinute));
      res.setHeader("X-RateLimit-Remaining", "0");
      return res.status(429).json({
        error: "Terlalu banyak permintaan. Rate limit terlampaui.",
        limit: pkg.maxRequestsPerMinute,
        retry_after_seconds: retryAfter,
      });
    }

    // ── 7. Anomaly Detection (lebih dari 10x per detik) ──
    if (security.rateLimitAnomalyDetection) {
      let anomaly = anomalyMap.get(clientId);
      if (!anomaly || now > anomaly.resetAt) {
        anomaly = { count: 0, resetAt: now + 1000 };
      }
      anomaly.count++;
      anomalyMap.set(clientId, anomaly);

      if (anomaly.count > 20) {
        console.warn(
          `[ANOMALY] Klien ${clientId} (IP: ${ipStr}) membuat ${anomaly.count} permintaan dalam 1 detik. Memblokir IP otomatis...`,
        );
        
        // Blokir IP otomatis
        db.addToIpDenylist(ipStr, `Otomatis diblokir: Anomali Rate Limit (${anomaly.count} req/dtk) dari klien ${clientId}`);
        broadcast({ type: "security:change", data: null });
        
        return res.status(403).json({
          error: "Akses diblokir otomatis karena aktivitas anomali berlebih. IP Anda telah dimasukkan ke Denylist.",
        });
      }
    }

    // ── 8. Cek Akses Endpoint (Permission) ──
    const requestedPath = req.baseUrl + req.path;
    const hasAccess = pkg.allowedEndpoints.some(
      (ep) =>
        ep === "*" || requestedPath === ep || requestedPath.startsWith(ep),
    );
    if (!hasAccess) {
      return res.status(403).json({
        error: `Paket Anda (${pkg.name}) tidak memiliki akses ke endpoint ${requestedPath}.`,
        allowedEndpoints: pkg.allowedEndpoints,
        hint: "Upgrade paket untuk akses lebih luas.",
      });
    }

    // ── Increment & Inject ──
    limitData.count += 1;
    rateLimitMap.set(clientId, limitData);

    // Set headers informatif
    res.setHeader("X-RateLimit-Limit", String(pkg.maxRequestsPerMinute));
    res.setHeader(
      "X-RateLimit-Remaining",
      String(pkg.maxRequestsPerMinute - limitData.count),
    );
    res.setHeader(
      "X-RateLimit-Reset",
      String(Math.ceil(limitData.resetAt / 1000)),
    );
    res.setHeader("X-Client-Id", clientId);
    res.setHeader("X-Package", pkg.name);

    (req as any).kroomboxClientId = clientId;
    (req as any).kroomboxClientIp = ipStr;
    (req as any).kroomboxPackage = pkg;

    next();
};

// ============================================================
// SMART MODEL MAPPING
// ============================================================
// Cache in-memory untuk menyimpan mapping (e.g. qwen3.5-9b -> pc-putih/lmstudio/qwen3.5-9b)
let modelMappingCache: Record<string, string> = {};
let lastModelSync = 0;

async function getFullModelName(shortName: string): Promise<string> {
  // Jika nama model sudah memiliki garis miring, asumsikan itu sudah nama lengkap
  if (shortName.includes("/")) return shortName;

  // Gunakan cache jika masih baru (kurang dari 1 jam)
  if (modelMappingCache[shortName] && Date.now() - lastModelSync < 3600000) {
    return modelMappingCache[shortName];
  }

  try {
    const meta = db.getMeta();
    const apiKey = meta.apiKeys?.find(k => k.provider === 'kroma')?.key || meta.kromaApiKey || process.env.KROMA_API_KEY;
    const KROMA_API_URL = process.env.KROMA_API_URL || "https://kroma.kroombox.com";
    
    if (apiKey) {
      // Mengambil dari /v1/providers/ karena Kroma AI menyediakan list model disana
      const res = await fetch(`${KROMA_API_URL}/v1/providers/`, {
        headers: { "Authorization": `Bearer ${apiKey}`, "x-api-key": apiKey }
      });
      
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
          modelMappingCache = {};
          
          json.data.forEach((provider: any) => {
            const modelsList = provider.models || [];
            modelsList.forEach((fullModelName: string) => {
              const stripped = fullModelName.split("/").pop();
              if (stripped) {
                modelMappingCache[stripped] = fullModelName;
              }
            });
          });
          
          lastModelSync = Date.now();
          return modelMappingCache[shortName] || shortName;
        }
      }
    }
  } catch (err: any) {
    console.error("[SmartMapping] Gagal melakukan sinkronisasi model:", err.message);
  }
  return shortName;
}

// ============================================================
// GATEWAY ROUTER
// ============================================================
export const gatewayRouter = express.Router();

// Terapkan middleware ke semua route di bawah /gateway
gatewayRouter.use(gatewayMiddleware);

// ── Proxy Handler ──────────────────────────────────────────
gatewayRouter.use(async (req: Request, res: Response) => {
  const startTime = Date.now();
  const clientId: string = (req as any).kroomboxClientId;
  const clientIp: string = (req as any).kroomboxClientIp;
  const pkg = (req as any).kroomboxPackage;

  const activeRoutes = db.getRoutes().filter((r) => r.isActive);

  const fullPath = req.baseUrl + req.path;

  // Cari route yang cocok (paling spesifik diprioritaskan)
  const matchedRoute = activeRoutes
    .filter(
      (r) =>
        fullPath === r.path ||
        fullPath.startsWith(r.path + "/") ||
        fullPath.startsWith(r.path),
    )
    .sort((a, b) => b.path.length - a.path.length)[0];

  // ── Smart Model Mapping ──
  if (req.body?.model && typeof req.body.model === "string") {
    req.body.model = await getFullModelName(req.body.model);
  }

  // ── Cek Model yang Dinonaktifkan ──
  if (req.body?.model) {
    const meta = db.getMeta();
    const disabledModels = meta.disabledModels || [];
    if (disabledModels.includes(req.body.model)) {
      return res.status(403).json({
        error: "Model ini sedang dinonaktifkan oleh Administrator.",
      });
    }
  }

  // ── Calculate Model Multiplier ──
  let modelMultiplier = 1.0;
  
  // Ambil nama model dari request body jika ada, kalau tidak fallback ke deskripsi route
  const requestModel = req.body?.model;
  const modelStringToParse = typeof requestModel === "string" ? requestModel : matchedRoute?.description;

  if (modelStringToParse) {
    const desc = modelStringToParse.toLowerCase();
    
    // Evaluasi open-source models terlebih dahulu agar model 'distilled' 
    // (misal: qwen3.6-35b-claude-opus-distilled) tidak tertukar harganya menjadi mahal.
    if (desc.includes("qwen")) {
      modelMultiplier = 0.8;
    } else if (desc.includes("llama")) {
      modelMultiplier = 0.75;
    } else if (desc.includes("kimi") || desc.includes("moonshot") || desc.includes("minimax")) {
      modelMultiplier = 0.95;
    } else if (desc.includes("deepseek")) {
      modelMultiplier = 1.2;
    } else if (desc.includes("nemotron")) {
      modelMultiplier = 1.0;
    } else if (desc.includes("gemini")) {
      if (desc.includes("flash")) modelMultiplier = 1.5;
      else if (desc.includes("pro")) modelMultiplier = 3.0;
      else modelMultiplier = 1.5;
    } else if (desc.includes("claude")) {
      if (desc.includes("opus")) modelMultiplier = 5.0; // Diturunkan dari 16.5 agar tidak cepat habis
      else if (desc.includes("sonnet")) modelMultiplier = 3.5;
      else if (desc.includes("haiku")) modelMultiplier = 0.5;
      else modelMultiplier = 3.5;
    } else if (desc.includes("gpt")) {
      if (desc.includes("mini")) modelMultiplier = 0.3;
      else modelMultiplier = 5.5;
    }
  }

  const logRequest = (statusCode: number, error?: string) => {
    const client = db.getClient(clientId);
    const entry = {
      timestamp: new Date().toISOString(),
      clientId: clientId || "unknown",
      clientName: client?.name,
      routeId: matchedRoute?.id || "unknown",
      method: req.method,
      path: fullPath,
      statusCode,
      durationMs: Date.now() - startTime,
      ipAddress: clientIp,
      userAgent: req.headers["user-agent"],
      error,
    };
    db.addLog(entry);
    // Push event realtime ke dashboard yang subscribe SSE
    try {
      broadcast({ type: "log:new", data: entry });
    } catch {
      /* fail silently — event bus is best-effort */
    }
  };

  if (!matchedRoute) {
    logRequest(404, "Route tidak ditemukan");
    return res.status(404).json({
      error: "Endpoint tidak ditemukan di API Gateway.",
      requested: fullPath,
      availableRoutes: activeRoutes.map((r) => r.path),
    });
  }

  // Cek method jika route punya filter method
  if (matchedRoute.method && matchedRoute.method !== "ALL") {
    if (req.method !== matchedRoute.method) {
      logRequest(405, "Method tidak diizinkan");
      return res.status(405).json({
        error: `Method ${req.method} tidak diizinkan untuk route ini. Gunakan ${matchedRoute.method}.`,
      });
    }
  }

  // ── Increment Usage ──
  // Hanya dihitung kalau response sukses 2xx.

  // ── Upstream Validation Shield ──
  const security = db.getSecurity();
  if (security.upstreamValidationShield) {
    // Cek ukuran body
    const bodyStr = JSON.stringify(req.body);
    const bodySizeKb = Buffer.byteLength(bodyStr, "utf-8") / 1024;
    const maxKb = security.maxBodySizeKb || 512;
    if (bodySizeKb > maxKb) {
      logRequest(413, "Body terlalu besar");
      return res.status(413).json({
        error: `Ukuran request body (${bodySizeKb.toFixed(1)}KB) melebihi batas ${maxKb}KB.`,
      });
    }
  }

  try {
    // ── Bangun Target URL ──
    const routePathLen = matchedRoute.path.length;
    const remainder = fullPath.slice(routePathLen);
    const queryString =
      Object.keys(req.query).length > 0
        ? "?" + new URLSearchParams(req.query as any).toString()
        : "";

    let targetUrl: string;
    try {
      const base = matchedRoute.upstreamUrl.replace(/\/$/, "");
      targetUrl = `${base}${remainder}${queryString}`;
    } catch {
      targetUrl = `${matchedRoute.upstreamUrl}${remainder}${queryString}`;
    }

    const meta = db.getMeta();
    const customUpstreamKey = req.headers["x-custom-upstream-key"] as string;
    console.log("[GATEWAY] matchedRoute:", matchedRoute?.path, "customUpstreamKey:", customUpstreamKey);
    const kromaApiKey = customUpstreamKey || meta.apiKeys?.find(k => k.provider === 'kroma')?.key || meta.kromaApiKey || process.env.KROMA_API_KEY;
    const KROMA_API_URL = process.env.KROMA_API_URL || "https://kroma.kroombox.com";

    // ── Build Request Headers ──
    const upstreamHeaders: Record<string, string> = {
      "Content-Type": req.headers["content-type"] || "application/json",
      "X-Forwarded-For": clientIp,
      "X-Client-Id": clientId,
      "X-Gateway": "KroomBridge-API-Gateway/2.0",
      // Teruskan custom headers dari konfigurasi route
      ...(matchedRoute.headers || {}),
    };

    if (matchedRoute.upstreamUrl.startsWith(KROMA_API_URL) && kromaApiKey) {
      upstreamHeaders["Authorization"] = `Bearer ${kromaApiKey}`;
      upstreamHeaders["x-api-key"] = kromaApiKey;
    }

    // Jangan teruskan Authorization header dari klien ke upstream
    // (upstream punya auth tersendiri)

    // ── Transform Request Body ──
    let processedBody = req.body;
    if (
      matchedRoute.transformations?.requestBodyMap &&
      typeof processedBody === "object" &&
      processedBody !== null
    ) {
      const mappedBody: Record<string, any> = {};
      const map = matchedRoute.transformations.requestBodyMap;
      for (const key in processedBody) {
        const newKey = map[key] || key;
        mappedBody[newKey] = processedBody[key];
      }
      processedBody = mappedBody;
    }

    // ── Override Request Body Fields ──
    if (
      matchedRoute.transformations?.requestBodyOverride &&
      typeof processedBody === "object" &&
      processedBody !== null
    ) {
      processedBody = {
        ...processedBody,
        ...matchedRoute.transformations.requestBodyOverride,
      };
    }

    // ── Dynamic Token Limiting (Loss Prevention) ──
    if (
      typeof processedBody === "object" &&
      processedBody !== null
    ) {
      const client = db.getClient(clientId);
      if (client) {
        const activeQuota = client.customQuota ?? pkg.monthlyQuota;
        const remainingQuota = activeQuota - client.usageThisMonth;

        if (!pkg.allowOverage && remainingQuota <= 0) {
          logRequest(402, "Kuota token habis");
          return res.status(402).json({
            error: "Kuota token Anda telah habis. Silakan hubungi admin.",
            details: { remaining_quota: remainingQuota }
          });
        }

        // Estimasi token dari prompt menggunakan heuristik karakter / 4
        const estimatedPromptTokens = Math.max(1, estimateTokens(processedBody));
        const estimatedPromptTokensScaled = Math.ceil(estimatedPromptTokens * modelMultiplier);

        if (!pkg.allowOverage && estimatedPromptTokensScaled > remainingQuota) {
          db.incrementUsage(clientId, estimatedPromptTokensScaled);
          res.setHeader("X-Tokens-In", String(estimatedPromptTokens));
          res.setHeader("X-Tokens-Out", "0");
          logRequest(402, "Prompt melebihi sisa kuota");
          return res.status(402).json({
            error: "Prompt terlalu besar untuk sisa kuota Anda.",
            details: {
              remaining_quota: remainingQuota,
              estimated_prompt_cost: estimatedPromptTokensScaled,
              model_multiplier: modelMultiplier,
              penalty_applied: true,
            },
          });
        }

        // Hitung batas token untuk jawaban (completion)
        const allowedCompletionTokensScaled = remainingQuota - estimatedPromptTokensScaled;
        const allowedCompletionTokens = Math.floor(allowedCompletionTokensScaled / modelMultiplier);

        res.setHeader("X-Debug-Remaining-Quota", String(remainingQuota));
        res.setHeader("X-Debug-Prompt-Cost", String(estimatedPromptTokensScaled));
        res.setHeader("X-Debug-Allowed-Tokens", String(allowedCompletionTokens));
        res.setHeader("X-Debug-Model-Multiplier", String(modelMultiplier));
        res.setHeader("X-Debug-Allow-Overage", String(pkg.allowOverage));

        if (!pkg.allowOverage) {
          if (allowedCompletionTokens < 10) {
            db.incrementUsage(clientId, estimatedPromptTokensScaled);
            res.setHeader("X-Tokens-In", String(estimatedPromptTokens));
            res.setHeader("X-Tokens-Out", "0");
            logRequest(402, "Sisa kuota tidak cukup untuk respons");
            return res.status(402).json({
              error: "Sisa kuota Anda terlalu kecil untuk menghasilkan respons AI.",
              details: {
                remaining_quota: remainingQuota,
                estimated_prompt_cost: estimatedPromptTokensScaled,
                allowed_completion_tokens: allowedCompletionTokens,
                penalty_applied: true,
              },
            });
          }

          // Paksa Kroma AI membatasi output agar sesuai sisa kuota pengguna
          const userMaxTokens = processedBody.max_tokens || processedBody.max_completion_tokens || 999999;
          processedBody.max_tokens = Math.min(userMaxTokens, allowedCompletionTokens);
          req.body = processedBody;
        }
      }
    }

    // Memaksa upstream API untuk mengembalikan `usage` di akhir stream agar perhitungan token 100% akurat
    if (
      typeof processedBody === "object" &&
      processedBody !== null &&
      processedBody.stream === true &&
      !processedBody.stream_options
    ) {
      processedBody.stream_options = { include_usage: true };
    }

    // ── Build Fetch Options ──
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: upstreamHeaders,
      signal: AbortSignal.timeout(matchedRoute.timeout || 120000),
    };

    if (["POST", "PUT", "PATCH"].includes(req.method)) {
      fetchOptions.body = JSON.stringify(processedBody);
    }

    // ── Call Upstream ──
    const upstreamResponse = await fetch(targetUrl, fetchOptions);
    const contentType = upstreamResponse.headers.get("content-type") || "";

    logRequest(upstreamResponse.status);

    // Refund usage kalau upstream balikin error (5xx / 502 / 504 / 429)
    // atau kalau response itu sebenarnya halaman error CDN/Cloudflare.
    // User TIDAK PERLU bayar token untuk request yang gak sukses.
    const isUpstreamError = upstreamResponse.status >= 500;

    // Only parse as stream if the upstream response is actually OK and is an event stream
    const isStream = upstreamResponse.ok && contentType.includes("event-stream");

    if (isStream && upstreamResponse.body) {
      // Automatically aggregate when stream is requested to return 1 neat JSON
      const shouldAggregate = processedBody?.stream === true;

      if (!shouldAggregate) {
        res.setHeader("Content-Type", contentType || "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Token-Multiplier", String(modelMultiplier));
      }

      const reader = upstreamResponse.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      let aggregatedContent = "";
      let aggregatedReasoning = "";
      let lastParsedId = "chatcmpl-" + Date.now();
      let lastParsedModel = "unknown";

      let streamBuffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;

          if (shouldAggregate) {
            streamBuffer += chunk;
            // Parse SSE chunks to build the final text
            const lines = streamBuffer.split('\n');
            // Keep the last potentially incomplete line in the buffer
            streamBuffer = lines.pop() || "";
            
            for (const line of lines) {
              if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.id) lastParsedId = data.id;
                  if (data.model) lastParsedModel = data.model;
                  
                  const delta = data.choices?.[0]?.delta;
                  if (delta?.content) aggregatedContent += delta.content;
                  if (delta?.reasoning_content) aggregatedReasoning += delta.reasoning_content;
                } catch (e) {
                  // ignore partial json chunks
                }
              }
            }
          } else {
            res.write(value);
          }
        }
      } catch (err) {
        console.error("[Gateway] Error reading stream:", err);
      } finally {
        if (shouldAggregate) {
          res.json({
            id: lastParsedId,
            object: "chat.completion",
            created: Math.floor(Date.now() / 1000),
            model: lastParsedModel,
            choices: [
              {
                index: 0,
                message: {
                  role: "assistant",
                  content: aggregatedContent || ""
                },
                finish_reason: "stop"
              }
            ]
          });
        } else {
          res.end();
        }
      }

      if (
        pkg.quotaType === "token" &&
        upstreamResponse.status >= 200 &&
        upstreamResponse.status < 300
      ) {
        let inputTokens = 0;
        let outputTokens = 0;
        let baseTokens = 0;
        const totalMatch = fullText.match(/"total_tokens":\s*(\d+)/);
        const promptMatch = fullText.match(/"prompt_tokens":\s*(\d+)/);
        const completionMatch = fullText.match(/"completion_tokens":\s*(\d+)/);
        
        if (totalMatch) {
          baseTokens = parseInt(totalMatch[1], 10);
          inputTokens = promptMatch ? parseInt(promptMatch[1], 10) : 0;
          outputTokens = completionMatch ? parseInt(completionMatch[1], 10) : 0;
        } else {
          inputTokens = estimateTokens(processedBody);
          const finalOutput = (aggregatedContent || aggregatedReasoning) ? (aggregatedContent + aggregatedReasoning) : fullText;
          outputTokens = estimateTokens(finalOutput);
          baseTokens = Math.max(1, inputTokens + outputTokens);
        }
        const tokens = Math.ceil(baseTokens * modelMultiplier);
        db.incrementUsage(clientId, tokens);
      }
      return;
    }

    if (contentType.includes("application/json")) {
      let jsonResponse = await upstreamResponse.json();

      // Hitung token jika quota type = token (Berdasarkan jumlah kata).
      // SKIP kalau response error (5xx) — user tidak boleh kena charge
      // untuk upstream yang gagal/timeout.
      if (
        upstreamResponse.status >= 200 &&
        upstreamResponse.status < 300
      ) {
        let inputTokens = 0;
        let outputTokens = 0;
        let baseTokens = 0;
        if (jsonResponse.usage?.total_tokens) {
          baseTokens = jsonResponse.usage.total_tokens;
          inputTokens = jsonResponse.usage.prompt_tokens || 0;
          outputTokens = jsonResponse.usage.completion_tokens || 0;
        } else {
          inputTokens = estimateTokens(processedBody);
          outputTokens = estimateTokens(jsonResponse);
          baseTokens = Math.max(1, inputTokens + outputTokens);
        }
        const tokens = Math.ceil(baseTokens * modelMultiplier);

        db.incrementUsage(clientId, tokens);
        res.setHeader("X-Token-Multiplier", String(modelMultiplier));
        res.setHeader("X-Tokens-Charged", String(tokens));
        res.setHeader("X-Tokens-In", String(inputTokens));
        res.setHeader("X-Tokens-Out", String(outputTokens));
      }

      // ── Transform Response Body ──
      if (
        matchedRoute.transformations?.responseBodyMap &&
        typeof jsonResponse === "object" &&
        jsonResponse !== null
      ) {
        const mappedResponse: Record<string, any> = {};
        const map = matchedRoute.transformations.responseBodyMap;
        for (const key in jsonResponse) {
          const newKey = map[key] || key;
          mappedResponse[newKey] = jsonResponse[key];
        }
        jsonResponse = mappedResponse;
      }

      // ── Intercept /models Endpoint to Strip Prefix ──
      if (req.path.match(/\/models\/?$/i)) {
        if (jsonResponse.data && Array.isArray(jsonResponse.data)) {
          jsonResponse.data = jsonResponse.data.map((m: any) => {
            if (m.id && typeof m.id === "string") {
              // Hapus semua prefix (seperti pc-putih/lmstudio/)
              m.id = m.id.split("/").pop();
            }
            return m;
          });
        }
      }

      return res.status(upstreamResponse.status).json(jsonResponse);
    } else {
      const textResponse = await upstreamResponse.text();

      if (
        upstreamResponse.status >= 200 &&
        upstreamResponse.status < 300
      ) {
        const inputTokens = estimateTokens(processedBody);
        const outputTokens = estimateTokens(textResponse);
        const baseTokens = Math.max(1, inputTokens + outputTokens);
        const tokens = Math.ceil(baseTokens * modelMultiplier);

        db.incrementUsage(clientId, tokens);
        res.setHeader("X-Token-Multiplier", String(modelMultiplier));
        res.setHeader("X-Tokens-Charged", String(tokens));
        res.setHeader("X-Tokens-In", String(inputTokens));
        res.setHeader("X-Tokens-Out", String(outputTokens));
      }

      return res
        .status(upstreamResponse.status)
        .set("Content-Type", contentType || "text/plain")
        .send(textResponse);
    }
  } catch (error: any) {
    console.error(`[Gateway] Upstream error untuk ${req.path}:`, error.message);

    // Refund usage kalau request ke upstream gagal sebelum dapat respons
    // (timeout, connection refused, DNS error). User tidak boleh kena
    // charge untuk request yang gak nyampe ke upstream.
    // charge untuk request yang gak nyampe ke upstream.

    let statusCode = 502;
    let message = "Upstream server error atau tidak dapat dijangkau.";

    if (error.name === "AbortError" || error.name === "TimeoutError") {
      statusCode = 504;
      message = `Upstream server timeout setelah ${matchedRoute.timeout || 10000}ms.`;
    } else if (error.code === "ECONNREFUSED") {
      message = "Koneksi ke upstream server ditolak.";
    } else if (error.code === "ENOTFOUND") {
      message = "Domain upstream server tidak ditemukan.";
    }

    logRequest(statusCode, error.message);

    return res.status(statusCode).json({
      error: message,
      gateway: "KroomBridge API Gateway",
      route: matchedRoute.path,
      upstream: matchedRoute.upstreamUrl,
      details:
        process.env.NODE_ENV !== "production" ? error.message : undefined,
    });
  }
});
