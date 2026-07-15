import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { db } from "./db.js";
import type { Client, Package, Route, AdminUser } from "./db.js";
import { getAllGpuMetrics, getGpuHistory } from "./gpuMetrics.js";
import { broadcast } from "./eventBus.js";

export const adminRouter = express.Router();

const ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "kroombox_admin_super_secret!";

// ============================================================
// AUTH — Login Admin
// POST /api/admin/login
// ============================================================
adminRouter.post("/login", (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email dan password wajib diisi" });
  }

  const admins = db.getAdmins();
  const admin = admins.find(
    (a) => a.email === email && a.password === password,
  );

  if (!admin) {
    return res.status(401).json({
      error: "Email atau password salah.",
      hint: "Password default: admin123",
    });
  }

  // Update last login
  db.updateAdmin(admin.id, { lastLogin: new Date().toISOString() });

  const { password: _, ...adminWithoutPassword } = admin;
  const token = jwt.sign(adminWithoutPassword, ADMIN_JWT_SECRET, {
    expiresIn: "1d",
  });

  res.json({ success: true, user: adminWithoutPassword, token });
});

// ============================================================
// MIDDLEWARE — Verifikasi Token Admin (RBAC)
// ============================================================
adminRouter.use((req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token autentikasi diperlukan" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET) as any;
    (req as any).admin = decoded;

    // Kebijakan RBAC telah dihapus atas permintaan pengguna.
    // Semua admin yang berhasil login memiliki akses penuh.

    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ error: "Token sudah kedaluwarsa. Silakan login ulang." });
    }
    return res.status(401).json({ error: "Token tidak valid" });
  }
});

// ============================================================
// VALIDATE TOKEN
// GET /api/admin/validate-token
// ============================================================
adminRouter.get("/validate-token", (req: Request, res: Response) => {
  const admin = (req as any).admin;
  res.json({ valid: true, admin });
});

// ============================================================
// DASHBOARD STATS
// GET /api/admin/dashboard-stats
// ============================================================
adminRouter.get("/dashboard-stats", (req: Request, res: Response) => {
  const stats = db.getDashboardStats();
  res.json(stats);
});

