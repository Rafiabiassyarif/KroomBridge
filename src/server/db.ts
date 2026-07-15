import mysql from "mysql2/promise";

export let pool: mysql.Pool;

export const initMySQL = async () => {
  pool = mysql.createPool({
    host: "127.0.0.1",
    user: "root",
    password: "",
    database: "kroombox_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  console.log("[MySQL] Berhasil terhubung ke database kroombox_db");

  // ─── Schema migration ─────────────────────────────────────
  // Auto-add kolom baru untuk klien lama yang skema-nya belum punya.
    // Table: admins
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admins (
        id varchar(50) NOT NULL PRIMARY KEY,
        name varchar(100) NOT NULL,
        email varchar(100) NOT NULL UNIQUE,
        role varchar(50) NOT NULL DEFAULT 'Admin',
        password varchar(255) NOT NULL,
        createdAt varchar(50) DEFAULT NULL,
        lastLogin varchar(50) DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Table: packages
    await pool.query(`
      CREATE TABLE IF NOT EXISTS packages (
        id varchar(50) NOT NULL PRIMARY KEY,
        name varchar(100) NOT NULL,
        description text,
        monthlyQuota int NOT NULL DEFAULT '0',
        maxRequestsPerMinute int NOT NULL DEFAULT '60',
        quotaType varchar(50) NOT NULL DEFAULT 'request',
        allowOverage tinyint(1) NOT NULL DEFAULT '0',
        overageRatePer1K float NOT NULL DEFAULT '0',
        allowedEndpoints json DEFAULT NULL,
        price int DEFAULT NULL,
        createdAt varchar(50) DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Table: clients
    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id varchar(50) NOT NULL PRIMARY KEY,
        name varchar(100) NOT NULL,
        email varchar(100) DEFAULT NULL,
        status varchar(50) NOT NULL DEFAULT 'active',
        packageId varchar(50) NOT NULL,
        secretKey varchar(255) NOT NULL,
        keyVersion int NOT NULL DEFAULT '1',
        usageThisMonth int NOT NULL DEFAULT '0',
        isActive tinyint(1) NOT NULL DEFAULT '1',
        quotaAlertSent tinyint(1) DEFAULT '0',
        customQuota int DEFAULT NULL,
        createdAt varchar(50) DEFAULT NULL,
        lastSeen varchar(50) DEFAULT NULL,
        lastReset varchar(50) DEFAULT NULL,
        lastAnnualQuotaReset varchar(50) DEFAULT NULL,
        tags json DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Table: logs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id varchar(100) NOT NULL PRIMARY KEY,
        timestamp varchar(50) NOT NULL,
        clientId varchar(50) DEFAULT NULL,
        clientName varchar(100) DEFAULT NULL,
        routeId varchar(50) DEFAULT NULL,
        method varchar(20) NOT NULL,
        path varchar(500) NOT NULL,
        statusCode int NOT NULL,
        durationMs int NOT NULL DEFAULT '0',
        ipAddress varchar(100) DEFAULT NULL,
        userAgent text,
        error text,
        KEY idx_logs_clientId (clientId),
        KEY idx_logs_routeId (routeId),
        KEY idx_logs_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Table: routes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS routes (
        id varchar(50) NOT NULL PRIMARY KEY,
        name varchar(100) DEFAULT NULL,
        path varchar(255) NOT NULL UNIQUE,
        upstreamUrl varchar(500) NOT NULL,
        description text,
        isActive tinyint(1) NOT NULL DEFAULT '1',
        method varchar(20) NOT NULL DEFAULT 'ALL',
        timeout int DEFAULT NULL,
        headers json DEFAULT NULL,
        transformations json DEFAULT NULL,
        createdAt varchar(50) DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Table: settings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        setting_key varchar(50) NOT NULL PRIMARY KEY,
        setting_value json DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    try {
      await pool.query(
        "ALTER TABLE clients ADD COLUMN IF NOT EXISTS keyVersion INT NULL DEFAULT 1",
      );
    } catch (err: any) {
    // MySQL versi lama (< 8.0) tidak support IF NOT EXISTS di ALTER TABLE.
    // Fallback: cek information_schema dulu.
    if (
      err?.code === "ER_PARSE_ERROR" ||
      String(err?.message || "").includes("syntax")
    ) {
      try {
        const [cols]: any = await pool.query(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clients' AND COLUMN_NAME = 'keyVersion'",
        );
        if (Array.isArray(cols) && cols.length === 0) {
          await pool.query(
            "ALTER TABLE clients ADD COLUMN keyVersion INT NULL DEFAULT 1",
          );
        }
      } catch {
        /* ignore — admin akan kena warning di log saja */
      }
    }
  }

  // Sinkronisasi awal: Load dari MySQL ke RAM
  const [admins] = await pool.query("SELECT * FROM admins");
  const [packages] = await pool.query("SELECT * FROM packages");
  const [clients] = await pool.query("SELECT * FROM clients");
  const [routes] = await pool.query("SELECT * FROM routes");
  const [logs] = await pool.query(
    "SELECT * FROM logs ORDER BY timestamp DESC LIMIT 5000",
  );
  const [settings] = await pool.query("SELECT * FROM settings");

  const formattedPackages = (packages as any[]).map((p) => ({
    ...p,
    allowedEndpoints:
      typeof p.allowedEndpoints === "string"
        ? JSON.parse(p.allowedEndpoints)
        : p.allowedEndpoints,
    allowOverage: !!p.allowOverage,
  }));
  const formattedClients = (clients as any[]).map((c) => ({
    ...c,
    tags: typeof c.tags === "string" ? JSON.parse(c.tags) : c.tags,
    isActive: !!c.isActive,
  }));
  const formattedRoutes = (routes as any[]).map((r) => ({
    ...r,
    headers: typeof r.headers === "string" ? JSON.parse(r.headers) : r.headers,
    transformations:
      typeof r.transformations === "string"
        ? JSON.parse(r.transformations)
        : r.transformations,
    isActive: !!r.isActive,
  }));

  let security: any = null;
  let meta: any = null;
  (settings as any[]).forEach((s) => {
    if (s.setting_key === "security")
      security =
        typeof s.setting_value === "string"
          ? JSON.parse(s.setting_value)
          : s.setting_value;
    if (s.setting_key === "meta")
      meta =
        typeof s.setting_value === "string"
          ? JSON.parse(s.setting_value)
          : s.setting_value;
  });

  db.setData({
    admins: admins as any,
    packages: formattedPackages as any,
    clients: formattedClients as any,
    routes: formattedRoutes as any,
    logs: logs as any,
    security: security || defaultData.security,
    meta: meta || defaultData.meta,
    usageRecords: [],
  });
};

export type Package = {
  id: string;
  name: string;
  maxRequestsPerMinute: number;
  monthlyQuota: number;
  quotaType?: "token" | "request";
  allowOverage: boolean;
  overageRatePer1K: number;
  allowedEndpoints: string[];
  price?: number;
  description?: string;
  createdAt?: string;
};

export type Client = {
  id: string;
  name: string;
  email?: string;
  status?: "pending" | "active" | "suspended";
  packageId: string;
  secretKey: string;
  // Dinaikkan setiap kali secret key di-rotasi. Access token JWT
  // di-stamp dengan keyVersion saat issuance; gateway reject token
  // dengan keyVersion lebih kecil dari yang sekarang. Default 1 untuk
  // klien lama yang belum punya field ini.
  keyVersion?: number;
  usageThisMonth: number;
  isActive: boolean;
  quotaAlertSent?: boolean;
  customQuota?: number | null;
  createdAt?: string;
  lastSeen?: string;
  lastReset?: string;
  tags?: string[];
  notes?: string;
};

export type SecurityConfig = {
  ipAllowlist: { ip: string; label: string }[];
  ipDenylist: { ip: string; reason: string }[];
  rateLimitAnomalyDetection: boolean;
  upstreamValidationShield: boolean;
  requireHttps?: boolean;
  maxBodySizeKb?: number;
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  password?: string;
  createdAt?: string;
  lastLogin?: string;
};

export type Route = {
  id: string;
  path: string;
  upstreamUrl: string;
  description: string;
  isActive: boolean;
  method?: "ALL" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  timeout?: number;
  headers?: Record<string, string>;
  transformations?: {
    requestBodyMap?: Record<string, string>;
    responseBodyMap?: Record<string, string>;
    requestBodyOverride?: Record<string, any>;
  };
  createdAt?: string;
};

export type ApiLog = {
  id: string;
  timestamp: string;
  clientId: string;
  clientName?: string;
  routeId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  ipAddress?: string;
  userAgent?: string;
  error?: string;
};

export type UsageRecord = {
  id: string;
  clientId: string;
  date: string;
  requestCount: number;
  tokenCount: number;
  errorCount: number;
};

export type ApiKey = {
  id: string;
  name: string;
  key: string;
  provider: string; // e.g., "kroma"
  createdAt: string;
};

export type DatabaseSchema = {
  packages: Package[];
  clients: Client[];
  security: SecurityConfig;
  admins: AdminUser[];
  routes: Route[];
  logs: ApiLog[];
  usageRecords: UsageRecord[];
  meta: {
    lastQuotaReset: string;
    version: string;
    quotaResetDay?: number;
    quotaResetMonth?: number;
    quotaResetMode?: "monthly" | "purchase" | "annual";
    lastAnnualQuotaReset?: string;
    kromaApiKey?: string;
    apiKeys?: ApiKey[];
  };
};

const defaultData: DatabaseSchema = {
  packages: [],
  clients: [],
  security: {
    ipAllowlist: [],
    ipDenylist: [],
    rateLimitAnomalyDetection: true,
    upstreamValidationShield: true,
    requireHttps: false,
    maxBodySizeKb: 512,
  },
  admins: [
    {
      id: "admin_sys",
      name: "Admin",
      email: "admin@kroombox.id",
      role: "Admin",
      password: "admin123",
      createdAt: new Date().toISOString(),
    },
  ],
  routes: [],
  logs: [],
  usageRecords: [],
  meta: {
    lastQuotaReset: new Date().toISOString().slice(0, 7),
    version: "1.0.0",
    quotaResetDay: 1,
    quotaResetMonth: 1,
    quotaResetMode: "monthly",
    lastAnnualQuotaReset: "",
    kromaApiKey: "",
    apiKeys: [],
  },
};

export class DatabaseCache {
  private data: DatabaseSchema;

  setData(newData: DatabaseSchema) {
    this.data = newData;
  }

  constructor() {
    this.data = { ...defaultData };
  }

  // ─── ADMINS ──────────────────────────────────────────────
  getAdmins(): AdminUser[] {
    return this.data.admins;
  }
  getAdminByEmail(email: string) {
    return this.data.admins.find((a) => a.email === email);
  }
  createAdmin(admin: AdminUser) {
    this.data.admins.push(admin);
    if (pool)
      pool
        .query("INSERT IGNORE INTO admins SET ?", [admin])
        .catch(console.error);
    return admin;
  }
  updateAdmin(id: string, updates: Partial<AdminUser>) {
    const idx = this.data.admins.findIndex((a) => a.id === id);
    if (idx === -1) return null;
    this.data.admins[idx] = { ...this.data.admins[idx], ...updates };
    if (pool)
      pool
        .query("UPDATE admins SET ? WHERE id = ?", [updates, id])
        .catch(console.error);
    return this.data.admins[idx];
  }
  async deleteAdmin(id: string) {
    const idx = this.data.admins.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    if (pool) {
      await pool.query("DELETE FROM admins WHERE id = ?", [id]);
    }
    this.data.admins.splice(idx, 1);
    return true;
  }

  // ─── PACKAGES ────────────────────────────────────────────
  getPackages(): Package[] {
    return this.data.packages;
  }
  getPackage(id: string) {
    return this.data.packages.find((p) => p.id === id);
  }
  createPackage(pkg: Package) {
    this.data.packages.push(pkg);
    if (pool) {
      const row = {
        ...pkg,
        allowedEndpoints: JSON.stringify(pkg.allowedEndpoints || []),
      };
      pool
        .query("INSERT IGNORE INTO packages SET ?", [row])
        .catch(console.error);
    }
    return pkg;
  }
  updatePackage(id: string, updates: Partial<Package>) {
    const idx = this.data.packages.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    this.data.packages[idx] = { ...this.data.packages[idx], ...updates };
    if (pool) {
      const u = { ...updates };
      if (u.allowedEndpoints)
        u.allowedEndpoints = JSON.stringify(u.allowedEndpoints) as any;
      pool
        .query("UPDATE packages SET ? WHERE id = ?", [u, id])
        .catch(console.error);
    }
    return this.data.packages[idx];
  }
  async deletePackage(id: string) {
    const idx = this.data.packages.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    if (pool) {
      await pool.query("DELETE FROM packages WHERE id = ?", [id]);
    }
    this.data.packages.splice(idx, 1);
    return true;
  }

  // ─── CLIENTS ─────────────────────────────────────────────
  getClients(): Client[] {
    return this.data.clients;
  }
  getClient(id: string) {
    return this.data.clients.find((c) => c.id === id);
  }
  getClientBySecretKey(secretKey: string) {
    return this.data.clients.find((c) => c.secretKey === secretKey);
  }
  createClient(client: Client) {
    this.data.clients.push(client);
    if (pool) {
      const row = { ...client, tags: JSON.stringify(client.tags || []) };
      pool
        .query("INSERT IGNORE INTO clients SET ?", [row])
        .catch(console.error);
    }
    return client;
  }
  updateClient(id: string, updates: Partial<Client>) {
    const idx = this.data.clients.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    this.data.clients[idx] = { ...this.data.clients[idx], ...updates };
    if (pool) {
      const u = { ...updates };
      if (u.tags) u.tags = JSON.stringify(u.tags) as any;
      pool
        .query("UPDATE clients SET ? WHERE id = ?", [u, id])
        .catch(console.error);
    }
    return this.data.clients[idx];
  }
  async deleteClient(id: string) {
    const idx = this.data.clients.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    if (pool) {
      await pool.query("DELETE FROM clients WHERE id = ?", [id]);
    }
    this.data.clients.splice(idx, 1);
    return true;
  }
  incrementUsage(clientId: string, amount: number = 1) {
    const client = this.getClient(clientId);
    if (!client) return;
    client.usageThisMonth += amount;
    if (pool)
      pool
        .query("UPDATE clients SET usageThisMonth = ? WHERE id = ?", [
          client.usageThisMonth,
          clientId,
        ])
        .catch(console.error);
  }

  // ─── ROUTES ──────────────────────────────────────────────
  getRoutes(): Route[] {
    return this.data.routes;
  }
  getRoute(id: string) {
    return this.data.routes.find((r) => r.id === id);
  }
  createRoute(route: Route) {
    this.data.routes.push(route);
    if (pool) {
      const row = {
        ...route,
        headers: JSON.stringify(route.headers || {}),
        transformations: JSON.stringify(route.transformations || {}),
      };
      pool.query("INSERT IGNORE INTO routes SET ?", [row]).catch(console.error);
    }
    return route;
  }
  updateRoute(id: string, updates: Partial<Route>) {
    const idx = this.data.routes.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    this.data.routes[idx] = { ...this.data.routes[idx], ...updates };
    if (pool) {
      const u = { ...updates };
      if (u.headers) u.headers = JSON.stringify(u.headers) as any;
      if (u.transformations)
        u.transformations = JSON.stringify(u.transformations) as any;
      pool
        .query("UPDATE routes SET ? WHERE id = ?", [u, id])
        .catch(console.error);
    }
    return this.data.routes[idx];
  }
  async deleteRoute(id: string) {
    const idx = this.data.routes.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    if (pool) {
      await pool.query("DELETE FROM routes WHERE id = ?", [id]);
    }
    this.data.routes.splice(idx, 1);
    return true;
  }

  getSecurity(): SecurityConfig {
    return this.data.security;
  }
  updateSecurity(updates: Partial<SecurityConfig>) {
    this.data.security = { ...this.data.security, ...updates };
    if (pool)
      pool
        .query(
          "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
          ["security", JSON.stringify(this.data.security)],
        )
        .catch(console.error);
    return this.data.security;
  }
  addToIpAllowlist(ip: string, label: string) {
    const allowlist = this.data.security.ipAllowlist || [];
    if (!allowlist.some((item) => item.ip === ip)) {
      allowlist.push({ ip, label });
    }
    this.data.security.ipAllowlist = allowlist;
    if (pool)
      pool
        .query(
          "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
          ["security", JSON.stringify(this.data.security)],
        )
        .catch(console.error);
    return this.data.security;
  }
  removeFromIpAllowlist(ip: string) {
    this.data.security.ipAllowlist = (
      this.data.security.ipAllowlist || []
    ).filter((item) => item.ip !== ip);
    if (pool)
      pool
        .query(
          "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
          ["security", JSON.stringify(this.data.security)],
        )
        .catch(console.error);
    return this.data.security;
  }
  addToIpDenylist(ip: string, reason: string) {
    const denylist = this.data.security.ipDenylist || [];
    if (!denylist.some((item) => item.ip === ip)) {
      denylist.push({ ip, reason });
    }
    this.data.security.ipDenylist = denylist;
    if (pool)
      pool
        .query(
          "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
          ["security", JSON.stringify(this.data.security)],
        )
        .catch(console.error);
    return this.data.security;
  }
  removeFromIpDenylist(ip: string) {
    this.data.security.ipDenylist = (
      this.data.security.ipDenylist || []
    ).filter((item) => item.ip !== ip);
    if (pool)
      pool
        .query(
          "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
          ["security", JSON.stringify(this.data.security)],
        )
        .catch(console.error);
    return this.data.security;
  }

  // ─── LOGS ────────────────────────────────────────────────
  getLogs(limit: number = 100): ApiLog[] {
    return this.data.logs.slice(0, limit);
  }
  addLog(log: Omit<ApiLog, "id">) {
    const newLog = { id: `log_${Date.now()}`, ...log };
    this.data.logs.unshift(newLog);
    if (this.data.logs.length > 5000)
      this.data.logs = this.data.logs.slice(0, 5000);
    if (pool)
      pool
        .query("INSERT IGNORE INTO logs SET ?", [newLog])
        .catch(console.error);
    return newLog;
  }
  clearLogs() {
    const c = this.data.logs.length;
    this.data.logs = [];
    if (pool) pool.query("TRUNCATE TABLE logs").catch(console.error);
    return c;
  }
  getLogsByClient(clientId: string, limit: number = 50) {
    return this.data.logs
      .filter((l) => l.clientId === clientId)
      .slice(0, limit);
  }
  resetAllQuotas() {
    let c = 0;
    this.data.clients = this.data.clients.map((cl) => {
      if (cl.usageThisMonth > 0) {
        c++;
        return { ...cl, usageThisMonth: 0 };
      }
      return cl;
    });
    if (pool)
      pool
        .query("UPDATE clients SET usageThisMonth = 0 WHERE usageThisMonth > 0")
        .catch(console.error);
    return c;
  }

  resetMonthlyUsage() {
    const count = this.resetAllQuotas();
    this.data.meta.lastQuotaReset = new Date().toISOString().slice(0, 7);
    if (pool)
      pool
        .query(
          "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
          ["meta", JSON.stringify(this.data.meta)],
        )
        .catch(console.error);
    return count;
  }

  getMeta() {
    return this.data.meta;
  }

  updateMeta(updates: Partial<typeof defaultData.meta>) {
    this.data.meta = { ...this.data.meta, ...updates };
    if (pool)
      pool
        .query(
          "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
          ["meta", JSON.stringify(this.data.meta)],
        )
        .catch(console.error);
    return this.data.meta;
  }

  getUsageStats(clientId?: string): UsageRecord[] {
    if (clientId) {
      return this.data.usageRecords.filter((r) => r.clientId === clientId);
    }
    return this.data.usageRecords;
  }

  // ─── STATS ───────────────────────────────────────────────
  getDashboardStats() {
    let errorCount = 0;
    let totalDuration = 0;
    const reqsPerRouteObj: Record<string, number> = {};
    const statusBreakdown: Record<string, number> = {};

    const now = Date.now();
    const oneMinAgo = now - 60_000;
    const twoMinAgo = now - 120_000;
    let rpm = 0;
    let rpmPrev = 0;

    this.data.logs.forEach((log) => {
      const t = new Date(log.timestamp).getTime();
      if (t >= oneMinAgo && t <= now) rpm++;
      else if (t >= twoMinAgo && t < oneMinAgo) rpmPrev++;

      if (log.statusCode >= 400) errorCount++;
      totalDuration += log.durationMs || 0;

      const routeId = log.routeId || "unknown";
      reqsPerRouteObj[routeId] = (reqsPerRouteObj[routeId] || 0) + 1;

      const code = String(log.statusCode);
      statusBreakdown[code] = (statusBreakdown[code] || 0) + 1;
    });

    const avgResponseTime =
      this.data.logs.length > 0
        ? Math.round(totalDuration / this.data.logs.length)
        : 0;

    const requestsPerRoute = Object.entries(reqsPerRouteObj)
      .map(([id, count]) => {
        const route = this.getRoute(id);
        return { path: route ? route.path : id, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      summary: {
        activeClients: this.data.clients.filter((c) => c.isActive).length,
        suspendedClients: this.data.clients.filter((c) => !c.isActive).length,
        totalClients: this.data.clients.length,
        totalRequests: this.data.logs.length,
        activeRoutes: this.data.routes.filter((r) => r.isActive).length,
        totalRoutes: this.data.routes.length,
        totalPackages: this.data.packages.length,
        successRate:
          this.data.logs.length > 0
            ? Math.round(
                ((this.data.logs.length - errorCount) / this.data.logs.length) *
                  100,
              )
            : 100,
        avgResponseTime,
        errorCount,
        rpm,
        rpmDelta: rpm - rpmPrev,
      },
      topClients: this.data.clients
        .sort((a, b) => b.usageThisMonth - a.usageThisMonth)
        .slice(0, 5)
        .map((c) => ({
          id: c.id,
          name: c.name,
          usage: c.usageThisMonth,
          packageId: c.packageId,
        })),
      requestsPerRoute,
      statusBreakdown,
      recentLogs: this.data.logs.slice(0, 20),
      meta: this.data.meta,
    };
  }
}

export const db = new DatabaseCache();
