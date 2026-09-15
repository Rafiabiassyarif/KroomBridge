import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

export let pool: mysql.Pool;

export const initMySQL = async () => {
  let host = process.env.DB_HOST || "127.0.0.1";
  let user = process.env.DB_USER || "root";
  let password = process.env.DB_PASSWORD || "";
  let database = process.env.DB_NAME || "kroombridge";
  let port = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306;

  if (process.env.DATABASE_URL) {
    try {
      const parsedUrl = new URL(process.env.DATABASE_URL);
      if (parsedUrl.hostname) host = parsedUrl.hostname;
      if (parsedUrl.port) port = parseInt(parsedUrl.port);
      if (parsedUrl.username) user = decodeURIComponent(parsedUrl.username);
      if (parsedUrl.password) password = decodeURIComponent(parsedUrl.password);
      if (parsedUrl.pathname) {
        const dbFromPath = parsedUrl.pathname.replace(/^\//, "");
        if (dbFromPath) database = dbFromPath;
      }
    } catch {
      // jika bukan format URL standar, gunakan fallback variabel di atas
    }
  }

  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  console.log(`[MySQL] Berhasil terhubung ke database ${database} di ${host}:${port}`);

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
        quotaType varchar(50) NOT NULL DEFAULT 'credit',
        costPerRequest int NOT NULL DEFAULT '1',
        costPer1KTokens int NOT NULL DEFAULT '20',
        allowOverage tinyint(1) NOT NULL DEFAULT '0',
        overageRatePer1K float NOT NULL DEFAULT '0',
        allowedEndpoints json DEFAULT NULL,
        allowedModels json DEFAULT NULL,
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

  try {
    await pool.query(
      "ALTER TABLE packages ADD COLUMN IF NOT EXISTS allowedModels json DEFAULT NULL",
    );
  } catch (err: any) {
    if (
      err?.code === "ER_PARSE_ERROR" ||
      String(err?.message || "").includes("syntax")
    ) {
      try {
        const [cols]: any = await pool.query(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages' AND COLUMN_NAME = 'allowedModels'",
        );
        if (Array.isArray(cols) && cols.length === 0) {
          await pool.query(
            "ALTER TABLE packages ADD COLUMN allowedModels json DEFAULT NULL",
          );
        }
      } catch {
      }
    }
  }

  try {
    await pool.query(
      "ALTER TABLE packages ADD COLUMN IF NOT EXISTS costPerRequest INT NOT NULL DEFAULT 1",
    );
  } catch (err: any) {
    if (
      err?.code === "ER_PARSE_ERROR" ||
      String(err?.message || "").includes("syntax")
    ) {
      try {
        const [cols]: any = await pool.query(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages' AND COLUMN_NAME = 'costPerRequest'",
        );
        if (Array.isArray(cols) && cols.length === 0) {
          await pool.query(
            "ALTER TABLE packages ADD COLUMN costPerRequest INT NOT NULL DEFAULT 1",
          );
        }
      } catch {
      }
    }
  }

  try {
    await pool.query(
      "ALTER TABLE packages ADD COLUMN IF NOT EXISTS costPer1KTokens INT NOT NULL DEFAULT 20",
    );
  } catch (err: any) {
    if (
      err?.code === "ER_PARSE_ERROR" ||
      String(err?.message || "").includes("syntax")
    ) {
      try {
        const [cols]: any = await pool.query(
          "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages' AND COLUMN_NAME = 'costPer1KTokens'",
        );
        if (Array.isArray(cols) && cols.length === 0) {
          await pool.query(
            "ALTER TABLE packages ADD COLUMN costPer1KTokens INT NOT NULL DEFAULT 20",
          );
        }
      } catch {
      }
    }
  }

  // ─── Default Package Seeder ──────────────────────────────────
  try {
    const [pkgCount]: any = await pool.query("SELECT COUNT(*) as cnt FROM packages");
    if (pkgCount && pkgCount[0]?.cnt === 0) {
      console.log("[MySQL] Tabel packages kosong, melakukan seeding paket default...");
      const defaultInitialPackages = [
        {
          id: "pkg_free",
          name: "Free",
          description: "Akses uji coba gratis dengan saldo awal Rp 5.000 untuk semua model AI.",
          monthlyQuota: 5000,
          maxRequestsPerMinute: 30,
          quotaType: "credit",
          allowOverage: 0,
          overageRatePer1K: 0,
          allowedEndpoints: JSON.stringify(["*"]),
          allowedModels: JSON.stringify(["*"]),
          price: 0,
          costPerRequest: 1,
          costPer1KTokens: 20,
          createdAt: new Date().toISOString(),
        },
        {
          id: "pkg_starter",
          name: "Starter",
          description: "Paket Starter - Saldo AI Rp 25.000 untuk kebutuhan awal dan testing",
          monthlyQuota: 35000,
          maxRequestsPerMinute: 60,
          quotaType: "credit",
          allowOverage: 0,
          overageRatePer1K: 0,
          allowedEndpoints: JSON.stringify(["*"]),
          allowedModels: JSON.stringify(["*"]),
          price: 35000,
          costPerRequest: 1,
          costPer1KTokens: 20,
          createdAt: new Date().toISOString(),
        },
        {
          id: "pkg_basic",
          name: "Basic",
          description: "Paket Basic - Saldo AI Rp 50.000 untuk penggunaan personal & project kecil",
          monthlyQuota: 65000,
          maxRequestsPerMinute: 100,
          quotaType: "credit",
          allowOverage: 0,
          overageRatePer1K: 0,
          allowedEndpoints: JSON.stringify(["*"]),
          allowedModels: JSON.stringify(["*"]),
          price: 65000,
          costPerRequest: 1,
          costPer1KTokens: 20,
          createdAt: new Date().toISOString(),
        },
        {
          id: "pkg_pro",
          name: "Pro",
          description: "Paket Pro - Saldo AI Rp 100.000 untuk developer & freelancer aktif",
          monthlyQuota: 125000,
          maxRequestsPerMinute: 150,
          quotaType: "credit",
          allowOverage: 0,
          overageRatePer1K: 0,
          allowedEndpoints: JSON.stringify(["*"]),
          allowedModels: JSON.stringify(["*"]),
          price: 125000,
          costPerRequest: 1,
          costPer1KTokens: 20,
          createdAt: new Date().toISOString(),
        },
        {
          id: "pkg_business",
          name: "Business",
          description: "Paket Business - Saldo AI Rp 250.000 untuk tim dan aplikasi produksi",
          monthlyQuota: 300000,
          maxRequestsPerMinute: 300,
          quotaType: "credit",
          allowOverage: 0,
          overageRatePer1K: 0,
          allowedEndpoints: JSON.stringify(["*"]),
          allowedModels: JSON.stringify(["*"]),
          price: 300000,
          costPerRequest: 1,
          costPer1KTokens: 20,
          createdAt: new Date().toISOString(),
        },
        {
          id: "pkg_enterprise",
          name: "Enterprise",
          description: "Paket Enterprise - Saldo AI Rp 500.000 untuk volume tinggi dan integrasi skala besar",
          monthlyQuota: 600000,
          maxRequestsPerMinute: 500,
          quotaType: "credit",
          allowOverage: 0,
          overageRatePer1K: 0,
          allowedEndpoints: JSON.stringify(["*"]),
          allowedModels: JSON.stringify(["*"]),
          price: 600000,
          costPerRequest: 1,
          costPer1KTokens: 20,
          createdAt: new Date().toISOString(),
        },
      ];

      for (const p of defaultInitialPackages) {
        await pool.query("INSERT IGNORE INTO packages SET ?", [p]);
      }
      console.log("[MySQL] Seeding paket default selesai.");
    }
  } catch (err) {
    console.error("[MySQL] Gagal seeding paket default:", err);
  }

  await reloadFromMySQL();
};

export const reloadFromMySQL = async () => {
  if (!pool) return;
  // Sinkronisasi: Load dari MySQL ke RAM
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
    allowedModels:
      typeof p.allowedModels === "string"
        ? JSON.parse(p.allowedModels)
        : p.allowedModels,
    allowOverage: !!p.allowOverage,
    quotaType: (p.quotaType === "request" ? "request" : p.quotaType === "token" ? "token" : "credit") as "token" | "request" | "credit",
    costPerRequest: p.costPerRequest != null ? Math.max(1, Number(p.costPerRequest)) : 1,
    costPer1KTokens: p.costPer1KTokens != null ? Math.max(1, Number(p.costPer1KTokens)) : 20,
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
  quotaType?: "token" | "request" | "credit";
  costPerRequest?: number;
  costPer1KTokens?: number;
  allowOverage: boolean;
  overageRatePer1K: number;
  allowedEndpoints: string[];
  allowedModels?: string[];
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
    ninerApiKey?: string;
    apiKeys?: ApiKey[];
    disabledModels?: string[];
    modelAliases?: Record<string, string>;
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
      password: "$2b$10$KhIDSUZnewpaQ6UCNPjNsu3ZqkvEeZ/RTXgE69QvWz3gBRGfJQ6te",
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
    modelAliases: {},
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
        allowedModels: JSON.stringify(pkg.allowedModels || []),
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
      if (u.allowedModels)
        u.allowedModels = JSON.stringify(u.allowedModels) as any;
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

    const pkg = this.getPackage(client.packageId);
    const allowOverage = pkg ? pkg.allowOverage : false;

    if (!allowOverage) {
      const activeQuota = client.customQuota ?? (pkg ? pkg.monthlyQuota : 0);
      client.usageThisMonth = Math.min(client.usageThisMonth + amount, activeQuota);
    } else {
      client.usageThisMonth += amount;
    }

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
  clearOldLogs(days: number = 30) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const before = this.data.logs.length;
    this.data.logs = this.data.logs.filter((l) => l.timestamp >= cutoff);
    const deleted = before - this.data.logs.length;
    if (pool)
      pool
        .query("DELETE FROM logs WHERE timestamp < ?", [cutoff])
        .catch(console.error);
    return deleted;
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
  getDashboardStats(range: string = "24h") {
    const now = Date.now();
    let windowMs = 24 * 60 * 60 * 1000;
    let trendLabel = "vs kemarin";

    if (range === "5m") {
      windowMs = 5 * 60 * 1000;
      trendLabel = "vs 5 mnt lalu";
    } else if (range === "1h") {
      windowMs = 60 * 60 * 1000;
      trendLabel = "vs 1 jam lalu";
    } else if (range === "24h") {
      windowMs = 24 * 60 * 60 * 1000;
      trendLabel = "vs kemarin";
    } else if (range === "7d") {
      windowMs = 7 * 24 * 60 * 60 * 1000;
      trendLabel = "vs minggu lalu";
    } else if (range === "30d") {
      windowMs = 30 * 24 * 60 * 60 * 1000;
      trendLabel = "vs bulan lalu";
    } else if (range === "1y") {
      windowMs = 365 * 24 * 60 * 60 * 1000;
      trendLabel = "vs tahun lalu";
    } else if (range === "all") {
      windowMs = Infinity;
      trendLabel = "historis";
    }

    const currentWindowStart = windowMs === Infinity ? 0 : now - windowMs;
    const prevWindowStart = windowMs === Infinity ? 0 : now - 2 * windowMs;
    const prevWindowEnd = currentWindowStart;

    let totalRequests = 0;
    let errorCount = 0;
    let totalDuration = 0;
    let durationCount = 0;
    const reqsPerRouteObj: Record<string, number> = {};
    const statusBreakdown: Record<string, number> = {};

    let prevTotalRequests = 0;
    let prevErrorCount = 0;
    let prevDuration = 0;
    let prevDurationCount = 0;

    const oneMinAgo = now - 60_000;
    const twoMinAgo = now - 120_000;
    let rpm = 0;
    let rpmPrev = 0;

    this.data.logs.forEach((log) => {
      const t = new Date(log.timestamp).getTime();

      // Realtime RPM (1 menit terakhir vs 1 menit sebelumnya)
      if (t >= oneMinAgo && t <= now) rpm++;
      else if (t >= twoMinAgo && t < oneMinAgo) rpmPrev++;

      // Current Window filter
      if (t >= currentWindowStart && t <= now) {
        totalRequests++;
        if (log.statusCode >= 400) errorCount++;
        if (log.durationMs != null && !isNaN(log.durationMs)) {
          totalDuration += log.durationMs;
          durationCount++;
        }

        const routeId = log.path || log.routeId || "unknown";
        reqsPerRouteObj[routeId] = (reqsPerRouteObj[routeId] || 0) + 1;

        const code = String(log.statusCode);
        statusBreakdown[code] = (statusBreakdown[code] || 0) + 1;
      }
      // Previous Window filter (untuk hitung tren riil vs periode sebelumnya)
      else if (windowMs !== Infinity && t >= prevWindowStart && t < prevWindowEnd) {
        prevTotalRequests++;
        if (log.statusCode >= 400) prevErrorCount++;
        if (log.durationMs != null && !isNaN(log.durationMs)) {
          prevDuration += log.durationMs;
          prevDurationCount++;
        }
      }
    });

    const avgResponseTime =
      durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;
    const prevAvgResponseTime =
      prevDurationCount > 0 ? Math.round(prevDuration / prevDurationCount) : 0;

    // Hitung perubahan tren yang riil (bukan fake +100% dari 0)
    let requestsDeltaPct = 0;
    if (prevTotalRequests > 0) {
      requestsDeltaPct =
        Math.round(
          ((totalRequests - prevTotalRequests) / prevTotalRequests) * 100 * 10,
        ) / 10;
    } else {
      // Jika di periode sebelumnya belum ada data, tampilkan 0 (stabil)
      requestsDeltaPct = 0;
    }

    const latencyDeltaMs =
      prevAvgResponseTime > 0 && avgResponseTime > 0
        ? avgResponseTime - prevAvgResponseTime
        : 0;
    const errorsDeltaCount = errorCount - prevErrorCount;

    const requestsPerRoute = Object.entries(reqsPerRouteObj)
      .map(([id, count]) => {
        const route = this.getRoute(id);
        return { path: route ? route.path : id, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      range,
      trendLabel,
      summary: {
        activeClients: this.data.clients.filter((c) => c.isActive).length,
        suspendedClients: this.data.clients.filter((c) => !c.isActive).length,
        totalClients: this.data.clients.length,
        totalRequests,
        activeRoutes: this.data.routes.filter((r) => r.isActive).length,
        totalRoutes: this.data.routes.length,
        totalPackages: this.data.packages.length,
        successRate:
          totalRequests > 0
            ? Math.round(
                ((totalRequests - errorCount) / totalRequests) * 100,
              )
            : 100,
        avgResponseTime,
        errorCount,
        rpm,
        rpmDelta: rpm - rpmPrev,
        trends: {
          requests: requestsDeltaPct,
          latency: latencyDeltaMs,
          errors: errorsDeltaCount,
        },
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
