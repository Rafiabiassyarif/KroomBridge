import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { db } from "./db.js";

export const integrationRouter = express.Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "kroombridge_126";

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

    let pkg = db.getPackage(packageId);
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

    // Cek apakah user sudah ada (berdasarkan externalUserId)
    if (externalUserId) {
      const existingClient = db
        .getClients()
        .find((c) => c.tags?.includes(`external:${externalUserId}`));
      if (existingClient) {
        // Update paket jika sudah ada
        const updated = db.updateClient(existingClient.id, {
          packageId,
          isActive: true,
          status: "active",
        });
        return res.status(200).json({
          message:
            "Paket klien berhasil diperbarui (klien sudah terdaftar sebelumnya).",
          action: "updated",
          data: updated,
        });
      }
    }

    // Buat client baru
    const newClient = {
      id: `client_${uuidv4().replace(/-/g, "").slice(0, 12)}`,
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

    let pkg = db.getPackage(newPackageId);
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
      pkg = db.updatePackage(newPackageId, packageDetails);
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

    const oldPackage = db.getPackage(client.packageId);
    const updated = db.updateClient(client.id, {
      packageId: newPackageId,
      isActive: true,
      status: "active",
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
// Digunakan KroomBridge Panel untuk mengecek status klien.
integrationRouter.get(
  "/client-info/:clientId",
  verifyWebhookSecret,
  (req: Request, res: Response) => {
    const client = db.getClient(req.params.clientId);

    if (!client) {
      return res.status(404).json({ error: "Klien tidak ditemukan" });
    }

    const pkg = db.getPackage(client.packageId);
    const activeQuota = client.customQuota ?? pkg?.monthlyQuota ?? 0;

    res.json({
      clientId: client.id,
      name: client.name,
      email: client.email,
      isActive: client.isActive,
      status: client.status,
      packageId: client.packageId,
      packageName: pkg?.name,
      usageThisMonth: client.usageThisMonth,
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
      maxRequestsPerMinute: p.maxRequestsPerMinute,
      allowOverage: p.allowOverage,
      allowedEndpoints: p.allowedEndpoints,
      allowedModels: p.allowedModels || [],
    }));

    res.json(packages);
  },
);