// ============================================================
// PROVIDERS LIST (KROMA AI LIVE SYNC)
// GET /api/admin/providers
// ============================================================
adminRouter.get("/providers", async (req: Request, res: Response) => {
  try {
    const meta = db.getMeta();
    const customKey = req.query.customKey as string;
    const apiKey = customKey || meta.apiKeys?.find(k => k.provider === 'kroma')?.key || meta.kromaApiKey || process.env.KROMA_API_KEY;
    const KROMA_API_URL = process.env.KROMA_API_URL || "https://kroma.kroombox.com";
    
    const headers: any = {
      "Content-Type": "application/json"
    };

    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
      headers["x-api-key"] = apiKey;
    }

    // Mengambil data provider dan model secara live dari Kroma AI
    const kromaRes = await fetch(`${KROMA_API_URL}/v1/providers/`, {
      method: "GET",
      headers
    });

    if (!kromaRes.ok) {
      throw new Error(`Kroma API merespons dengan status: ${kromaRes.status}`);
    }

    const data = await kromaRes.json();
    res.json(data);
  } catch (error: any) {
    console.error("[Admin API] Error fetching live Kroma providers:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// TIME-SERIES — Aggregasi log untuk chart sesuai rentang waktu
// GET /api/admin/timeseries?range=5m|1h|24h|7d|30d|1y
// Query param tambahan: ?path=/wa  (filter per endpoint)
// ============================================================
adminRouter.get("/timeseries", (req: Request, res: Response) => {
  const range = (req.query.range as string) || "24h";
  const filterPath = (req.query.path as string) || undefined;

  const RANGE_CONFIG: Record<
    string,
    {
      count: number;
      sizeMs: number;
      labelFmt: "time" | "hour" | "day" | "month";
    }
  > = {
    "5m": { count: 30, sizeMs: 10_000, labelFmt: "time" },
    "1h": { count: 30, sizeMs: 120_000, labelFmt: "time" },
    "24h": { count: 24, sizeMs: 3_600_000, labelFmt: "hour" },
    "7d": { count: 7, sizeMs: 86_400_000, labelFmt: "day" },
    "30d": { count: 30, sizeMs: 86_400_000, labelFmt: "day" },
    "1y": { count: 12, sizeMs: 30 * 86_400_000, labelFmt: "month" },
  };

  const cfg = RANGE_CONFIG[range] || RANGE_CONFIG["24h"];
  const now = Date.now();

  // Init buckets dari yang paling lama ke paling baru
  const buckets = Array.from({ length: cfg.count }, (_, i) => {
    const idx = cfg.count - 1 - i;
    const start = now - (idx + 1) * cfg.sizeMs;
    const end = start + cfg.sizeMs;
    const date = new Date(end);
    let label: string;
    if (cfg.labelFmt === "time") {
      label = date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } else if (cfg.labelFmt === "hour") {
      label = date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        hour12: false,
      });
    } else if (cfg.labelFmt === "day") {
      label = date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      });
    } else {
      label = date.toLocaleDateString("id-ID", {
        month: "short",
        year: "2-digit",
      });
    }
    return {
      time: label,
      timestamp: start,
      requests: 0,
      errors: 0,
      latencySum: 0,
      latencyCount: 0,
    };
  });

  const totalWindowMs = cfg.count * cfg.sizeMs;

  // Filter logs di rentang waktu yang diminta
  const allLogs = db.getLogs(Infinity);
  for (const log of allLogs) {
    const ts = new Date(log.timestamp).getTime();
    const diff = now - ts;
    if (diff < 0 || diff > totalWindowMs) continue;
    if (
      filterPath &&
      log.path !== filterPath &&
      !log.path?.startsWith(filterPath)
    )
      continue;

    const idx = cfg.count - 1 - Math.floor(diff / cfg.sizeMs);
    if (idx < 0 || idx >= cfg.count) continue;

    buckets[idx].requests += 1;
    if (log.statusCode >= 400) buckets[idx].errors += 1;
    if (log.durationMs != null) {
      buckets[idx].latencySum += log.durationMs;
      buckets[idx].latencyCount += 1;
    }
  }

  // Compute average latency per bucket dan summary keseluruhan
  let totalRequests = 0;
  let totalErrors = 0;
  let totalLatencySum = 0;
  let totalLatencyCount = 0;

  const series = buckets.map((b) => {
    totalRequests += b.requests;
    totalErrors += b.errors;
    totalLatencySum += b.latencySum;
    totalLatencyCount += b.latencyCount;
    return {
      time: b.time,
      timestamp: b.timestamp,
      requests: b.requests,
      errors: b.errors,
      latency:
        b.latencyCount > 0 ? Math.round(b.latencySum / b.latencyCount) : 0,
    };
  });

  res.json({
    range,
    bucketSizeMs: cfg.sizeMs,
    bucketCount: cfg.count,
    series,
    summary: {
      totalRequests,
      totalErrors,
      avgLatency:
        totalLatencyCount > 0
          ? Math.round(totalLatencySum / totalLatencyCount)
          : 0,
      successRate:
        totalRequests > 0
          ? Math.round(
              ((totalRequests - totalErrors) / totalRequests) * 100 * 100,
            ) / 100
          : 100,
    },
  });
});

// ============================================================
// GPU METRICS — Monitoring hardware realtime
// GET /api/admin/gpu — semua snapshot terbaru per host
// GET /api/admin/gpu/:hostId/history — history sample untuk satu host
// ============================================================
adminRouter.get("/gpu", (req: Request, res: Response) => {
  res.json(getAllGpuMetrics());
});

adminRouter.get("/gpu/:hostId/history", (req: Request, res: Response) => {
  res.json(getGpuHistory(req.params.hostId));
});

// ============================================================
// CLIENTS — Manajemen Klien API
// ============================================================

import { syncUsersToClients } from "./userSync.js";

