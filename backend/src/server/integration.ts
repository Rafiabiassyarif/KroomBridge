import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { db, reloadFromMySQL } from "./db.js";
import { broadcast } from "./eventBus.js";

export const integrationRouter = express.Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "kroombridge_126";

/**
 * Helper untuk mencocokkan ID atau nama paket dari Panel secara fleksibel.
 * Mendukung variasi seperti "free_tier", "Free Tier", "starter_ai", "Starter AI",
 * "pro_ai_suite", "Pro AI Suite", "enterprise_compute", "Enterprise Compute", dll.
 */
export function findPackageFlexible(idOrName: string) {
  if (!idOrName) return null;
  const packages = db.getPackages();
  const direct = db.getPackage(idOrName);
  if (direct) return direct;

  const target = String(idOrName).toLowerCase().replace(/[-_\s]/g, "");
  return (
    packages.find((p) => {
      const pId = p.id.toLowerCase().replace(/[-_\s]/g, "");
      const pName = p.name.toLowerCase().replace(/[-_\s]/g, "");
      return (
        pId === target ||
        pName === target ||
        pId === `pkg${target}` ||
        target === `pkg${pId}` ||
        pId.includes(target) ||
        target.includes(pId) ||
        pName.includes(target) ||
        target.includes(pName)
      );
    }) || null
  );
}

// ─── Middleware: Verifikasi Webhook Secret ────────────────
const verifyWebhookSecret = (
  req: Request,
  res: Response,
  next: express.NextFunction,
) => {
  const secret =
    req.headers["webhook_secret"] ||
    req.headers["x-webhook-secret"] ||
    req.headers["authorization"]?.replace("Bearer ", "");

  if (!secret || secret !== WEBHOOK_SECRET) {
    return res.status(401).json({
      error: "Webhook secret tidak valid atau tidak ditemukan.",
      hint: "Sertakan header: webhook_secret atau X-Webhook-Secret",
    });
  }

  next();
};

// ============================================================
// POST /api/integration/webhook/purchase
// ============================================================
// Dipanggil oleh KroomBridge Panel saat user membeli paket API.
// Akan membuat Client baru dengan Secret Key otomatis.
integrationRouter.post(
  "/webhook/purchase",
  verifyWebhookSecret,
  (req: Request, res: Response) => {
    const { userName, userEmail, packageId, externalUserId, notes } = req.body;

    if (!userName || !packageId) {
      return res.status(400).json({
        error: "userName dan packageId wajib diisi dalam request body.",
        required: ["userName", "packageId"],
        optional: ["userEmail", "externalUserId", "notes"],
      });
    }

    let pkg = findPackageFlexible(packageId);
    const { packageDetails } = req.body;

    if (!pkg) {
      if (packageDetails) {
        pkg = db.createPackage({
          id: packageId,
          name: packageDetails.name || packageId,
          monthlyQuota: packageDetails.monthlyQuota || 0,
          allowedModels: packageDetails.allowedModels || ["*"],
          allowedEndpoints: packageDetails.allowedEndpoints || ["*"],
          maxRequestsPerMinute: packageDetails.maxRequestsPerMinute || 60,
          quotaType: packageDetails.quotaType === "token" ? "token" : "credit",
          costPerRequest: packageDetails.costPerRequest ? Math.max(1, Number(packageDetails.costPerRequest)) : 1,
          costPer1KTokens: packageDetails.costPer1KTokens ? Math.max(1, Number(packageDetails.costPer1KTokens)) : 20,
          allowOverage: packageDetails.allowOverage || false,
          overageRatePer1K: packageDetails.overageRatePer1K || 0,
          createdAt: new Date().toISOString(),
        });
      } else {
        return res.status(400).json({
          error: `Paket '${packageId}' tidak ditemukan di KroomBridge. Sertakan object 'packageDetails' untuk membuatnya secara otomatis.`,
          availablePackages: db
            .getPackages()
            .map((p) => ({ id: p.id, name: p.name })),
        });
      }
    } else if (packageDetails) {
      pkg = db.updatePackage(packageId, packageDetails);
    }

    // Cek apakah user sudah ada (berdasarkan externalUserId, email, atau nama)
    let existingClient = null;
    if (externalUserId) {
      existingClient = db
        .getClients()
        .find((c) => c.id === externalUserId || c.tags?.includes(`external:${externalUserId}`));
    }
    if (!existingClient && userEmail) {
      existingClient = db
        .getClients()
        .find((c) => c.email && c.email.toLowerCase() === userEmail.toLowerCase());
    }
    if (!existingClient && userName) {
      existingClient = db
        .getClients()
        .find((c) => c.name && c.name.toLowerCase() === userName.toLowerCase());
    }

    if (existingClient) {
      // Update paket jika sudah ada
      const mergedTags = [
        ...new Set([
          ...(existingClient.tags || []),
          externalUserId ? `external:${externalUserId}` : null,
        ].filter(Boolean) as string[]),
      ];

      const updated = db.updateClient(existingClient.id, {
        packageId,
        isActive: true,
        status: "active",
        tags: mergedTags,
      });

      broadcast({
        type: "client:change",
        data: { action: "updated", client: updated },
      });

      return res.status(200).json({
        message:
          "Paket klien berhasil diperbarui (klien sudah terdaftar sebelumnya).",
        action: "updated",
        data: updated,
      });
    }

    // Buat client baru
    const newClient = {
      id: externalUserId || `client_${uuidv4().replace(/-/g, "").slice(0, 12)}`,
      name: userName,
      email: userEmail || undefined,
      packageId,
      secretKey: `sk_${uuidv4().replace(/-/g, "")}`,
      usageThisMonth: 0,
      isActive: true,
      status: "active" as const,
      tags: externalUserId ? [`external:${externalUserId}`] : [],
      notes:
        notes ||
        `Dibuat otomatis via webhook pembelian dari KroomBridge Panel.`,
      createdAt: new Date().toISOString(),
    };

    db.createClient(newClient);
    broadcast({
      type: "client:change",
      data: { action: "created", client: newClient },
    });

    res.status(201).json({
      message: `User '${userName}' berhasil didaftarkan sebagai Klien API dengan paket ${pkg.name}.`,
      action: "created",
      data: {
        clientId: newClient.id,
        clientName: newClient.name,
        secretKey: newClient.secretKey,
        packageId: newClient.packageId,
        packageName: pkg.name,
        isActive: newClient.isActive,
        createdAt: newClient.createdAt,
      },
      instructions: {
        step1: `Simpan secretKey ini dengan aman di sisi KroomBridge Panel.`,
        step2: `Klien dapat menggunakan clientId + secretKey untuk mendapatkan access token.`,
        tokenEndpoint: "POST /api/auth/token",
        body: { clientId: newClient.id, clientSecret: newClient.secretKey },
      },
    });
  },
);

