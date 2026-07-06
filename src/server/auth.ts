import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "./db.js";

export const authRouter = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "kroombox_super_secret_key_123!";
const REFRESH_SECRET =
  process.env.REFRESH_SECRET || "kroombox_super_refresh_secret!";

// Token lifetime — default 'never' (gak ada exp claim sama sekali) biar
// testing gak ribet. Token tetap di-revoke secara otomatis kalau secret
// key di-rotasi (lihat keyVersion check di bawah). Untuk production,
// set env JWT_ACCESS_TTL=15m dan JWT_REFRESH_TTL=7d.
//
// Nilai 'never' (atau 'forever' / '0' / 'inf') = JWT tanpa exp claim.
// Nilai '15m' / '7d' / '365d' = lifespan biasa.
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || "never";
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || "never";
const ACCESS_TTL_SECONDS = ttlToSeconds(ACCESS_TTL);

/** Cek apakah TTL string menandakan "never expires" (skip exp claim). */
function isNeverExpiry(ttl: string): boolean {
  const v = String(ttl).trim().toLowerCase();
  return (
    v === "never" ||
    v === "forever" ||
    v === "0" ||
    v === "inf" ||
    v === "infinity"
  );
}

/** Build JWT sign options dari TTL string. Kalau "never", omit expiresIn
 *  → JWT tanpa exp claim, valid forever (kecuali keyVersion di-bump). */
function jwtSignOptions(ttl: string): jwt.SignOptions {
  if (isNeverExpiry(ttl)) return {};
  return { expiresIn: ttl as jwt.SignOptions["expiresIn"] };
}

/** Konversi durasi string (mis. '15m', '7d', '365d') ke detik untuk
 *  field `expires_in` di response token. Kalau "never", return 0
 *  (RFC 6749 gak define cara express "never expire", tapi 0 paling
 *  unambiguous: client tau gak perlu refresh). */
function ttlToSeconds(ttl: string): number {
  if (isNeverExpiry(ttl)) return 0;
  const m = String(ttl)
    .trim()
    .match(/^(\d+)\s*([smhd])?$/i);
  if (!m) return 365 * 24 * 3600;
  const n = parseInt(m[1], 10);
  const unit = (m[2] || "s").toLowerCase();
  const multiplier =
    unit === "s" ? 1 : unit === "m" ? 60 : unit === "h" ? 3600 : 86400;
  return n * multiplier;
}

// ─── POST /api/auth/token ─────────────────────────────────
// Mendapatkan Access Token menggunakan Client ID + Secret Key
authRouter.post("/token", (req: Request, res: Response) => {
  const { clientId, clientSecret } = req.body;

  if (!clientId || !clientSecret) {
    return res.status(400).json({
      error: "clientId dan clientSecret wajib diisi",
      hint: 'Kirim body: { "clientId": "...", "clientSecret": "..." }',
    });
  }

  const client = db.getClient(clientId);

  if (!client) {
    return res.status(401).json({ error: "Client ID tidak ditemukan" });
  }

  if (client.secretKey !== clientSecret) {
    return res.status(401).json({ error: "Client Secret tidak valid" });
  }

  if (!client.isActive) {
    return res.status(403).json({
      error:
        "Akun klien ditangguhkan. Hubungi admin untuk mengaktifkan kembali.",
    });
  }

  const pkg = db.getPackage(client.packageId);
  if (!pkg) {
    return res
      .status(500)
      .json({ error: "Paket klien tidak valid. Hubungi admin." });
  }

  const payload = {
    clientId: client.id,
    packageId: client.packageId,
    clientName: client.name,
    keyVersion: client.keyVersion ?? 1,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, jwtSignOptions(ACCESS_TTL));
  const refreshToken = jwt.sign(
    payload,
    REFRESH_SECRET,
    jwtSignOptions(REFRESH_TTL),
  );

  // Update lastSeen
  db.updateClient(client.id, { lastSeen: new Date().toISOString() });

  res.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECONDS,
    client_id: client.id,
    client_name: client.name,
    package: pkg.name,
    quota_remaining:
      (client.customQuota ?? pkg.monthlyQuota) - client.usageThisMonth,
  });
});

// ─── POST /api/auth/refresh ───────────────────────────────
// Mendapatkan Access Token baru menggunakan Refresh Token
authRouter.post("/refresh", (req: Request, res: Response) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: "refresh_token wajib diisi" });
  }

  try {
    const decoded = jwt.verify(refresh_token, REFRESH_SECRET) as any;
    const client = db.getClient(decoded.clientId);

    if (!client) {
      return res.status(401).json({ error: "Client tidak ditemukan" });
    }

    if (!client.isActive) {
      return res.status(403).json({
        error: "Akun klien ditangguhkan. Token tidak dapat diperbarui.",
      });
    }

    // Cek keyVersion: kalau secret key udah di-rotasi setelah refresh
    // token ini di-issue, refresh token harus di-revoke juga.
    const currentKeyVersion = client.keyVersion ?? 1;
    if ((decoded.keyVersion ?? 1) < currentKeyVersion) {
      return res.status(401).json({
        error: "Refresh token sudah dicabut karena Secret Key di-rotasi.",
        hint: "Login ulang dengan Secret Key baru via POST /api/auth/token.",
      });
    }

    const payload = {
      clientId: client.id,
      packageId: client.packageId,
      clientName: client.name,
      keyVersion: currentKeyVersion,
    };

    const newAccessToken = jwt.sign(
      payload,
      JWT_SECRET,
      jwtSignOptions(ACCESS_TTL),
    );

    res.json({
      access_token: newAccessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TTL_SECONDS,
    });
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        error: "Refresh token sudah kedaluwarsa. Silakan login ulang.",
      });
    }
    return res.status(401).json({ error: "Refresh token tidak valid" });
  }
});

// ─── POST /api/auth/validate ──────────────────────────────
// Validasi Access Token (untuk internal use)
authRouter.post("/validate", (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ valid: false, error: "Token tidak ditemukan di header" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const client = db.getClient(decoded.clientId);

    if (!client || !client.isActive) {
      return res.status(403).json({
        valid: false,
        error: "Klien tidak aktif atau tidak ditemukan",
      });
    }

    // Reject token kalau secret key udah di-rotasi setelah token issued
    const currentKeyVersion = client.keyVersion ?? 1;
    if ((decoded.keyVersion ?? 1) < currentKeyVersion) {
      return res.status(401).json({
        valid: false,
        error: "Token sudah dicabut karena Secret Key di-rotasi.",
      });
    }

    const pkg = db.getPackage(client.packageId);
    const activeQuota = client.customQuota ?? (pkg?.monthlyQuota || 0);

    res.json({
      valid: true,
      client: {
        id: client.id,
        name: client.name,
        packageId: client.packageId,
        packageName: pkg?.name,
        usageThisMonth: client.usageThisMonth,
        quotaRemaining: activeQuota - client.usageThisMonth,
      },
    });
  } catch (err: any) {
    return res.status(401).json({
      valid: false,
      error:
        err.name === "TokenExpiredError"
          ? "Token sudah kedaluwarsa"
          : "Token tidak valid",
    });
  }
});