// POST /api/admin/sync-users
adminRouter.post("/sync-users", async (req: Request, res: Response) => {
  const result = await syncUsersToClients();
  if (result.success) {
    broadcast({
      type: "client:change",
      data: { action: "sync", message: "Users synced to clients" },
    });
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

// GET /api/admin/clients — List semua klien
adminRouter.get("/clients", (req: Request, res: Response) => {
  const clients = db.getClients();

  // Enrich with package info
  const enriched = clients.map((c) => {
    const pkg = db.getPackage(c.packageId);
    return {
      ...c,
      packageName: pkg?.name ?? "Unknown",
      activeQuota: c.customQuota ?? pkg?.monthlyQuota ?? 0,
    };
  });

  res.json(enriched);
});

// GET /api/admin/clients/:id — Detail klien
adminRouter.get("/clients/:id", (req: Request, res: Response) => {
  const client = db.getClient(req.params.id);
  if (!client) return res.status(404).json({ error: "Klien tidak ditemukan" });

  const pkg = db.getPackage(client.packageId);
  const logs = db.getLogsByClient(client.id, 50);
  const usageStats = db.getUsageStats(client.id);

  res.json({
    ...client,
    packageName: pkg?.name ?? "Unknown",
    packageDetails: pkg,
    recentLogs: logs,
    usageStats,
  });
});

// POST /api/admin/clients — Buat klien baru
adminRouter.post("/clients", (req: Request, res: Response) => {
  const { name, email, packageId, secretKey, customQuota, tags, notes } =
    req.body;

  if (!name || !packageId) {
    return res.status(400).json({ error: "name dan packageId wajib diisi" });
  }

  const pkg = db.getPackage(packageId);
  if (!pkg) {
    return res
      .status(400)
      .json({ error: `Paket '${packageId}' tidak ditemukan` });
  }

  const newClient: Client = {
    id: `client_${uuidv4().replace(/-/g, "").slice(0, 12)}`,
    name,
    email: email || undefined,
    packageId,
    secretKey: secretKey || `sk_${uuidv4().replace(/-/g, "")}`,
    usageThisMonth: 0,
    isActive: true,
    status: "active",
    customQuota: customQuota ? parseInt(String(customQuota)) : null,
    tags: tags || [],
    notes: notes || "",
    createdAt: new Date().toISOString(),
  };

  db.createClient(newClient);
  broadcast({
    type: "client:change",
    data: { action: "created", client: newClient },
  });
  res.status(201).json(newClient);
});

// PATCH /api/admin/clients/:id — Update klien
adminRouter.patch("/clients/:id", (req: Request, res: Response) => {
  const client = db.getClient(req.params.id);
  if (!client) return res.status(404).json({ error: "Klien tidak ditemukan" });

  const { name, email, packageId, secretKey, customQuota, tags, notes } =
    req.body;

  if (packageId) {
    const pkg = db.getPackage(packageId);
    if (!pkg)
      return res
        .status(400)
        .json({ error: `Paket '${packageId}' tidak ditemukan` });
  }

  const updateData: Partial<Client> = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (packageId !== undefined) updateData.packageId = packageId;
  if (secretKey !== undefined) updateData.secretKey = secretKey;
  if (customQuota !== undefined) {
    updateData.customQuota =
      customQuota === "" || customQuota === null
        ? null
        : parseInt(String(customQuota));
  }
  if (tags !== undefined) updateData.tags = tags;
  if (notes !== undefined) updateData.notes = notes;

  const updated = db.updateClient(client.id, updateData);
  broadcast({
    type: "client:change",
    data: { action: "updated", client: updated },
  });
  res.json(updated);
});

// PATCH /api/admin/clients/:id/toggle — Aktifkan/nonaktifkan klien
adminRouter.patch("/clients/:id/toggle", (req: Request, res: Response) => {
  const client = db.getClient(req.params.id);
  if (!client) return res.status(404).json({ error: "Klien tidak ditemukan" });

  const newStatus = !client.isActive;
  const updated = db.updateClient(client.id, {
    isActive: newStatus,
    status: newStatus ? "active" : "suspended",
  });

  res.json({
    ...updated,
    message: `Klien berhasil ${newStatus ? "diaktifkan" : "ditangguhkan"}`,
  });
});

// POST /api/admin/clients/:id/rotate — Rotasi Secret Key
adminRouter.post("/clients/:id/rotate", (req: Request, res: Response) => {
  const client = db.getClient(req.params.id);
  if (!client) return res.status(404).json({ error: "Klien tidak ditemukan" });

  const newSecretKey = `sk_${uuidv4().replace(/-/g, "")}`;
  // Naikkan keyVersion untuk meng-invalidate semua access token lama.
  // Klien harus call POST /api/auth/token lagi pakai secret key baru.
  const newKeyVersion = (client.keyVersion ?? 1) + 1;
  const updated = db.updateClient(client.id, {
    secretKey: newSecretKey,
    keyVersion: newKeyVersion,
  });

  res.json({
    ...updated,
    message:
      "Secret Key berhasil dirotasi. Pastikan klien memperbarui credentials mereka.",
  });
});

// POST /api/admin/clients/:id/reset-usage — Reset penggunaan bulan ini
adminRouter.post("/clients/:id/reset-usage", (req: Request, res: Response) => {
  const client = db.getClient(req.params.id);
  if (!client) return res.status(404).json({ error: "Klien tidak ditemukan" });

  const updated = db.updateClient(client.id, {
    usageThisMonth: 0,
    quotaAlertSent: false,
  });

  res.json({ ...updated, message: "Usage bulan ini berhasil direset." });
});

// DELETE /api/admin/clients/:id — Hapus klien
adminRouter.delete("/clients/:id", async (req: Request, res: Response) => {
  try {
    const success = await db.deleteClient(req.params.id);
    if (!success) return res.status(404).json({ error: "Klien tidak ditemukan" });
    broadcast({
      type: "client:change",
      data: { action: "deleted", id: req.params.id },
    });
    res.json({ success: true, message: "Klien berhasil dihapus" });
  } catch (err: any) {
    console.error("[Delete Client Error]", err);
    res.status(500).json({
      error: "Gagal menghapus klien dari database.",
      details: err.message,
    });
  }
});

// ============================================================
// PACKAGES — Manajemen Paket API
// ============================================================

// GET /api/admin/packages
adminRouter.get("/packages", (req: Request, res: Response) => {
  const packages = db.getPackages();
  // Enrich: jumlah klien per paket
  const clients = db.getClients();
  const enriched = packages.map((p) => ({
    ...p,
    clientCount: clients.filter((c) => c.packageId === p.id).length,
  }));
  res.json(enriched);
});

// GET /api/admin/packages/:id
adminRouter.get("/packages/:id", (req: Request, res: Response) => {
  const pkg = db.getPackage(req.params.id);
  if (!pkg) return res.status(404).json({ error: "Paket tidak ditemukan" });

  const clients = db.getClients().filter((c) => c.packageId === pkg.id);
  res.json({
    ...pkg,
    clientCount: clients.length,
    clients: clients.map((c) => c.id),
  });
});

// POST /api/admin/packages
adminRouter.post("/packages", (req: Request, res: Response) => {
  const {
    name,
    maxRequestsPerMinute,
    monthlyQuota,
    allowOverage,
    overageRatePer1K,
    allowedEndpoints,
    price,
    description,
  } = req.body;

  if (!name || maxRequestsPerMinute == null || monthlyQuota == null) {
    return res.status(400).json({
      error: "name, maxRequestsPerMinute, dan monthlyQuota wajib diisi",
    });
  }

  if (maxRequestsPerMinute < 1) {
    return res.status(400).json({ error: "maxRequestsPerMinute minimal 1" });
  }

  const newPackage: Package = {
    id: `pkg_${uuidv4().replace(/-/g, "").slice(0, 8)}`,
    name,
    maxRequestsPerMinute: parseInt(String(maxRequestsPerMinute)),
    monthlyQuota: parseInt(String(monthlyQuota)),
    quotaType: "token",
    allowOverage: !!allowOverage,
    overageRatePer1K: parseFloat(String(overageRatePer1K || 0)),
    allowedEndpoints: allowedEndpoints || ["*"],
    price: price ? parseInt(String(price)) : 0,
    description: description || "",
    createdAt: new Date().toISOString(),
  };

  db.createPackage(newPackage);
  broadcast({
    type: "package:change",
    data: { action: "created", package: newPackage },
  });
  res.status(201).json(newPackage);
});

// PATCH /api/admin/packages/:id
adminRouter.patch("/packages/:id", (req: Request, res: Response) => {
  const pkg = db.getPackage(req.params.id);
  if (!pkg) return res.status(404).json({ error: "Paket tidak ditemukan" });

  const updates = { ...req.body };
  if (updates.maxRequestsPerMinute)
    updates.maxRequestsPerMinute = parseInt(
      String(updates.maxRequestsPerMinute),
    );
  if (updates.monthlyQuota)
    updates.monthlyQuota = parseInt(String(updates.monthlyQuota));
  if (updates.overageRatePer1K)
    updates.overageRatePer1K = parseFloat(String(updates.overageRatePer1K));
  if (updates.price) updates.price = parseInt(String(updates.price));
  updates.quotaType = "token"; // Paksa selalu token

  const updated = db.updatePackage(pkg.id, updates);
  broadcast({
    type: "package:change",
    data: { action: "updated", package: updated },
  });
  res.json(updated);
});

// DELETE /api/admin/packages/:id
adminRouter.delete("/packages/:id", async (req: Request, res: Response) => {
  const pkgId = req.params.id;
  const isUsed = db.getClients().some((c) => c.packageId === pkgId);

  if (isUsed) {
    return res.status(400).json({
      error:
        "Tidak dapat menghapus paket karena masih digunakan oleh satu atau lebih klien.",
      hint: "Pindahkan semua klien ke paket lain terlebih dahulu.",
    });
  }

  try {
    const success = await db.deletePackage(pkgId);
    if (!success) return res.status(404).json({ error: "Paket tidak ditemukan" });

    broadcast({
      type: "package:change",
      data: { action: "deleted", id: pkgId },
    });
    res.json({ success: true, message: "Paket berhasil dihapus" });
  } catch (err: any) {
    console.error("[Delete Package Error]", err);
    res.status(500).json({
      error: "Gagal menghapus paket dari database.",
      details: err.message,
    });
  }
});

// ============================================================
// ROUTES — Manajemen Route Gateway
// ============================================================

import { syncKromaRoutes } from "./kromaSync.js";

// POST /api/admin/sync-kroma
adminRouter.post("/sync-kroma", async (req: Request, res: Response) => {
  const result = await syncKromaRoutes();
  if (result.success) {
    broadcast({
      type: "route:change",
      data: { action: "sync", message: "Kroma AI routes synced" },
    });
    res.json(result);
  } else {
    res.status(500).json(result);
  }
});

// GET /api/admin/routes
adminRouter.get("/routes", (req: Request, res: Response) => {
  const routes = db.getRoutes();
  const logs = db.getLogs(Infinity);

  const enriched = routes.map((r) => ({
    ...r,
    requestCount: logs.filter((l) => l.routeId === r.id).length,
    errorCount: logs.filter((l) => l.routeId === r.id && l.statusCode >= 400)
      .length,
  }));

  res.json(enriched);
});

// GET /api/admin/routes/:id
adminRouter.get("/routes/:id", (req: Request, res: Response) => {
  const route = db.getRoute(req.params.id);
  if (!route) return res.status(404).json({ error: "Route tidak ditemukan" });
  res.json(route);
});

// POST /api/admin/routes
adminRouter.post("/routes", (req: Request, res: Response) => {
  const {
    path,
    upstreamUrl,
    description,
    method,
    timeout,
    headers,
    transformations,
  } = req.body;

  if (!path || !upstreamUrl) {
    return res.status(400).json({ error: "path dan upstreamUrl wajib diisi" });
  }

  if (!path.startsWith("/")) {
    return res.status(400).json({ error: "path harus diawali dengan /" });
  }

  // Cek duplikat path
  const existing = db.getRoutes().find((r) => r.path === path);
  if (existing) {
    return res.status(409).json({
      error: `Route dengan path '${path}' sudah ada`,
      existing,
    });
  }

  const newRoute: Route = {
    id: `route_${uuidv4().replace(/-/g, "").slice(0, 8)}`,
    path,
    upstreamUrl,
    description: description || "",
    isActive: true,
    method: method || "ALL",
    timeout: timeout ? parseInt(String(timeout)) : 10000,
    headers: headers || {},
    transformations: transformations || {},
    createdAt: new Date().toISOString(),
  };

  const created = db.createRoute(newRoute);
  broadcast({
    type: "route:change",
    data: { action: "created", route: created },
  });
  res.status(201).json(created);
});

// PATCH /api/admin/routes/:id
adminRouter.patch("/routes/:id", (req: Request, res: Response) => {
  const route = db.getRoute(req.params.id);
  if (!route) return res.status(404).json({ error: "Route tidak ditemukan" });

  const updates = { ...req.body };

  // Cek duplikat path jika diubah
  if (updates.path && updates.path !== route.path) {
    const dup = db
      .getRoutes()
      .find((r) => r.path === updates.path && r.id !== route.id);
    if (dup) {
      return res
        .status(409)
        .json({ error: `Route dengan path '${updates.path}' sudah ada` });
    }
  }

  const updated = db.updateRoute(req.params.id, updates);
  if (!updated) return res.status(404).json({ error: "Route tidak ditemukan" });

  broadcast({
    type: "route:change",
    data: { action: "updated", route: updated },
  });
  res.json(updated);
});

// PATCH /api/admin/routes/:id/toggle
adminRouter.patch("/routes/:id/toggle", (req: Request, res: Response) => {
  const route = db.getRoute(req.params.id);
  if (!route) return res.status(404).json({ error: "Route tidak ditemukan" });

  const updated = db.updateRoute(req.params.id, { isActive: !route.isActive });
  broadcast({
    type: "route:change",
    data: { action: "toggled", route: updated },
  });
  res.json({
    ...updated,
    message: `Route berhasil ${updated?.isActive ? "diaktifkan" : "dinonaktifkan"}`,
  });
});

// DELETE /api/admin/routes/:id
adminRouter.delete("/routes/:id", async (req: Request, res: Response) => {
  try {
    const success = await db.deleteRoute(req.params.id);
    if (!success) return res.status(404).json({ error: "Route tidak ditemukan" });
    broadcast({
      type: "route:change",
      data: { action: "deleted", id: req.params.id },
    });
    res.json({ success: true, message: "Route berhasil dihapus" });
  } catch (err: any) {
    console.error("[Delete Route Error]", err);
    res.status(500).json({
      error: "Gagal menghapus route dari database.",
      details: err.message,
    });
  }
});

// ============================================================
// SECURITY — Konfigurasi Keamanan Gateway
// ============================================================

// GET /api/admin/security
adminRouter.get("/security", (req: Request, res: Response) => {
  res.json(db.getSecurity());
});

// PATCH /api/admin/security
adminRouter.patch("/security", (req: Request, res: Response) => {
  const {
    rateLimitAnomalyDetection,
    upstreamValidationShield,
    requireHttps,
    maxBodySizeKb,
    ipAllowlist,
    ipDenylist,
  } = req.body;

  const updates: any = {};
  if (rateLimitAnomalyDetection !== undefined)
    updates.rateLimitAnomalyDetection = !!rateLimitAnomalyDetection;
  if (upstreamValidationShield !== undefined)
    updates.upstreamValidationShield = !!upstreamValidationShield;
  if (requireHttps !== undefined) updates.requireHttps = !!requireHttps;
  if (maxBodySizeKb !== undefined)
    updates.maxBodySizeKb = parseInt(String(maxBodySizeKb));
  if (Array.isArray(ipAllowlist)) updates.ipAllowlist = ipAllowlist;
  if (Array.isArray(ipDenylist)) updates.ipDenylist = ipDenylist;

  const updated = db.updateSecurity(updates);
  broadcast({
    type: "security:change",
    data: { action: "config", security: updated },
  });
  res.json(updated);
});

// POST /api/admin/security/allowlist — Tambah IP ke allowlist
adminRouter.post("/security/allowlist", (req: Request, res: Response) => {
  const { ip, label } = req.body;
  if (!ip) return res.status(400).json({ error: "IP wajib diisi" });

  const updated = db.addToIpAllowlist(ip, label || ip);
  broadcast({
    type: "security:change",
    data: { action: "allowlist:add", ip, security: updated },
  });
  res.json({ message: `IP ${ip} ditambahkan ke allowlist`, security: updated });
});

// DELETE /api/admin/security/allowlist/:ip — Hapus IP dari allowlist
adminRouter.delete("/security/allowlist/:ip", (req: Request, res: Response) => {
  const ip = decodeURIComponent(req.params.ip);
  const updated = db.removeFromIpAllowlist(ip);
  broadcast({
    type: "security:change",
    data: { action: "allowlist:remove", ip, security: updated },
  });
  res.json({ message: `IP ${ip} dihapus dari allowlist`, security: updated });
});

// POST /api/admin/security/denylist — Tambah IP ke denylist
adminRouter.post("/security/denylist", (req: Request, res: Response) => {
  const { ip, reason } = req.body;
  if (!ip) return res.status(400).json({ error: "IP wajib diisi" });

  const updated = db.addToIpDenylist(ip, reason || "Diblokir oleh admin");
  broadcast({
    type: "security:change",
    data: { action: "denylist:add", ip, security: updated },
  });
  res.json({ message: `IP ${ip} ditambahkan ke denylist`, security: updated });
});

// DELETE /api/admin/security/denylist/:ip — Hapus IP dari denylist
adminRouter.delete("/security/denylist/:ip", (req: Request, res: Response) => {
  const ip = decodeURIComponent(req.params.ip);
  const updated = db.removeFromIpDenylist(ip);
  broadcast({
    type: "security:change",
    data: { action: "denylist:remove", ip, security: updated },
  });
  res.json({ message: `IP ${ip} dihapus dari denylist`, security: updated });
});

// ============================================================
// ADMIN USERS — Manajemen Pengguna Admin
// ============================================================

// GET /api/admin/users
adminRouter.get("/users", (req: Request, res: Response) => {
  const users = db.getAdmins().map((a) => {
    const { password, ...rest } = a;
    return rest;
  });
  res.json(users);
});

// POST /api/admin/users
adminRouter.post("/users", (req: Request, res: Response) => {
  const { name, email, role, password } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "name dan email wajib diisi" });
  }

  // Cek duplikat email
  const existing = db.getAdminByEmail(email);
  if (existing) {
    return res
      .status(409)
      .json({ error: `Admin dengan email '${email}' sudah terdaftar` });
  }

  const allowedRoles = ["Admin", "Viewer", "Moderator"];
  if (role && !allowedRoles.includes(role)) {
    return res.status(400).json({
      error: `Role tidak valid. Pilihan: ${allowedRoles.join(", ")}`,
    });
  }

  const newAdmin: AdminUser = {
    id: `admin_${uuidv4().replace(/-/g, "").slice(0, 8)}`,
    name,
    email,
    role: role || "Viewer",
    password: password || "admin123",
    createdAt: new Date().toISOString(),
  };

  const created = db.createAdmin(newAdmin);
  const { password: _, ...rest } = created;
  broadcast({ type: "admin:change", data: { action: "created", admin: rest } });
  res.status(201).json(rest);
});