// ============================================================
// POST /api/integration/webhook/cancel
// ============================================================
// Dipanggil saat user membatalkan langganan / gagal bayar.
// Akan menonaktifkan klien.
integrationRouter.post(
  "/webhook/cancel",
  verifyWebhookSecret,
  (req: Request, res: Response) => {
    const { externalUserId, clientId, reason } = req.body;

    if (!externalUserId && !clientId) {
      return res.status(400).json({
        error: "externalUserId atau clientId wajib diisi.",
      });
    }

    let client;

    if (clientId) {
      client = db.getClient(clientId);
    } else if (externalUserId) {
      client = db
        .getClients()
        .find((c) => c.tags?.includes(`external:${externalUserId}`));
    }

    if (!client) {
      return res.status(404).json({ error: "Klien tidak ditemukan" });
    }

    const updated = db.updateClient(client.id, {
      isActive: false,
      status: "suspended",
      notes:
        `${client.notes || ""}\n[${new Date().toISOString()}] Langganan dibatalkan: ${reason || "Tidak ada alasan"}`.trim(),
    });

    res.json({
      message: `Klien '${client.name}' berhasil dinonaktifkan.`,
      data: updated,
    });
  },
);

// ============================================================
// POST /api/integration/webhook/upgrade
// ============================================================
// Dipanggil saat user upgrade/downgrade paket.
integrationRouter.post(
  "/webhook/upgrade",
  verifyWebhookSecret,
  (req: Request, res: Response) => {
    const { externalUserId, clientId, newPackageId, packageDetails } = req.body;

    if (!newPackageId) {
      return res.status(400).json({ error: "newPackageId wajib diisi." });
    }

    let pkg = findPackageFlexible(newPackageId);
    if (!pkg) {
      if (packageDetails) {
        pkg = db.createPackage({
          id: newPackageId,
          name: packageDetails.name || newPackageId,
          monthlyQuota: packageDetails.monthlyQuota || 0,
          allowedModels: packageDetails.allowedModels || ["*"],
          allowedEndpoints: packageDetails.allowedEndpoints || ["*"],
          maxRequestsPerMinute: packageDetails.maxRequestsPerMinute || 60,
          allowOverage: packageDetails.allowOverage || false,
          overageRatePer1K: packageDetails.overageRatePer1K || 0,
          createdAt: new Date().toISOString(),
        });
      } else {
        return res.status(400).json({
          error: `Paket '${newPackageId}' tidak ditemukan. Sertakan 'packageDetails' untuk membuatnya otomatis.`,
          availablePackages: db
            .getPackages()
            .map((p) => ({ id: p.id, name: p.name })),
        });
      }
    } else if (packageDetails) {
      pkg = db.updatePackage(pkg.id, packageDetails);
    }

    let client;
    if (clientId) {
      client = db.getClient(clientId);
    } else if (externalUserId) {
      client =
        db.getClient(externalUserId) ||
        db.getClients().find((c) => c.tags?.includes(`external:${externalUserId}`));
    }

    if (!client) {
      return res.status(404).json({ error: "Klien tidak ditemukan" });
    }

    const oldPackage = db.getPackage(client.packageId);
    const updated = db.updateClient(client.id, {
      packageId: pkg.id,
      isActive: true,
      status: "active",
    });

    broadcast({
      type: "client:change",
      data: { action: "updated", client: updated },
    });

    res.json({
      message: `Paket klien '${client.name}' berhasil diubah dari ${oldPackage?.name || client.packageId} ke ${pkg.name}.`,
      data: updated,
    });
  },
);

