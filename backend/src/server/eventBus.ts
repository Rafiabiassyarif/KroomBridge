// ============================================================
// EVENT BUS — Server-Sent Events untuk push realtime ke dashboard
// ============================================================
// Daripada frontend polling tiap 5 detik, server push event
// langsung saat ada perubahan: log baru, GPU update, client
// dibuat/diubah, route dipanggil, dll.
//
// Frontend subscribe via:
//   const es = new EventSource('/api/events/stream?token=...')
//   es.addEventListener('log:new', (e) => ...)

import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type ServerEvent =
  | { type: "log:new"; data: any }
  | { type: "gpu:update"; data: any }
  | { type: "client:change"; data: any }
  | { type: "route:change"; data: any }
  | { type: "package:change"; data: any }
  | { type: "security:change"; data: any }
  | { type: "admin:change"; data: any }
  | { type: "stats:tick"; data: any }
  | { type: "ping"; data: { now: string } };

interface Subscriber {
  id: string;
  res: Response;
  filter?: ServerEvent["type"][];
}

const subscribers: Map<string, Subscriber> = new Map();
let nextId = 1;

// ─── PUBLIC API ────────────────────────────────────────────
export function broadcast(event: ServerEvent) {
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  subscribers.forEach((sub) => {
    if (sub.filter && !sub.filter.includes(event.type)) return;
    try {
      sub.res.write(payload);
    } catch {
      // Connection mati, hapus subscriber
      subscribers.delete(sub.id);
    }
  });
}

export function getSubscriberCount() {
  return subscribers.size;
}

// ─── ROUTER ────────────────────────────────────────────────
export const eventRouter = express.Router();

const ADMIN_JWT_SECRET =
  process.env.ADMIN_JWT_SECRET || "kroombox_admin_super_secret!";

// EventSource tidak mendukung custom header, jadi token via query.
// Verifikasi minimal supaya stream tidak bocor ke publik.
const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  const token =
    (req.query.token as string) ||
    req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return res.status(401).json({ error: "Token diperlukan" });
  }

  try {
    jwt.verify(token, ADMIN_JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Token tidak valid" });
  }
};

eventRouter.get("/stream", verifyToken, (req, res) => {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  res.flushHeaders?.();

  const id = String(nextId++);
  const filter = req.query.filter
    ? ((req.query.filter as string).split(",") as ServerEvent["type"][])
    : undefined;

  subscribers.set(id, { id, res, filter });

  // Kirim event 'connected' awal
  res.write(
    `event: connected\ndata: ${JSON.stringify({ id, time: new Date().toISOString() })}\n\n`,
  );

  // Heartbeat tiap 25 detik supaya proxy/load balancer tidak timeout
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
      subscribers.delete(id);
    }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    subscribers.delete(id);
  });
});

// Endpoint cek subscriber count (no auth, info only)
eventRouter.get("/health", (_req, res) => {
  res.json({
    ok: true,
    subscribers: subscribers.size,
    time: new Date().toISOString(),
  });
});