// PATCH /api/admin/users/:id
adminRouter.patch("/users/:id", (req: Request, res: Response) => {
  const updates = { ...req.body };

  // Jangan update password jika kosong
  if (updates.password === "" || updates.password === null) {
    delete updates.password;
  }

  // Validasi role
  if (updates.role) {
    const allowedRoles = ["Admin", "Viewer", "Moderator"];
    if (!allowedRoles.includes(updates.role)) {
      return res.status(400).json({
        error: `Role tidak valid. Pilihan: ${allowedRoles.join(", ")}`,
      });
    }
  }

  // Cek duplikat email jika berubah
  if (updates.email) {
    const existing = db.getAdminByEmail(updates.email);
    if (existing && existing.id !== req.params.id) {
      return res
        .status(409)
        .json({ error: `Email '${updates.email}' sudah digunakan` });
    }
  }

  const updated = db.updateAdmin(req.params.id, updates);
  if (!updated) return res.status(404).json({ error: "Admin tidak ditemukan" });

  const { password: _, ...rest } = updated;
  broadcast({ type: "admin:change", data: { action: "updated", admin: rest } });
  res.json(rest);
});

// DELETE /api/admin/users/:id
adminRouter.delete("/users/:id", (req: Request, res: Response) => {
  const admins = db.getAdmins();

  // Cegah hapus admin terakhir
  if (admins.length <= 1) {
    return res
      .status(400)
      .json({ error: "Tidak dapat menghapus admin terakhir dalam sistem" });
  }

  // Cegah hapus diri sendiri
  const currentAdmin = (req as any).admin;
  if (currentAdmin?.id === req.params.id) {
    return res
      .status(400)
      .json({ error: "Tidak dapat menghapus akun sendiri" });
  }

  const success = db.deleteAdmin(req.params.id);
  if (!success) return res.status(404).json({ error: "Admin tidak ditemukan" });

  broadcast({
    type: "admin:change",
    data: { action: "deleted", id: req.params.id },
  });
  res.json({ success: true, message: "Admin berhasil dihapus" });
});