// ============================================================
// GET /api/integration/client-info/:clientId
// ============================================================
// Digunakan KroomBridge Panel untuk mengecek status & key klien.
integrationRouter.get(
  "/client-info/:clientId",
  verifyWebhookSecret,
  (req: Request, res: Response) => {
    let client = db.getClient(req.params.clientId);
    if (!client) {
      // Fallback: cari berdasarkan externalUserId di tags
      client =
        db
          .getClients()
          .find((c) => c.tags?.includes(`external:${req.params.clientId}`)) || null;
    }

    if (!client) {
      return res.status(404).json({ error: "Klien tidak ditemukan" });
    }

    const pkg = db.getPackage(client.packageId);
    const activeQuota = client.customQuota ?? pkg?.monthlyQuota ?? 0;

    res.json({
      clientId: client.id,
      name: client.name,
      email: client.email,
      secretKey: client.secretKey,
      keyVersion: client.keyVersion ?? 1,
      isActive: client.isActive,
      status: client.status,
      packageId: client.packageId,
      packageName: pkg?.name,
      usageThisMonth: client.usageThisMonth,
      quotaType: pkg?.quotaType || "token",
      costPerRequest: pkg?.costPerRequest || 1,
      quotaRemaining: Math.max(0, activeQuota - client.usageThisMonth),
      quotaPercentage:
        activeQuota > 0
          ? Math.min(
              100,
              Math.round((client.usageThisMonth / activeQuota) * 100),
            )
          : 0,
      lastSeen: client.lastSeen,
      createdAt: client.createdAt,
    });
  },
);

// ============================================================
// POST /api/integration/webhook/rotate-key
// ============================================================
// Dipanggil oleh Kroombox Panel saat user meminta rotasi key langsung dari Panel
integrationRouter.post(
  "/webhook/rotate-key",
  verifyWebhookSecret,
  (req: Request, res: Response) => {
    const { clientId, externalUserId } = req.body;

    if (!clientId && !externalUserId) {
      return res.status(400).json({
        error: "clientId atau externalUserId wajib diisi.",
      });
    }

    let client = clientId ? db.getClient(clientId) : null;
    if (!client && externalUserId) {
      client =
        db.getClient(externalUserId) ||
        db.getClients().find((c) => c.tags?.includes(`external:${externalUserId}`)) ||
        null;
    }

    if (!client) {
      return res.status(404).json({ error: "Klien tidak ditemukan di KroomBridge" });
    }

    const oldSecretKey = client.secretKey;
    const newSecretKey = `sk_${uuidv4().replace(/-/g, "")}`;
    const newKeyVersion = (client.keyVersion ?? 1) + 1;

    const updated = db.updateClient(client.id, {
      secretKey: newSecretKey,
      keyVersion: newKeyVersion,
    });

    broadcast({
      type: "client:change",
      data: { action: "rotated", client: updated },
    });

    res.json({
      success: true,
      message: "Secret Key berhasil dirotasi.",
      clientId: client.id,
      externalUserId: externalUserId || client.id,
      oldSecretKey,
      newSecretKey,
      keyVersion: newKeyVersion,
      rotatedAt: new Date().toISOString(),
    });
  },
);