// ============================================================
// LOGS — Log Permintaan API
// ============================================================

// GET /api/admin/logs
adminRouter.get("/logs", (req: Request, res: Response) => {
  const limit = parseInt(String(req.query.limit || "200"));
  const offset = parseInt(String(req.query.offset || "0"));
  const clientId = req.query.clientId as string | undefined;
  const routeId = req.query.routeId as string | undefined;
  const status = req.query.status as string | undefined;

  let logs = db.getLogs(Infinity);

  if (clientId) logs = logs.filter((l) => l.clientId === clientId);
  if (routeId) logs = logs.filter((l) => l.routeId === routeId);
  if (status === "error") logs = logs.filter((l) => l.statusCode >= 400);
  if (status === "success")
    logs = logs.filter((l) => l.statusCode >= 200 && l.statusCode < 300);

  const total = logs.length;
  const paginated = logs.slice(offset, offset + limit);

  res.json({
    logs: paginated,
    total,
    limit,
    offset,
  });
});

// DELETE /api/admin/logs — Hapus semua logs
adminRouter.delete("/logs", (req: Request, res: Response) => {
  // Hanya Admin yang bisa hapus log
  const admin = (req as any).admin;
  if (admin?.role !== "Admin") {
    return res
      .status(403)
      .json({ error: "Hanya Admin yang dapat menghapus logs" });
  }

  const count = db.clearLogs();
  res.json({ success: true, message: `${count} log berhasil dihapus` });
});

// ============================================================
// ANALYTICS & USAGE
// ============================================================

// GET /api/admin/analytics/usage
adminRouter.get("/analytics/usage", (req: Request, res: Response) => {
  const clientId = req.query.clientId as string | undefined;
  const usageRecords = db.getUsageStats(clientId);

  // Group by date
  const byDate = usageRecords.reduce(
    (acc, r) => {
      if (!acc[r.date]) {
        acc[r.date] = { date: r.date, requests: 0, tokens: 0, errors: 0 };
      }
      acc[r.date].requests += r.requestCount;
      acc[r.date].tokens += r.tokenCount;
      acc[r.date].errors += r.errorCount;
      return acc;
    },
    {} as Record<string, any>,
  );

  const sorted = Object.values(byDate).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  res.json({
    records: sorted,
    total: {
      requests: sorted.reduce((s, r) => s + r.requests, 0),
      tokens: sorted.reduce((s, r) => s + r.tokens, 0),
      errors: sorted.reduce((s, r) => s + r.errors, 0),
    },
  });
});

// POST /api/admin/reset-monthly-usage — Reset kuota bulanan semua klien
adminRouter.post("/reset-monthly-usage", (req: Request, res: Response) => {
  const admin = (req as any).admin;
  if (admin?.role !== "Admin") {
    return res
      .status(403)
      .json({ error: "Hanya Admin yang dapat mereset kuota bulanan" });
  }

  const count = db.resetMonthlyUsage();
  res.json({
    success: true,
    message: `Kuota bulanan ${count} klien berhasil direset.`,
    resetAt: new Date().toISOString(),
  });
});