// ============================================================
// GET /api/integration/packages
// ============================================================
// Digunakan KroomBridge Panel untuk menampilkan daftar paket yang tersedia.
integrationRouter.get(
  "/packages",
  verifyWebhookSecret,
  (req: Request, res: Response) => {
    const packages = db.getPackages().map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      description: p.description,
      monthlyQuota: p.monthlyQuota,
      quotaType: p.quotaType || "token",
      costPerRequest: p.costPerRequest || 1,
      maxRequestsPerMinute: p.maxRequestsPerMinute,
      allowOverage: p.allowOverage,
      allowedEndpoints: p.allowedEndpoints,
      allowedModels: p.allowedModels || [],
    }));

    res.json(packages);
  },
);

// ============================================================
// POST /api/integration/webhook/package
// ============================================================
// Dipanggil oleh Kroombox Panel saat membuat atau mengubah paket di Panel.
// Melakukan Upsert: jika package dengan ID tersebut sudah ada, lakukan update; jika belum, buat baru.
integrationRouter.post(
  "/webhook/package",
  verifyWebhookSecret,
  (req: Request, res: Response) => {
    const {
      id,
      name,
      monthlyQuota,
      maxRequestsPerMinute,
      quotaType,
      costPerRequest,
      costPer1KTokens,
      allowOverage,
      overageRatePer1K,
      allowedEndpoints,
      allowedModels,
      price,
      description,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Nama paket ('name') wajib diisi." });
    }

    const pkgId = id || `pkg_${uuidv4().replace(/-/g, "").slice(0, 8)}`;
    const existing = db.getPackage(pkgId);

    const resolvedQuotaType: "token" | "request" | "credit" =
      quotaType === "request" ? "request" : quotaType === "token" ? "token" : "credit";

    const payload = {
      id: pkgId,
      name,
      monthlyQuota: monthlyQuota != null ? Number(monthlyQuota) : 0,
      maxRequestsPerMinute:
        maxRequestsPerMinute != null ? Number(maxRequestsPerMinute) : 60,
      quotaType: resolvedQuotaType,
      costPerRequest:
        costPerRequest != null ? Math.max(1, Number(costPerRequest)) : 1,
      costPer1KTokens:
        costPer1KTokens != null ? Math.max(1, Number(costPer1KTokens)) : 20,
      allowOverage: !!allowOverage,
      overageRatePer1K: overageRatePer1K != null ? Number(overageRatePer1K) : 0,
      allowedEndpoints: allowedEndpoints || ["*"],
      allowedModels: allowedModels || ["*"],
      price: price != null ? Number(price) : 0,
      description: description || "",
    };

    let result;
    let action: "created" | "updated";

    if (existing) {
      result = db.updatePackage(pkgId, payload);
      action = "updated";
    } else {
      result = db.createPackage({
        ...payload,
        createdAt: new Date().toISOString(),
      });
      action = "created";
    }

    // Broadcast ke frontend KroomBridge agar halaman Packages realtime terupdate
    broadcast({
      type: "package:change",
      data: { action, package: result },
    });

    res.status(action === "created" ? 201 : 200).json({
      success: true,
      message: `Paket '${name}' (${pkgId}) berhasil di-${action} via webhook Panel.`,
      action,
      data: result,
    });
  },
);

// ============================================================
// PATCH /api/integration/webhook/package/:id
// ============================================================
// Dipanggil oleh Kroombox Panel saat mengedit sebagian field paket.
integrationRouter.patch(
  "/webhook/package/:id",
  verifyWebhookSecret,
  (req: Request, res: Response) => {
    const pkgId = req.params.id;
    const pkg = db.getPackage(pkgId);

    if (!pkg) {
      return res.status(404).json({ error: `Paket dengan ID '${pkgId}' tidak ditemukan.` });
    }

    const updates = { ...req.body };
    if (updates.maxRequestsPerMinute != null)
      updates.maxRequestsPerMinute = Number(updates.maxRequestsPerMinute);
    if (updates.monthlyQuota != null)
      updates.monthlyQuota = Number(updates.monthlyQuota);
    if (updates.costPerRequest != null)
      updates.costPerRequest = Math.max(1, Number(updates.costPerRequest));
    if (updates.costPer1KTokens != null)
      updates.costPer1KTokens = Math.max(1, Number(updates.costPer1KTokens));
    if (updates.price != null) updates.price = Number(updates.price);
    if (updates.overageRatePer1K != null)
      updates.overageRatePer1K = Number(updates.overageRatePer1K);

    const updated = db.updatePackage(pkgId, updates);

    broadcast({
      type: "package:change",
      data: { action: "updated", package: updated },
    });

    res.json({
      success: true,
      message: `Paket '${pkg.name}' (${pkgId}) berhasil diperbarui via webhook Panel.`,
      action: "updated",
      data: updated,
    });
  },
);