// ============================================================
// SYSTEM UTILITIES — Fitur Pengaturan Sistem
// ============================================================
adminRouter.delete("/system/logs", (req: Request, res: Response) => {
  const count = db.clearLogs();
  res.json({
    success: true,
    message: "Berhasil menghapus " + count + " log aktivitas.",
  });
});

adminRouter.post("/system/reset-quotas", (req: Request, res: Response) => {
  const count = db.resetAllQuotas();
  res.json({
    success: true,
    message: "Berhasil me-reset kuota untuk " + count + " klien aktif.",
  });
});

// GET /api/admin/system/meta — Ambil konfigurasi meta sistem
adminRouter.get("/system/meta", (req: Request, res: Response) => {
  const meta = db.getMeta();
  res.json(meta);
});

// PATCH /api/admin/system/meta — Update konfigurasi meta sistem (termasuk API Key)
adminRouter.patch("/system/meta", (req: Request, res: Response) => {
  const { kromaApiKey, apiKeys } = req.body;
  const updates: any = {};

  if (kromaApiKey !== undefined) {
    updates.kromaApiKey = kromaApiKey;
  }
  
  if (apiKeys !== undefined) {
    updates.apiKeys = apiKeys;
  }

  const updatedMeta = db.updateMeta(updates);
  res.json({ success: true, meta: updatedMeta });
});

// PATCH /api/admin/system/reset-schedule — Simpan jadwal auto-reset kuota
adminRouter.patch("/system/reset-schedule", (req: Request, res: Response) => {
  const { quotaResetDay, quotaResetMonth, quotaResetMode } = req.body;

  if (quotaResetDay !== undefined) {
    const day = parseInt(String(quotaResetDay));
    if (isNaN(day) || day < 1 || day > 31) {
      return res.status(400).json({ error: "Tanggal reset harus antara 1-31" });
    }
  }

  if (quotaResetMonth !== undefined) {
    const month = parseInt(String(quotaResetMonth));
    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: "Bulan reset harus antara 1-12" });
    }
  }

  if (
    quotaResetMode !== undefined &&
    !["monthly", "purchase", "annual"].includes(quotaResetMode)
  ) {
    return res
      .status(400)
      .json({ error: 'Mode harus "monthly", "purchase", atau "annual"' });
  }

  const updates: any = {};
  if (quotaResetDay !== undefined)
    updates.quotaResetDay = parseInt(String(quotaResetDay));
  if (quotaResetMonth !== undefined)
    updates.quotaResetMonth = parseInt(String(quotaResetMonth));
  if (quotaResetMode !== undefined) updates.quotaResetMode = quotaResetMode;

  db.updateMeta(updates);

  // Setelah simpan jadwal, langsung cek apakah hari ini sudah tanggal reset
  // tapi belum direset. Kalau iya, jalankan reset segera supaya
  // user tidak perlu menunggu sampai scheduler jalan.
  const meta = db.getMeta();
  const today = new Date();
  const todayDate = today.getDate();
  const todayMonth = today.getMonth() + 1;
  const currentMonth = today.toISOString().slice(0, 7);
  const currentYear = String(today.getFullYear());
  const mode = meta.quotaResetMode || "monthly";
  const resetDay = meta.quotaResetDay ?? 1;
  const resetMonth = meta.quotaResetMonth ?? 1;

  let autoTriggered = false;
  let resetCount = 0;
  if (
    mode === "monthly" &&
    todayDate >= resetDay &&
    meta.lastQuotaReset !== currentMonth
  ) {
    resetCount = db.resetMonthlyUsage();
    autoTriggered = true;
  } else if (
    mode === "annual" &&
    todayMonth === resetMonth &&
    todayDate >= resetDay &&
    meta.lastAnnualQuotaReset !== currentYear
  ) {
    resetCount = db.resetMonthlyUsage();
    db.updateMeta({ lastAnnualQuotaReset: currentYear });
    autoTriggered = true;
  }

  res.json({
    success: true,
    message: autoTriggered
      ? `Jadwal disimpan dan kuota ${resetCount} klien langsung direset (hari ini sudah tanggal ${resetDay}).`
      : "Jadwal auto-reset berhasil disimpan.",
    autoTriggered,
    resetCount,
    ...db.getMeta(),
  });
});

// POST /api/admin/system/force-reset-quotas — paksa reset semua kuota sekarang
// (terlepas dari tanggal). Berguna saat admin ingin reset manual atau saat
// jadwal terlewat (server mati saat tanggal reset).
adminRouter.post(
  "/system/force-reset-quotas",
  (req: Request, res: Response) => {
    const count = db.resetMonthlyUsage();
    res.json({
      success: true,
      message: `Berhasil mereset kuota ${count} klien secara paksa.`,
      resetAt: new Date().toISOString(),
      resetCount: count,
    });
  },
);