// ============================================================
// DELETE /api/integration/webhook/package/:id
// ============================================================
// Dipanggil oleh Kroombox Panel saat menghapus paket.
integrationRouter.delete(
  "/webhook/package/:id",
  verifyWebhookSecret,
  async (req: Request, res: Response) => {
    const pkgId = req.params.id;
    const pkg = db.getPackage(pkgId);

    if (!pkg) {
      return res.status(404).json({ error: `Paket dengan ID '${pkgId}' tidak ditemukan.` });
    }

    const isUsed = db.getClients().some((c) => c.packageId === pkgId);
    if (isUsed && !req.query.force) {
      return res.status(400).json({
        error: `Tidak dapat menghapus paket '${pkg.name}' karena masih digunakan oleh klien.`,
        hint: "Pindahkan klien ke paket lain atau gunakan parameter ?force=true untuk memaksakan penghapusan.",
      });
    }

    await db.deletePackage(pkgId);

    broadcast({
      type: "package:change",
      data: { action: "deleted", id: pkgId },
    });

    res.json({
      success: true,
      message: `Paket '${pkg.name}' (${pkgId}) berhasil dihapus via webhook Panel.`,
      action: "deleted",
      id: pkgId,
    });
  },
);

// ============================================================
// POST /api/integration/webhook/event
// ============================================================
// Endpoint terpadu untuk menerima event webhook serbaguna dari Panel
// Contoh event: "package:created", "package:updated", "package:deleted"
integrationRouter.post(
  "/webhook/event",
  verifyWebhookSecret,
  async (req: Request, res: Response) => {
    const { event, data } = req.body;
    if (!event || !data) {
      return res.status(400).json({
        error: "'event' dan 'data' wajib disertakan dalam request body.",
      });
    }

    if (event === "package:created" || event === "package:updated") {
      const pkgId = data.id || `pkg_${uuidv4().replace(/-/g, "").slice(0, 8)}`;
      const existing = db.getPackage(pkgId);
      const eventQuotaType: "token" | "request" | "credit" =
        data.quotaType === "request" ? "request" : data.quotaType === "token" ? "token" : "credit";

      const payload = {
        id: pkgId,
        name: data.name || pkgId,
        monthlyQuota: data.monthlyQuota != null ? Number(data.monthlyQuota) : 0,
        maxRequestsPerMinute:
          data.maxRequestsPerMinute != null ? Number(data.maxRequestsPerMinute) : 60,
        quotaType: eventQuotaType,
        costPerRequest:
          data.costPerRequest != null ? Math.max(1, Number(data.costPerRequest)) : 1,
        costPer1KTokens:
          data.costPer1KTokens != null ? Math.max(1, Number(data.costPer1KTokens)) : 20,
        allowOverage: !!data.allowOverage,
        overageRatePer1K:
          data.overageRatePer1K != null ? Number(data.overageRatePer1K) : 0,
        allowedEndpoints: data.allowedEndpoints || ["*"],
        allowedModels: data.allowedModels || ["*"],
        price: data.price != null ? Number(data.price) : 0,
        description: data.description || "",
      };

      let result;
      const action = existing ? "updated" : "created";
      if (existing) {
        result = db.updatePackage(pkgId, payload);
      } else {
        result = db.createPackage({
          ...payload,
          createdAt: new Date().toISOString(),
        });
      }

      broadcast({ type: "package:change", data: { action, package: result } });
      return res.json({ success: true, event, action, data: result });
    }

    if (event === "package:deleted") {
      const pkgId = data.id;
      if (pkgId && db.getPackage(pkgId)) {
        await db.deletePackage(pkgId);
        broadcast({
          type: "package:change",
          data: { action: "deleted", id: pkgId },
        });
        return res.json({ success: true, event, action: "deleted", id: pkgId });
      }
      return res.status(404).json({ error: "Paket tidak ditemukan" });
    }

    return res.status(400).json({ error: `Event '${event}' tidak dikenali.` });
  },
);

// ============================================================
// POST /api/integration/reload
// ============================================================
// Memuat ulang data dari MySQL ke memori RAM server
integrationRouter.post(
  "/reload",
  verifyWebhookSecret,
  async (req: Request, res: Response) => {
    await reloadFromMySQL();
    broadcast({ type: "package:change", data: null });
    broadcast({ type: "client:change", data: null });
    res.json({ success: true, message: "Data berhasil dimuat ulang dari MySQL ke RAM." });
  },
);

