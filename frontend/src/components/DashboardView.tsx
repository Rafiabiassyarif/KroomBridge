import React, { useEffect, useMemo, useRef, useState } from "react";
import { adminFetch, getFullApiUrl } from "../lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Activity,
  Clock,
  AlertTriangle,
  ArrowRight,
  Key,
  Lock,
  Layers,
  Users,
  Cpu,
  Server,
  RefreshCw,
  Pause,
  Play,
  Sparkles,
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Bot,
  ImageIcon,
  Database,
  Globe,
  ChevronDown,
  BarChart3,
  Thermometer,
  MemoryStick,
  Gauge,
  HardDrive,
  Check,
  X,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────
interface LogEntry {
  timestamp: string;
  clientId?: string;
  routeId?: string;
  path: string;
  method: string;
  statusCode: number;
  durationMs?: number;
  ip?: string;
}

interface DashboardStats {
  summary: {
    activeClients: number;
    suspendedClients: number;
    totalClients: number;
    totalRequests: number;
    activeRoutes: number;
    totalRoutes: number;
    totalPackages: number;
    successRate: number;
    avgResponseTime: number;
    errorCount: number;
    rpm?: number;
    rpmDelta?: number;
  };
  topClients: Array<{
    id: string;
    name: string;
    usage: number;
    packageId: string;
  }>;
  requestsPerRoute: Array<{ path: string; count: number }>;
  statusBreakdown: Record<string, number>;
  recentLogs: LogEntry[];
  meta?: any;
}

interface GpuMetrics {
  hostId: string;
  name: string;
  status: "online" | "offline";
  gpuName?: string;
  gpuLoad: number;
  vramUsed: number;
  vramTotal: number;
  temperature: number;
  powerDraw: number;
  fanSpeed: number;
  // System (opsional, hanya GPU ke-0 dari host fisik yang punya)
  cpuLoad?: number;
  cpuModel?: string;
  cpuCores?: number;
  memUsed?: number;
  memTotal?: number;
  diskUsed?: number;
  diskTotal?: number;
  uptime?: number;
  loadAvg1?: number;
  receivedAt?: string;
  gpuError?: string;
}

const initialStats: DashboardStats = {
  summary: {
    activeClients: 0,
    suspendedClients: 0,
    totalClients: 0,
    totalRequests: 0,
    activeRoutes: 0,
    totalRoutes: 0,
    totalPackages: 0,
    successRate: 100,
    avgResponseTime: 0,
    errorCount: 0,
    rpm: 0,
    rpmDelta: 0,
  },
  topClients: [],
  requestsPerRoute: [],
  statusBreakdown: {},
  recentLogs: [],
};

// ────────────────────────────────────────────────────────────
// Interactive Components
// ────────────────────────────────────────────────────────────

/**
 * AnimatedNumber: Membuat angka "berjalan" saat berubah.
 */
function AnimatedNumber({
  value,
  duration = 0.5,
  formatter = (n: number) => String(n),
}: {
  value: number;
  duration?: number;
  formatter?: (n: number) => string;
}) {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const endValue = value;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min(
        (timestamp - startTimestamp) / (duration * 1000),
        1,
      );
      const current = Math.floor(
        progress * (endValue - startValue) + startValue,
      );
      setDisplayValue(current);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration]);

  return <>{formatter(displayValue)}</>;
}

/**
 * Shimmer: Efek skeleton loading yang premium.
 */
function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden bg-zinc-200/20 dark:bg-white/[0.03] ${className}`}
    >
      <motion.div
        animate={{
          x: ["-100%", "100%"],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: "linear",
        }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Utils
// ────────────────────────────────────────────────────────────
const formatNumber = (n: number) => {
  if (n >= 1_000_000)
    return `${(n / 1_000_000).toFixed(1).replace(".0", "")}jt`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(".0", "")}k`;
  return String(n);
};

const formatTimestampHHMMSS = (ts: string) => {
  const d = new Date(ts);
  return d.toLocaleTimeString("id-ID", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const formatLatency = (ms: number) => {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
};

const methodPillColor = (method: string) => {
  const m = method.toUpperCase();
  if (m === "GET")
    return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
  if (m === "POST") return "text-blue-300 bg-blue-500/10 border-blue-500/30";
  if (m === "PUT" || m === "PATCH")
    return "text-amber-300 bg-amber-500/10 border-amber-500/30";
  if (m === "DELETE") return "text-rose-300 bg-rose-500/10 border-rose-500/30";
  return "text-zinc-300 bg-zinc-500/10 border-zinc-500/30";
};

const getStatusLabel = (code: number) => {
  if (code === 200) return "200 OK";
  if (code === 201) return "201 CREATED";
  if (code === 204) return "204 NO CONTENT";
  if (code === 301 || code === 302) return `${code} REDIRECT`;
  if (code === 400) return "400 BAD REQUEST";
  if (code === 401) return "401 AUTH";
  if (code === 403) return "403 FORBIDDEN";
  if (code === 404) return "404 NOT FOUND";
  if (code === 429) return "429 RATE LIMIT";
  if (code === 500) return "500 INTERNAL";
  if (code === 502) return "502 GATEWAY";
  if (code === 503) return "503 UNAVAILABLE";
  if (code === 504) return "504 TIMEOUT";
  if (code >= 500) return `${code} SERVER ERR`;
  if (code >= 400) return `${code} CLIENT ERR`;
  return `${code}`;
};

const getStatusBadgeStyle = (code: number) => {
  if (code === 429)
    return "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.25)]";
  if (code === 502 || code === 504)
    return "bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(251,113,133,0.3)]";
  if (code === 403) return "bg-zinc-500/15 text-zinc-200 border-zinc-500/40";
  if (code >= 500)
    return "bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-[0_0_12px_rgba(251,113,133,0.3)]";
  if (code >= 400)
    return "bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-[0_0_12px_rgba(251,191,36,0.25)]";
  if (code >= 300) return "bg-blue-500/15 text-blue-300 border-blue-500/40";
  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/40";
};

const getDetailInfo = (
  log: LogEntry,
): { text: string; tag?: string; tagCls?: string } => {
  const code = log.statusCode;
  if (code === 429) return { text: "Over quota bulanan" };
  if (code === 502)
    return {
      text: "Upstream timeout",
      tag: "FAILOVER TRIGGERED",
      tagCls:
        "bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-[0_0_8px_rgba(251,113,133,0.4)]",
    };
  if (code === 504) return { text: "Gateway timeout", tag: "RETRY" };
  if (code === 403) return { text: "Blocked by Anti-DDoS Filter" };
  if (code === 401) return { text: "JWT invalid / expired" };
  if (code === 404) return { text: "Endpoint tidak ditemukan" };
  if (code === 500) return { text: "Internal server error" };
  if (code === 503) return { text: "Service unavailable" };
  if (code >= 200 && code < 300) {
    if (log.durationMs && log.durationMs > 1000)
      return { text: "Slow response detected" };
    return { text: "Request berhasil" };
  }
  return { text: "—" };
};

type EndpointHealth = {
  label: "Healthy" | "Warning" | "Degraded";
  cls: string;
  dot: string;
};
function computeEndpointHealth(
  avgLatency: number,
  errorRate: number,
): EndpointHealth {
  // Untuk API AI, latensi puluhan detik adalah normal.
  // Warning: > 30 detik (30000ms), Degraded: > 60 detik (60000ms)
  if (errorRate > 10 || avgLatency > 60000)
    return { label: "Degraded", cls: "text-rose-400", dot: "#fb7185" };
  if (errorRate > 5 || avgLatency > 30000)
    return { label: "Warning", cls: "text-amber-400", dot: "#fbbf24" };
  return { label: "Healthy", cls: "text-emerald-400", dot: "#34d399" };
}

function getUpstreamMeta(path: string) {
  const p = path.toLowerCase();
  if (p.includes("chat") || p.includes("llm") || p.includes("gpt") || p.includes("completions"))
    return { icon: Bot, label: "Chat API", glow: "shadow-sky-500/30" };
  if (p.includes("model"))
    return { icon: Server, label: "Models API", glow: "shadow-emerald-500/30" };
  if (p.includes("embed"))
    return { icon: Layers, label: "Embed API", glow: "shadow-blue-500/30" };
  if (p.includes("image") || p.includes("img") || p.includes("vision"))
    return { icon: ImageIcon, label: "Image API", glow: "shadow-amber-500/30" };
  if (p.includes("db") || p.includes("data"))
    return { icon: Database, label: "Database", glow: "shadow-blue-500/30" };
  if (p.includes("auth") || p.includes("token"))
    return { icon: Lock, label: "Auth", glow: "shadow-cyan-500/30" };
  return { icon: Globe, label: path, glow: "shadow-cyan-500/30" };
}

function buildTimeSeries(
  logs: LogEntry[],
  bucketCount: number,
  bucketSizeMs: number,
  filterPath?: string,
  labelFmt: "time" | "hour" | "day" | "month" = "time",
) {
  const now = Date.now();
  const buckets: Array<{
    time: string;
    requests: number;
    errors: number;
    latency: number;
    _ls: number;
    _ln: number;
  }> = [];

  for (let i = bucketCount - 1; i >= 0; i--) {
    const bucketStart = now - (i + 1) * bucketSizeMs;
    const date = new Date(bucketStart + bucketSizeMs);
    let time: string;
    if (labelFmt === "time") {
      time = date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } else if (labelFmt === "hour") {
      time = date.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        hour12: false,
      });
    } else if (labelFmt === "day") {
      time = date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
      });
    } else {
      time = date.toLocaleDateString("id-ID", {
        month: "short",
        year: "2-digit",
      });
    }
    buckets.push({ time, requests: 0, errors: 0, latency: 0, _ls: 0, _ln: 0 });
  }

  const filtered =
    filterPath && filterPath !== "__all__"
      ? logs.filter(
          (l) => l.path === filterPath || l.path?.startsWith(filterPath),
        )
      : logs;

  filtered.forEach((log) => {
    const ts = new Date(log.timestamp).getTime();
    const diff = now - ts;
    if (diff < 0 || diff > bucketCount * bucketSizeMs) return;
    const idx = bucketCount - 1 - Math.floor(diff / bucketSizeMs);
    if (idx < 0 || idx >= bucketCount) return;
    buckets[idx].requests += 1;
    if (log.statusCode >= 400) buckets[idx].errors += 1;
    if (log.durationMs != null) {
      buckets[idx]._ls += log.durationMs;
      buckets[idx]._ln += 1;
    }
  });

  buckets.forEach((b) => {
    b.latency = b._ln > 0 ? Math.round(b._ls / b._ln) : 0;
  });
  return buckets;
}

// Konfigurasi range untuk fallback client-side bila endpoint backend
// belum tersedia (mis. server belum di-restart setelah update kode).
const RANGE_BUCKET_CONFIG: Record<
  TimeRange,
  { count: number; sizeMs: number; labelFmt: "time" | "hour" | "day" | "month" }
> = {
  "5m": { count: 30, sizeMs: 10_000, labelFmt: "time" },
  "1h": { count: 30, sizeMs: 120_000, labelFmt: "time" },
  "24h": { count: 24, sizeMs: 3_600_000, labelFmt: "hour" },
  "7d": { count: 7, sizeMs: 86_400_000, labelFmt: "day" },
  "30d": { count: 30, sizeMs: 86_400_000, labelFmt: "day" },
  "1y": { count: 12, sizeMs: 30 * 86_400_000, labelFmt: "month" },
};

// Snapshot dari backend GPU agent (POST /api/gpu/report → GET /api/admin/gpu)
interface RemoteGpuSnapshot {
  hostId: string;
  hostName: string;
  status: "online" | "offline";
  gpuName?: string;
  gpuLoad: number;
  vramUsed: number;
  vramTotal: number;
  temperature: number;
  powerDraw: number;
  fanSpeed: number;
  clockMhz?: number;
  cpuLoad?: number;
  cpuModel?: string;
  cpuCores?: number;
  memUsed?: number;
  memTotal?: number;
  diskUsed?: number;
  diskTotal?: number;
  uptime?: number;
  loadAvg1?: number;
  receivedAt: string;
}

function snapshotToMetrics(s: RemoteGpuSnapshot): GpuMetrics {
  return {
    hostId: s.hostId,
    name: s.hostName,
    status: s.status,
    gpuName: s.gpuName,
    gpuLoad: s.gpuLoad,
    vramUsed: s.vramUsed,
    vramTotal: s.vramTotal,
    temperature: s.temperature,
    powerDraw: s.powerDraw,
    fanSpeed: s.fanSpeed,
    cpuLoad: s.cpuLoad,
    cpuModel: s.cpuModel,
    cpuCores: s.cpuCores,
    memUsed: s.memUsed,
    memTotal: s.memTotal,
    diskUsed: s.diskUsed,
    diskTotal: s.diskTotal,
    uptime: s.uptime,
    loadAvg1: s.loadAvg1,
    receivedAt: s.receivedAt,
    gpuError: (s as any)?.meta?.gpuError,
  };
}

// Daftar host yang SELALU dirender di dashboard (placeholder offline kalau
// belum ada data). Ini supaya layout konsisten meski poller belum jalan
// atau host sedang down.
const EXPECTED_HOSTS: Array<{
  hostId: string;
  name: string;
  vramTotal: number;
}> = [
  { hostId: "pc-putih", name: "PC Putih", vramTotal: 0 },
  { hostId: "pc-hitam", name: "PC Hitam", vramTotal: 0 },
];

function offlineGpu(
  hostId: string,
  name: string,
  vramTotal: number,
): GpuMetrics {
  return {
    hostId,
    name,
    status: "offline",
    gpuLoad: 0,
    vramUsed: 0,
    vramTotal,
    temperature: 0,
    powerDraw: 0,
    fanSpeed: 0,
  };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
} as const;
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
} as const;

type TimeRange = "5m" | "1h" | "24h" | "7d" | "30d" | "1y";
type IntervalOption = 60 | 120 | 300 | 600;

const RANGE_OPTIONS: {
  value: TimeRange;
  label: string;
  short: string;
  description: string;
}[] = [
  {
    value: "5m",
    short: "5 mnt",
    label: "5 Menit",
    description: "30 bucket × 10 detik",
  },
  {
    value: "1h",
    short: "1 jam",
    label: "1 Jam",
    description: "30 bucket × 2 menit",
  },
  {
    value: "24h",
    short: "24 jam",
    label: "24 Jam",
    description: "24 bucket × 1 jam",
  },
  {
    value: "7d",
    short: "7 hari",
    label: "7 Hari",
    description: "7 bucket × 1 hari",
  },
  {
    value: "30d",
    short: "30 hari",
    label: "30 Hari",
    description: "30 bucket × 1 hari",
  },
  {
    value: "1y",
    short: "1 tahun",
    label: "1 Tahun",
    description: "12 bucket × 1 bulan",
  },
];

const RANGE_LABEL_LONG: Record<TimeRange, string> = {
  "5m": "5 menit terakhir",
  "1h": "1 jam terakhir",
  "24h": "24 jam terakhir",
  "7d": "7 hari terakhir",
  "30d": "30 hari terakhir",
  "1y": "1 tahun terakhir",
};

const RANGE_LABEL_SHORT: Record<TimeRange, string> = {
  "5m": "5M",
  "1h": "1J",
  "24h": "24J",
  "7d": "7H",
  "30d": "30H",
  "1y": "1T",
};

// ────────────────────────────────────────────────────────────
// Custom Dropdowns
// ────────────────────────────────────────────────────────────
function IntervalDropdown({
  value,
  onChange,
}: {
  value: IntervalOption;
  onChange: (v: IntervalOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current) return;
      const target = e.target as Node | null;
      if (target && !ref.current.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const options: IntervalOption[] = [60, 120, 300, 600];

  const handleSelect = (opt: IntervalOption) => {
    onChange(opt);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-1.5 text-xs font-medium bg-white/60 dark:bg-white/[0.04] backdrop-blur-xl border border-zinc-200/60 dark:border-white/[0.08] rounded-xl px-3 py-1.5 text-zinc-700 dark:text-zinc-200 hover:border-sky-500/40 transition-colors min-w-[100px] justify-between"
      >
        <span>tiap {value} dtk</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1.5 w-[120px] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border border-zinc-200/60 dark:border-white/[0.08] rounded-xl shadow-xl shadow-black/10 overflow-hidden z-[100]"
          >
            {options.map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between transition-colors ${
                  value === opt
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-300"
                    : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/60 dark:hover:bg-white/[0.04]"
                }`}
              >
                <span>tiap {opt >= 60 ? `${opt / 60}mnt` : `${opt}dtk`}</span>
                {value === opt && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RangeDropdown({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (v: TimeRange) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current) return;
      const target = e.target as Node | null;
      if (target && !ref.current.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const current =
    RANGE_OPTIONS.find((o) => o.value === value) ?? RANGE_OPTIONS[2];

  const handleSelect = (val: TimeRange) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-2 text-xs font-medium bg-gradient-to-br from-sky-500/15 to-blue-500/10 backdrop-blur-xl border border-sky-500/30 rounded-xl px-3 py-1.5 text-sky-700 dark:text-sky-200 hover:border-sky-500/50 transition-colors min-w-[110px] justify-between shadow-lg shadow-sky-500/10"
      >
        <span className="font-semibold">{current.short}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1.5 w-[200px] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border border-zinc-200/60 dark:border-white/[0.08] rounded-xl shadow-xl shadow-black/10 overflow-hidden z-[100]"
          >
            {RANGE_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-3 py-2 transition-colors ${
                  value === opt.value
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-300"
                    : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/60 dark:hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{opt.label}</span>
                  {value === opt.value && (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">
                  {opt.description}
                </p>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ServiceDropdown({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current) return;
      const target = e.target as Node | null;
      if (target && !ref.current.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const currentLabel =
    value === "__all__" ? "Semua Layanan (Aggregated)" : value;

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex items-center gap-2 text-xs font-medium bg-white/60 dark:bg-white/[0.04] backdrop-blur-xl border border-zinc-200/60 dark:border-white/[0.08] rounded-xl px-3 py-2 text-zinc-700 dark:text-zinc-200 hover:border-sky-500/40 transition-colors min-w-[200px] justify-between"
      >
        <span className="truncate">{currentLabel}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-0 top-full mt-1.5 min-w-[220px] max-w-[320px] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border border-zinc-200/60 dark:border-white/[0.08] rounded-xl shadow-xl shadow-black/10 overflow-hidden z-[100] max-h-[280px] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => handleSelect("__all__")}
              className={`w-full text-left px-3 py-2 text-xs font-medium flex items-center justify-between transition-colors ${
                value === "__all__"
                  ? "bg-sky-500/10 text-sky-600 dark:text-sky-300"
                  : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/60 dark:hover:bg-white/[0.04]"
              }`}
            >
              <span>Semua Layanan (Aggregated)</span>
              {value === "__all__" && (
                <Check className="w-3.5 h-3.5 shrink-0" />
              )}
            </button>
            {options.map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`w-full text-left px-3 py-2 text-xs font-mono flex items-center justify-between transition-colors ${
                  value === opt
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-300"
                    : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/60 dark:hover:bg-white/[0.04]"
                }`}
              >
                <span className="truncate">{opt}</span>
                {value === opt && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────
export default function DashboardView({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void;
}) {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [prevStats, setPrevStats] = useState<DashboardStats>(initialStats);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<IntervalOption>(() => {
    const saved = localStorage.getItem("kb_dash_interval");
    const valid: IntervalOption[] = [60, 120, 300, 600];
    const parsed = saved ? (parseInt(saved) as IntervalOption) : null;
    return parsed && valid.includes(parsed) ? parsed : 60;
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(() => {
    const saved = localStorage.getItem("kb_dash_range");
    const valid: TimeRange[] = ["5m", "1h", "24h", "7d", "30d", "1y"];
    return saved && valid.includes(saved as TimeRange) ? (saved as TimeRange) : "24h";
  });
  const [serviceFilter, setServiceFilter] = useState<string>("__all__");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tickToRedraw, setTickToRedraw] = useState(0);
  const [gpuList, setGpuList] = useState<GpuMetrics[]>([]);
  const [isSseActive, setIsSseActive] = useState(false);
  const [isEndpointDetailOpen, setIsEndpointDetailOpen] = useState(false);
  const [endpointSearchQuery, setEndpointSearchQuery] = useState("");
  const [endpointStatusFilter, setEndpointStatusFilter] = useState<
    "all" | "Healthy" | "Warning" | "Degraded"
  >("all");
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearLogsMsg, setClearLogsMsg] = useState<string | null>(null);

  const intervalRef = useRef<number | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const autoRefreshRef = useRef(autoRefresh);

  useEffect(() => {
    autoRefreshRef.current = autoRefresh;
  }, [autoRefresh]);

  // Persist pengaturan interval & range ke localStorage
  useEffect(() => {
    localStorage.setItem("kb_dash_interval", String(refreshInterval));
  }, [refreshInterval]);

  useEffect(() => {
    localStorage.setItem("kb_dash_range", timeRange);
  }, [timeRange]);

  const handleClearLogs = async (daysOld?: number) => {
    setIsClearingLogs(true);
    try {
      const url = daysOld
        ? `/api/admin/logs/old?days=${daysOld}`
        : "/api/admin/logs";
      const res = await adminFetch(url, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setClearLogsMsg(data.message);
        fetchStats();
        setTimeout(() => setClearLogsMsg(null), 4000);
      }
    } catch {
      setClearLogsMsg("Gagal menghapus log.");
      setTimeout(() => setClearLogsMsg(null), 3000);
    } finally {
      setIsClearingLogs(false);
      setShowClearConfirm(false);
    }
  };

  const fetchStats = async () => {
    setIsRefreshing(true);
    try {
      const [resStats, resGpu] = await Promise.all([
        adminFetch("/api/admin/dashboard-stats"),
        adminFetch("/api/admin/gpu"),
      ]);

      if (!resStats.ok) throw new Error(`HTTP ${resStats.status}`);
      const data = await resStats.json();

      if (data && !data.error) {
        setStats((curr) => {
          setPrevStats(curr);
          return data;
        });
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError(data?.error || "Gagal memuat data");
      }

      // GPU metrics realtime dari agent / SSH poller. Kalau host belum
      // pernah lapor, dashboard kosong (kartu tidak dirender). Kalau sudah
      // pernah lapor tapi >30 dtk tidak update, status auto-jadi offline.
      if (resGpu.ok) {
        const remote: RemoteGpuSnapshot[] = await resGpu.json();
        // Sort: GPU berlabel "GPU 0", "GPU 1", dst. lalu sisanya by hostName
        const sorted = [...remote].sort((a, b) => {
          const aIdx = a.hostId.match(/-gpu(\d+)$/);
          const bIdx = b.hostId.match(/-gpu(\d+)$/);
          if (aIdx && bIdx) {
            return parseInt(aIdx[1]) - parseInt(bIdx[1]);
          }
          return (a.hostName || a.hostId).localeCompare(b.hostName || b.hostId);
        });
        setGpuList(sorted.map(snapshotToMetrics));
      }
    } catch (e: any) {
      setError(e.message || "Kesalahan jaringan");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();

    // ─── REALTIME SSE CONNECTION ───────────────────────────────
    const connectSSE = () => {
      const token = sessionStorage.getItem("kroombridge_admin_token");
      if (!token) return;

      if (sseRef.current) sseRef.current.close();

      const es = new EventSource(
        getFullApiUrl(`/api/events/stream?token=${encodeURIComponent(token)}`),
      );
      sseRef.current = es;

      es.onopen = () => {
        setIsSseActive(true);
        setError(null);
        console.log("[Dashboard] Realtime SSE Connected ✅");
      };

      es.onerror = (e) => {
        setIsSseActive(false);
        console.warn("[Dashboard] SSE Error/Disconnected ❌", e);
      };

      // Tick berkala dari server berisi summary dashboard
      es.addEventListener("stats:tick", (e: any) => {
        if (!autoRefreshRef.current) return;
        try {
          const newStats = JSON.parse(e.data);
          setStats((curr) => {
            setPrevStats(curr);
            return newStats;
          });
          setLastUpdated(new Date());
        } catch (err) {
          console.error("[Dashboard] Error parsing stats:tick", err);
        }
      });

      // Event log baru seketika (push-based) saat ada trafik gateway
      es.addEventListener("log:new", (e: any) => {
        if (!autoRefreshRef.current) return;
        try {
          const logEntry = JSON.parse(e.data);
          setStats((curr) => {
            // Update summary counters secara lokal untuk visual instan
            const summary = { ...curr.summary };
            summary.totalRequests += 1;
            if (logEntry.statusCode >= 400) summary.errorCount += 1;
            if (summary.rpm !== undefined) summary.rpm += 1;

            // Update status breakdown
            const sb = { ...curr.statusBreakdown };
            const code = String(logEntry.statusCode);
            sb[code] = (sb[code] || 0) + 1;

            // Prepend log ke feed (keep 50)
            const logs = [logEntry, ...curr.recentLogs].slice(0, 50);

            // Update requests per route (Endpoint Monitoring)
            const rpr = [...curr.requestsPerRoute];
            const routeIdx = rpr.findIndex((r) => r.path === logEntry.path);
            if (routeIdx > -1) {
              rpr[routeIdx] = {
                ...rpr[routeIdx],
                count: rpr[routeIdx].count + 1,
              };
            } else {
              rpr.push({ path: logEntry.path, count: 1 });
            }

            return {
              ...curr,
              summary,
              statusBreakdown: sb,
              recentLogs: logs,
              requestsPerRoute: rpr,
            };
          });
          setTickToRedraw((v) => v + 1);
        } catch (err) {
          console.error("[Dashboard] Error parsing log:new", err);
        }
      });

      // Update GPU monitor seketika saat ada report dari agent / SSH poller.
      // Per-GPU split sudah ditangani di backend (hostId 'pc-putih-gpu0',
      // 'pc-putih-gpu1', dst), jadi frontend cukup upsert ke array.
      es.addEventListener("gpu:update", (e: any) => {
        if (!autoRefreshRef.current) return;
        try {
          const data = JSON.parse(e.data);
          const metrics = snapshotToMetrics(data);
          setGpuList((curr) => {
            const idx = curr.findIndex((g) => g.hostId === data.hostId);
            if (idx === -1) return [...curr, metrics];
            const next = [...curr];
            next[idx] = metrics;
            return next;
          });
        } catch (err) {
          console.error("[Dashboard] Error parsing gpu:update", err);
        }
      });
    };

    connectSSE();

    return () => {
      if (sseRef.current) {
        sseRef.current.close();
        console.log("[Dashboard] SSE Connection Closed");
      }
    };
  }, []);

  // Fallback Polling (hanya aktif jika SSE mati atau dipaksa)
  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Jika SSE aktif, kita tidak butuh polling berat.
    // Kita kurangi frekuensi polling atau matikan sama sekali.
    if (autoRefresh && !isSseActive) {
      intervalRef.current = window.setInterval(
        fetchStats,
        refreshInterval * 1000,
      );
    } else if (autoRefresh && isSseActive) {
      // Polling jarang hanya untuk memastikan sinkronisasi (tiap 10 detik)
      intervalRef.current = window.setInterval(fetchStats, 60000);
    }

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [autoRefresh, refreshInterval, isSseActive]);
  useEffect(() => {
    const t = window.setInterval(() => {
      if (autoRefreshRef.current) setTickToRedraw((v) => v + 1);
    }, 60000);
    return () => window.clearInterval(t);
  }, []);

  // Time series sekarang difetch dari backend supaya akurat untuk range
  // panjang (7 hari, 30 hari, 1 tahun) — tidak terbatas 20 log terakhir.
  const [serverSeries, setServerSeries] = useState<
    Array<{ time: string; requests: number; errors: number; latency: number }>
  >([]);
  const [tsSummary, setTsSummary] = useState<{
    totalRequests: number;
    totalErrors: number;
    avgLatency: number;
    successRate: number;
  } | null>(null);
  const [tsLoaded, setTsLoaded] = useState(false);

  const fetchTimeseries = async () => {
    try {
      const params = new URLSearchParams({ range: timeRange });
      if (serviceFilter !== "__all__") params.set("path", serviceFilter);
      const res = await adminFetch(
        `/api/admin/timeseries?${params.toString()}`,
      );
      if (!res.ok) {
        // Endpoint belum tersedia (server belum restart) → fallback ke client-side
        setServerSeries([]);
        setTsLoaded(false);
        return;
      }
      const data = await res.json();
      if (data && Array.isArray(data.series)) {
        setServerSeries(data.series);
        setTsSummary(data.summary || null);
        setTsLoaded(true);
      }
    } catch {
      // Network error / endpoint hilang → fallback ke client-side
      setServerSeries([]);
      setTsLoaded(false);
    }
  };

  useEffect(() => {
    fetchTimeseries();
  }, [timeRange, serviceFilter]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(fetchTimeseries, refreshInterval * 1000);
    return () => window.clearInterval(id);
  }, [timeRange, serviceFilter, autoRefresh, refreshInterval]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (autoRefresh) {
      fetchStats();
      fetchTimeseries();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  // Fallback client-side: bangun timeseries dari recentLogs kalau endpoint
  // backend belum aktif. Untuk range panjang (7d/30d/1y) data terbatas
  // (cuma 20 log terbaru) — tapi minimal grafik tetap render axis-nya.
  const timeSeries = useMemo(() => {
    if (tsLoaded && serverSeries.length > 0) return serverSeries;
    const cfg = RANGE_BUCKET_CONFIG[timeRange];
    return buildTimeSeries(
      stats.recentLogs,
      cfg.count,
      cfg.sizeMs,
      serviceFilter,
      cfg.labelFmt,
    );
  }, [
    tsLoaded,
    serverSeries,
    timeRange,
    stats.recentLogs,
    serviceFilter,
    tickToRedraw,
  ]);

  const statusData = useMemo(() => {
    const arr = Object.keys(stats.statusBreakdown).map((code) => ({
      name: code.startsWith("2") ? `${code} OK` : code,
      value: stats.statusBreakdown[code],
      color: code.startsWith("2")
        ? "#10b981"
        : code === "401"
          ? "#fbbf24"
          : code === "429"
            ? "#f97316"
            : code.startsWith("5")
              ? "#fb7185"
              : code.startsWith("4")
                ? "#fbbf24"
                : "#60a5fa",
      raw: code,
    }));
    if (arr.length === 0)
      return [{ name: "Belum ada", value: 1, color: "#27272a", raw: "0" }];
    return arr;
  }, [stats.statusBreakdown]);

  const totalResponses = useMemo(
    () =>
      Object.values(stats.statusBreakdown).reduce(
        (a: any, b: any) => a + b,
        0,
      ) as number,
    [stats.statusBreakdown],
  );

  const errorAllCount = useMemo(
    () =>
      Object.entries(stats.statusBreakdown).reduce(
        (sum, [code, count]) => (parseInt(code) >= 400 ? sum + count : sum),
        0,
      ),
    [stats.statusBreakdown],
  );
  const prevErrorAllCount = useMemo(
    () =>
      Object.entries(prevStats.statusBreakdown).reduce(
        (sum, [code, count]) => (parseInt(code) >= 400 ? sum + count : sum),
        0,
      ),
    [prevStats.statusBreakdown],
  );
  const errorRateAll =
    totalResponses > 0
      ? +((errorAllCount / totalResponses) * 100).toFixed(2)
      : 0;

  const trends = useMemo(() => {
    const calcPct = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 100 * 10) / 10;
    };
    return {
      requests: calcPct(
        stats.summary.totalRequests,
        prevStats.summary.totalRequests,
      ),
      latency:
        stats.summary.avgResponseTime - prevStats.summary.avgResponseTime,
      errorsAll:
        prevErrorAllCount === 0
          ? 0
          : +(
              ((errorAllCount - prevErrorAllCount) /
                Math.max(prevErrorAllCount, 1)) *
              100
            ).toFixed(2),
      clients: stats.summary.activeClients - prevStats.summary.activeClients,
    };
  }, [stats.summary, prevStats.summary, errorAllCount, prevErrorAllCount]);

  // ── Realtime Request-Per-Minute (RPM) ──
  // Hitung dari log 60 detik terakhir vs 60–120 detik sebelumnya untuk trend.
  const rpmStats = useMemo(() => {
    if (stats.summary.rpm !== undefined) {
      return {
        current: stats.summary.rpm,
        delta: stats.summary.rpmDelta ?? 0,
      };
    }

    const now = Date.now();
    const oneMinAgo = now - 60_000;
    const twoMinAgo = now - 120_000;

    let current = 0;
    let prev = 0;
    stats.recentLogs.forEach((l) => {
      const t = new Date(l.timestamp).getTime();
      if (t >= oneMinAgo && t <= now) current += 1;
      else if (t >= twoMinAgo && t < oneMinAgo) prev += 1;
    });

    return { current, delta: current - prev };
  }, [
    stats.summary.rpm,
    stats.summary.rpmDelta,
    stats.recentLogs,
    tickToRedraw,
  ]);

  const endpointMetrics = useMemo(() => {
    const map: Record<
      string,
      { count: number; errors: number; method: string; latencies: number[] }
    > = {};
    stats.recentLogs.forEach((l) => {
      const key = l.path || "unknown";
      if (!map[key])
        map[key] = {
          count: 0,
          errors: 0,
          method: l.method || "GET",
          latencies: [],
        };
      map[key].count += 1;
      if (l.statusCode >= 400) map[key].errors += 1;
      if (l.durationMs != null) map[key].latencies.push(l.durationMs);
    });

    return Object.entries(map)
      .map(([path, v]) => {
        const avgLatency =
          v.latencies.length > 0
            ? Math.round(
                v.latencies.reduce((a, b) => a + b, 0) / v.latencies.length,
              )
            : 0;
        const errorRate = (v.errors / v.count) * 100;
        const health = computeEndpointHealth(avgLatency, errorRate);
        return {
          path,
          method: v.method,
          count: v.count,
          avgLatency,
          errorRate,
          health,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [stats.recentLogs]);

  const allEndpointMetrics = useMemo(() => {
    const map: Record<
      string,
      { count: number; errors: number; method: string; latencies: number[] }
    > = {};
    stats.recentLogs.forEach((l) => {
      const key = l.path || "unknown";
      if (!map[key])
        map[key] = {
          count: 0,
          errors: 0,
          method: l.method || "GET",
          latencies: [],
        };
      map[key].count += 1;
      if (l.statusCode >= 400) map[key].errors += 1;
      if (l.durationMs != null) map[key].latencies.push(l.durationMs);
    });

    return Object.entries(map)
      .map(([path, v]) => {
        const avgLatency =
          v.latencies.length > 0
            ? Math.round(
                v.latencies.reduce((a, b) => a + b, 0) / v.latencies.length,
              )
            : 0;
        const errorRate = (v.errors / v.count) * 100;
        const health = computeEndpointHealth(avgLatency, errorRate);
        return {
          path,
          method: v.method,
          count: v.count,
          avgLatency,
          errorRate,
          health,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [stats.recentLogs]);

  const filteredEndpointMetrics = useMemo(() => {
    return allEndpointMetrics.filter((e) => {
      const matchesSearch = e.path
        .toLowerCase()
        .includes(endpointSearchQuery.toLowerCase());
      const matchesStatus =
        endpointStatusFilter === "all" ||
        e.health.label === endpointStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [allEndpointMetrics, endpointSearchQuery, endpointStatusFilter]);

  const availableServices = useMemo(() => {
    const set = new Set<string>();
    stats.recentLogs.forEach((l) => {
      if (l.path) set.add(l.path);
    });
    stats.requestsPerRoute.forEach((r) => set.add(r.path));
    return Array.from(set).sort();
  }, [stats.recentLogs, stats.requestsPerRoute]);

  const notableLogs = useMemo(() => {
    const errors = stats.recentLogs
      .filter((l) => l.statusCode >= 400)
      .slice(0, 6);
    const others = stats.recentLogs
      .filter((l) => l.statusCode < 400)
      .slice(0, 4);
    return [...errors, ...others].slice(0, 8);
  }, [stats.recentLogs]);

  const upstreamHealth = useMemo(() => {
    const map: Record<string, { errors: number; total: number }> = {};
    stats.recentLogs.forEach((l) => {
      if (!l.path) return;
      if (!map[l.path]) map[l.path] = { errors: 0, total: 0 };
      map[l.path].total += 1;
      if (l.statusCode >= 400) map[l.path].errors += 1;
    });
    return map;
  }, [stats.recentLogs]);

  return (
    <div className="relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] right-[10%] w-[800px] h-[800px] bg-sky-500/[0.08] dark:bg-sky-500/[0.14] rounded-full blur-[140px]"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [0, -90, 0],
            x: [0, -40, 0],
            y: [0, 60, 0],
          }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute top-[30%] left-[-10%] w-[600px] h-[600px] bg-blue-500/[0.06] dark:bg-blue-500/[0.12] rounded-full blur-[120px]"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [0, 30, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[20%] w-[700px] h-[700px] bg-cyan-500/[0.05] dark:bg-cyan-500/[0.10] rounded-full blur-[140px]"
        />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-5 max-w-7xl mx-auto pb-10 relative"
      >
        {/* Status bar */}
        <motion.div
          variants={itemVariants}
          className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
        >
          <div className="flex items-center gap-3 bg-white/40 dark:bg-white/[0.03] backdrop-blur-md border border-white/60 dark:border-white/[0.08] px-4 py-2 rounded-2xl">
            <div className="relative flex h-2.5 w-2.5">
              <span
                className={`absolute inline-flex h-full w-full rounded-full ${autoRefresh ? "bg-emerald-400 animate-[ping_2s_infinite] opacity-75" : "bg-zinc-400 opacity-0"}`}
              ></span>
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${autoRefresh ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-zinc-400"}`}
              ></span>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                {autoRefresh ? "Pemantauan Langsung" : "Dijeda"}
                <span className="text-zinc-400 dark:text-zinc-500 ml-1.5 font-normal">
                  · diperbarui{" "}
                  {lastUpdated
                    ? formatTimestampHHMMSS(lastUpdated.toISOString())
                    : "…"}
                </span>
              </p>
              {error && (
                <p className="text-[11px] text-rose-500 mt-0.5">{error}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <RangeDropdown value={timeRange} onChange={setTimeRange} />

            <IntervalDropdown
              value={refreshInterval}
              onChange={setRefreshInterval}
            />

            <button
              onClick={() => setAutoRefresh((v) => !v)}
              className="w-9 h-9 flex items-center justify-center bg-white/60 dark:bg-white/[0.03] backdrop-blur-xl border border-zinc-200/60 dark:border-white/[0.06] rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/[0.06] transition-colors"
            >
              {autoRefresh ? (
                <Pause className="w-3.5 h-3.5" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={fetchStats}
              disabled={isRefreshing}
              className="w-9 h-9 flex items-center justify-center bg-gradient-to-br from-sky-500/10 to-blue-500/10 backdrop-blur-xl border border-sky-500/30 rounded-xl text-sky-600 dark:text-sky-300 hover:from-sky-500/20 hover:to-blue-500/20 transition-colors disabled:opacity-50 shadow-lg shadow-sky-500/10"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>

            {/* Tombol Reset Log */}
            <div className="relative">
              <button
                onClick={() => setShowClearConfirm((v) => !v)}
                title="Reset Log Activity"
                className="w-9 h-9 flex items-center justify-center bg-rose-500/10 backdrop-blur-xl border border-rose-500/30 rounded-xl text-rose-500 dark:text-rose-400 hover:bg-rose-500/20 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              <AnimatePresence>
                {showClearConfirm && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-[220px] bg-white/95 dark:bg-zinc-950/95 backdrop-blur-2xl border border-zinc-200/60 dark:border-white/[0.08] rounded-xl shadow-xl shadow-black/10 overflow-hidden z-[200] p-3"
                  >
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 mb-2">Reset Log Activity</p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-3">Pilih log mana yang ingin dihapus:</p>
                    <div className="space-y-1.5">
                      <button
                        onClick={() => handleClearLogs(7)}
                        disabled={isClearingLogs}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 transition-colors disabled:opacity-50"
                      >
                        🗂 Hapus log &gt; 7 hari
                      </button>
                      <button
                        onClick={() => handleClearLogs(30)}
                        disabled={isClearingLogs}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500/20 transition-colors disabled:opacity-50"
                      >
                        🗂 Hapus log &gt; 30 hari
                      </button>
                      <button
                        onClick={() => handleClearLogs()}
                        disabled={isClearingLogs}
                        className="w-full text-left px-3 py-2 text-xs rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 border border-rose-500/20 transition-colors disabled:opacity-50"
                      >
                        🗑 Hapus SEMUA log
                      </button>
                    </div>
                    {isClearingLogs && (
                      <p className="text-[11px] text-zinc-400 mt-2 text-center">Menghapus...</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>

        {/* Toast sukses clear log */}
        <AnimatePresence>
          {clearLogsMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="fixed top-4 right-4 z-[300] bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/30"
            >
              ✅ {clearLogsMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pipeline Hero */}
        <motion.div variants={itemVariants} className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-600/30 via-blue-600/20 to-cyan-600/30 rounded-3xl blur-xl opacity-60 dark:opacity-40"></div>
          <div className="relative rounded-3xl bg-white/70 dark:bg-zinc-950/60 backdrop-blur-2xl border border-white/60 dark:border-white/[0.06] shadow-[0_20px_60px_-15px_rgba(14,165,233,0.15)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] p-7 overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-500/[0.10] dark:bg-sky-500/[0.18] rounded-full blur-3xl -mr-40 -mt-40 pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-500/[0.06] dark:bg-blue-500/[0.12] rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

            <div className="relative z-10 mb-7">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 backdrop-blur-sm border border-sky-500/30 flex items-center justify-center shadow-lg shadow-sky-500/20">
                  <Layers className="w-5 h-5 text-sky-600 dark:text-sky-300" />
                </div>
                <h2 className="text-xl font-bold text-zinc-800 dark:text-white tracking-tight">
                  Unified API Gateway Pipeline
                </h2>
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm ml-[52px]">
                Real-time workflow monitoring and routing status.
              </p>
            </div>

            <div className="relative z-10 rounded-2xl bg-white/40 dark:bg-black/30 backdrop-blur-xl border border-white/40 dark:border-white/[0.04] p-4 sm:p-6 lg:p-8 flex flex-col xl:flex-row items-center justify-between gap-6">
              <motion.div
                whileHover={{ y: -3 }}
                className="flex flex-col items-center flex-1"
              >
                <div className="w-[88px] h-[88px] rounded-2xl bg-gradient-to-br from-white/80 dark:from-zinc-800/60 to-white/40 dark:to-zinc-900/60 backdrop-blur-xl border border-blue-500/20 dark:border-blue-500/30 shadow-[0_10px_40px_-10px_rgba(59,130,246,0.4)] flex items-center justify-center mb-4">
                  <Users
                    className="w-9 h-9 text-blue-600 dark:text-blue-300"
                    strokeWidth={2}
                  />
                </div>
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-100">
                  Clients / Devs
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 px-2.5 py-0.5 rounded-md bg-white/60 dark:bg-white/[0.04] border border-white/40 dark:border-white/[0.06]">
                  Sandbox &amp; Prod
                </p>
              </motion.div>

              <div className="hidden xl:flex flex-col items-center justify-center">
                <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold mb-1.5 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/30 backdrop-blur-md flex items-center gap-1.5 shadow-lg shadow-emerald-500/10">
                  <Lock className="w-3 h-3" /> JWT Auth
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600" />
              </div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="flex flex-col items-center flex-[2]"
              >
                <div className="relative w-full max-w-[300px]">
                  <div className="absolute -inset-1 bg-gradient-to-r from-sky-500 via-blue-500 to-cyan-500 rounded-[28px] blur-2xl opacity-40 dark:opacity-60"></div>
                  <div className="relative bg-gradient-to-br from-sky-500/40 via-blue-500/40 to-cyan-500/40 p-[1.5px] rounded-[26px] shadow-[0_0_60px_rgba(14,165,233,0.4)]">
                    <div className="bg-zinc-950 rounded-[24px] p-7 text-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500 rounded-full blur-3xl opacity-30 -mr-10 -mt-10 pointer-events-none"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-500 rounded-full blur-3xl opacity-25 -ml-8 -mb-8 pointer-events-none"></div>
                      <div className="relative z-10">
                        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 border border-sky-400/40 flex items-center justify-center shadow-lg shadow-sky-500/30">
                          <Cpu
                            className="w-7 h-7 text-sky-300 drop-shadow-[0_0_10px_rgba(14,165,233,0.8)]"
                            strokeWidth={2}
                          />
                        </div>
                        <p className="text-lg font-bold text-white tracking-tight">
                          API Gateway
                        </p>
                        <div className="flex justify-center flex-wrap gap-1.5 mt-4">
                          {["RATE LIMIT", "SECURITY", "CACHE"].map((tag) => (
                            <span
                              key={tag}
                              className="text-[9px] uppercase font-bold tracking-wider bg-white/[0.04] border border-white/[0.08] text-zinc-300 px-2 py-1 rounded-md backdrop-blur-md hover:border-sky-500/40 hover:text-sky-200 transition-colors"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="hidden xl:flex flex-col items-center justify-center">
                <div className="text-[10px] text-sky-700 dark:text-sky-300 font-bold mb-1.5 bg-sky-500/10 px-3 py-1.5 rounded-lg border border-sky-500/30 backdrop-blur-md flex items-center gap-1.5 shadow-lg shadow-sky-500/10">
                  <ArrowRight className="w-3 h-3" /> Routing
                </div>
                <ArrowRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600" />
              </div>

              <div className="flex flex-col items-stretch flex-1 min-w-0 gap-2.5 w-full xl:w-auto">
                {(stats.requestsPerRoute.length > 0
                  ? stats.requestsPerRoute.slice(0, 3)
                  : [
                      { path: "/v1/chat/completions", count: 0 },
                      { path: "/v1/models", count: 0 },
                      { path: "/v1/embeddings", count: 0 },
                    ]
                ).map((route, i) => {
                  const meta = getUpstreamMeta(route.path);
                  const Icon = meta.icon;
                  const h = upstreamHealth[route.path];
                  const errRate = h && h.total > 0 ? h.errors / h.total : 0;
                  const health =
                    errRate >= 0.5
                      ? {
                          label: "Critical",
                          cls: "bg-rose-500/15 text-rose-300 border-rose-500/30",
                        }
                      : errRate >= 0.1
                        ? {
                            label: "Heavy Load",
                            cls: "bg-amber-500/15 text-amber-300 border-amber-500/30",
                          }
                        : {
                            label: "Healthy",
                            cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
                          };
                  return (
                    <motion.div
                      key={i}
                      whileHover={{ x: 4 }}
                      className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/50 dark:border-white/[0.06] rounded-xl p-3 flex items-center gap-3 hover:border-sky-500/40 transition-colors"
                    >
                      <div
                        className={`w-9 h-9 rounded-lg bg-gradient-to-br from-white/60 dark:from-white/[0.04] to-white/30 dark:to-white/[0.02] border border-white/50 dark:border-white/[0.08] flex items-center justify-center shrink-0 shadow-lg ${meta.glow}`}
                      >
                        <Icon
                          className="w-4 h-4 text-zinc-700 dark:text-zinc-200"
                          strokeWidth={2.2}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-100 truncate">
                          {meta.label}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-md border backdrop-blur-md ${health.cls}`}
                      >
                        {health.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stat Cards */}
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
        >
          <StatCard
            label="Total Responses"
            value={totalResponses}
            formatter={formatNumber}
            icon={Activity}
            iconGradient="from-sky-500 to-blue-600"
            iconShadow="shadow-sky-500/40"
            trendValue={trends.requests}
            trendType="percentage"
            higherIsBetter
          />
          <StatCard
            label="Rata-rata Latensi"
            value={stats.summary.avgResponseTime}
            formatter={formatLatency}
            icon={Clock}
            iconGradient="from-emerald-400 to-teal-500"
            iconShadow="shadow-emerald-500/40"
            trendValue={trends.latency}
            trendType="ms"
            higherIsBetter={false}
          />
          <StatCard
            label="Total Eror (4XX/5XX)"
            value={errorAllCount}
            formatter={formatNumber}
            icon={AlertTriangle}
            iconGradient="from-rose-500 to-pink-600"
            iconShadow="shadow-rose-500/40"
            trendValue={trends.errorsAll}
            trendType="percentage"
            higherIsBetter={false}
          />
          <StatCard
            label="Trafik / Menit"
            value={rpmStats.current}
            icon={Activity}
            iconGradient="from-cyan-500 to-blue-600"
            iconShadow="shadow-cyan-500/40"
            trendValue={rpmStats.delta}
            trendType="absolute"
            higherIsBetter
          />
        </motion.div>

        {/* GPU Monitoring — kartu fixed: PC Putih GPU 0, GPU 1, PC Hitam GPU 0, GPU 1 */}
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 xl:grid-cols-2 gap-5"
        >
          {EXPECTED_HOSTS.map((expected, i) => {
            const live = gpuList.find((g) => g.hostId === expected.hostId);
            const data =
              live ??
              offlineGpu(expected.hostId, expected.name, expected.vramTotal);
            return (
              <SystemMonitorCard
                key={expected.hostId}
                data={data}
                accent={i % 2 === 0 ? "sky" : "cyan"}
                pulsing={autoRefresh}
              />
            );
          })}
        </motion.div>

        {/* Traffic + Pie */}
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 xl:grid-cols-3 gap-5"
        >
          <motion.div
            variants={itemVariants}
            className="xl:col-span-2 relative"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-sky-500/20 to-blue-500/20 rounded-3xl blur-xl opacity-40 dark:opacity-30"></div>
            <div className="relative rounded-3xl bg-white/70 dark:bg-zinc-950/60 backdrop-blur-2xl border border-white/60 dark:border-white/[0.06] p-6 overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/[0.06] dark:bg-sky-500/[0.10] rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

              <div className="relative z-10 flex justify-between items-center mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/20 border border-sky-500/30 flex items-center justify-center shadow-lg shadow-sky-500/20">
                    <BarChart3 className="w-5 h-5 text-sky-600 dark:text-sky-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-800 dark:text-white text-base">
                      Real-time Traffic Overview
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      Volume jaringan client menuju upstream ·{" "}
                      <span className="text-sky-600 dark:text-sky-400 font-medium">
                        {RANGE_LABEL_LONG[timeRange]}
                      </span>
                      {tsSummary && (
                        <span className="text-zinc-400 dark:text-zinc-500">
                          {" "}
                          · {tsSummary.totalRequests.toLocaleString(
                            "id-ID",
                          )}{" "}
                          req
                          {tsSummary.totalErrors > 0 &&
                            ` · ${tsSummary.totalErrors} error`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative z-10 h-[280px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart
                    data={timeSeries}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="reqG" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#0ea5e9"
                          stopOpacity={0.5}
                        />
                        <stop
                          offset="95%"
                          stopColor="#0ea5e9"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="currentColor"
                      className="text-zinc-200/40 dark:text-white/[0.05]"
                    />
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#a1a1aa", fontSize: 10 }}
                      dy={10}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#a1a1aa", fontSize: 10 }}
                      dx={-5}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(15,15,20,0.85)",
                        backdropFilter: "blur(12px)",
                        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                        fontSize: "12px",
                        color: "#fff",
                      }}
                      itemStyle={{ color: "#fafafa" }}
                      labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
                      cursor={{
                        stroke: "#0ea5e9",
                        strokeWidth: 1,
                        strokeDasharray: "4 4",
                      }}
                      formatter={(value: any) => [value, "Request"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="requests"
                      stroke="#0ea5e9"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#reqG)"
                      activeDot={{
                        r: 6,
                        strokeWidth: 2,
                        stroke: "#0f0f14",
                        fill: "#0ea5e9",
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>

          <motion.div variants={itemVariants} className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-3xl blur-xl opacity-40 dark:opacity-30"></div>
            <div className="relative rounded-3xl bg-white/70 dark:bg-zinc-950/60 backdrop-blur-2xl border border-white/60 dark:border-white/[0.06] p-6 h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <PieChart className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-800 dark:text-white text-base">
                    Usage Analytics
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Status code distribution
                  </p>
                </div>
              </div>

              <div
                className="relative flex items-center justify-center"
                style={{ height: 200 }}
              >
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={62}
                      outerRadius={88}
                      paddingAngle={statusData.length > 1 ? 3 : 0}
                      dataKey="value"
                      stroke="none"
                      cornerRadius={6}
                      isAnimationActive
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`c-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(15,15,20,0.85)",
                        backdropFilter: "blur(12px)",
                        fontSize: "12px",
                        color: "#fff",
                      }}
                      itemStyle={{ color: "#fafafa" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-black text-zinc-800 dark:text-white tracking-tight tabular-nums">
                    {formatNumber(totalResponses)}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                    RESPONSES
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                {statusData.slice(0, 4).map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/40 dark:bg-white/[0.02] border border-white/40 dark:border-white/[0.04]"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: item.color,
                        boxShadow: `0 0 8px ${item.color}`,
                      }}
                    ></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-200 truncate">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-zinc-500 dark:text-zinc-400 tabular-nums">
                        {item.value.toLocaleString("id-ID")} reqs
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Active Endpoint Monitoring */}
        <motion.div variants={itemVariants} className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 rounded-3xl blur-xl opacity-40 dark:opacity-30"></div>
          <div className="relative rounded-3xl bg-white/70 dark:bg-zinc-950/60 backdrop-blur-2xl border border-white/60 dark:border-white/[0.06] overflow-hidden">
            <div className="px-6 py-5 border-b border-white/40 dark:border-white/[0.06] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Server className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-800 dark:text-white text-base">
                    Active Endpoint Monitoring
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Status dan latensi upstream secara aktual.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEndpointDetailOpen(true)}
                className="px-4 py-2 text-xs font-semibold bg-white/60 dark:bg-white/[0.04] border border-zinc-200/60 dark:border-white/[0.08] rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-white/[0.08] transition-colors backdrop-blur-md cursor-pointer"
              >
                Lihat Detail Analytics
              </button>
            </div>

            <div className="overflow-x-auto">
              {endpointMetrics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
                  <Server className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-sm">Belum ada trafik endpoint</p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-white/40 dark:bg-white/[0.02]">
                    <tr className="border-b border-white/40 dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider font-bold">
                      <th className="px-6 py-3">Endpoint</th>
                      <th className="px-6 py-3">Method</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Rata-rata Latensi</th>
                      <th className="px-6 py-3">
                        Trafik ({RANGE_LABEL_LONG[timeRange]})
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpointMetrics.map((e, i) => {
                      const trafficUnit =
                        timeRange === "5m"
                          ? "/5m"
                          : timeRange === "1h"
                            ? "/h"
                            : timeRange === "24h"
                              ? "/24h"
                              : timeRange === "7d"
                                ? "/7h"
                                : timeRange === "30d"
                                  ? "/30h"
                                  : "/yr";
                      const trafficLabel = `${formatNumber(e.count)}${trafficUnit}`;
                      const latencyDanger = e.health.label === "Degraded";
                      return (
                        <motion.tr
                          key={i}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: i * 0.03 }}
                          className="border-b border-white/30 dark:border-white/[0.03] hover:bg-sky-500/5 transition-colors"
                        >
                          <td className="px-6 py-4 font-mono text-xs font-bold text-zinc-700 dark:text-zinc-200">
                            {e.path}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md ${methodPillColor(e.method)}`}
                            >
                              {e.method}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor: e.health.dot,
                                  boxShadow: `0 0 8px ${e.health.dot}`,
                                }}
                              ></span>
                              <span
                                className={`text-sm font-bold ${e.health.cls}`}
                              >
                                {e.health.label}
                              </span>
                            </div>
                          </td>
                          <td
                            className={`px-6 py-4 font-mono text-sm tabular-nums ${latencyDanger ? "text-rose-400 font-bold" : "text-zinc-600 dark:text-zinc-300"}`}
                          >
                            {formatLatency(e.avgLatency)}
                          </td>
                          <td className="px-6 py-4 font-mono text-sm text-zinc-600 dark:text-zinc-300 tabular-nums">
                            {trafficLabel}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </motion.div>

        {/* Recent Activity Logs */}
        <motion.div variants={itemVariants} className="relative">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500/20 via-amber-500/15 to-rose-500/20 rounded-3xl blur-xl opacity-40 dark:opacity-30"></div>
          <div className="relative rounded-3xl bg-white/70 dark:bg-zinc-950/60 backdrop-blur-2xl border border-white/60 dark:border-white/[0.06] overflow-hidden">
            <div className="px-6 py-5 border-b border-white/40 dark:border-white/[0.06] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/30 flex items-center justify-center shadow-lg shadow-rose-500/20">
                  <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-300" />
                </div>
                <div>
                  <h3 className="font-bold text-zinc-800 dark:text-white text-base">
                    Recent Activity Logs
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Deteksi anomali dari filter Gateway &amp; Upstream.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg backdrop-blur-md">
                <span
                  className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${autoRefresh ? "animate-pulse" : ""} shadow-[0_0_8px_rgba(16,185,129,0.8)]`}
                ></span>
                <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                  {autoRefresh ? "Streaming" : "Dijeda"}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[480px] hidden-scrollbar">
              {notableLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
                  <Sparkles className="w-10 h-10 mb-3 opacity-40 text-emerald-500" />
                  <p className="text-sm font-medium">
                    Tidak ada anomali terdeteksi
                  </p>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Sistem berjalan dengan baik
                  </p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-white/40 dark:bg-white/[0.02] sticky top-0 backdrop-blur-md z-10">
                    <tr className="border-b border-white/40 dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 text-[10px] uppercase tracking-wider font-bold">
                      <th className="px-6 py-3">Tanda Waktu</th>
                      <th className="px-6 py-3">Klien / Entitas</th>
                      <th className="px-6 py-3">Upstream Target</th>
                      <th className="px-6 py-3">Status Kode</th>
                      <th className="px-6 py-3">Detail Info</th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence initial={false}>
                      {notableLogs.map((log, i) => {
                        const detail = getDetailInfo(log);
                        const isError = log.statusCode >= 400;
                        return (
                          <motion.tr
                            key={`${log.timestamp}-${i}`}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.3, ease: "easeOut" }}
                            className="border-b border-white/30 dark:border-white/[0.03] hover:bg-sky-500/[0.04] dark:hover:bg-sky-500/[0.08] transition-all cursor-default group/row"
                          >
                            <td className="px-6 py-4 font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums whitespace-nowrap">
                              {formatTimestampHHMMSS(log.timestamp)}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs font-bold text-sky-600 dark:text-sky-300 whitespace-nowrap group-hover/row:translate-x-1 transition-transform">
                              {log.clientId ||
                                (log.ip ? `${log.ip} (IP)` : "unknown")}
                            </td>
                            <td className="px-6 py-4 font-mono text-xs text-zinc-700 dark:text-zinc-200">
                              {log.path}
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex items-center px-2.5 py-1 border rounded-md text-[10px] font-bold tracking-wider backdrop-blur-md whitespace-nowrap ${getStatusBadgeStyle(log.statusCode)}`}
                              >
                                {getStatusLabel(log.statusCode)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 flex-wrap">
                                {!isError && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
                                )}
                                <span
                                  className={`text-xs ${isError ? (log.statusCode >= 500 ? "text-rose-300 font-semibold" : "text-zinc-300") : "text-zinc-500 dark:text-zinc-400"}`}
                                >
                                  {detail.text}
                                </span>
                                {detail.tag && (
                                  <span
                                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border backdrop-blur-md ${detail.tagCls || "bg-amber-500/15 text-amber-300 border-amber-500/40"}`}
                                  >
                                    {detail.tag}
                                  </span>
                                )}
                              </div>
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Detail Analytics Active Endpoint Monitoring Overlay Modal ── */}
      <AnimatePresence>
        {isEndpointDetailOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
            {/* Click outside to close */}
            <div
              className="absolute inset-0 cursor-default"
              onClick={() => setIsEndpointDetailOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="relative w-full max-w-4xl max-h-[85vh] bg-[#0d0f14] border border-white/[0.08] rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col z-10"
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-white/[0.06] flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <Server className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-white text-lg">
                      Active Endpoint Monitoring — Analisis Mendalam
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Analisis performa real-time, tingkat kegagalan (error rate),
                    status kesehatan, dan total trafik seluruh Model API
                    aktif.
                  </p>
                </div>
                <button
                  onClick={() => setIsEndpointDetailOpen(false)}
                  className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Filters & Search Control Bar */}
              <div className="px-6 py-4 bg-[#0a0c10] border-b border-white/[0.04] flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Search Input */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Cari endpoint (mis. /api/generate)..."
                    value={endpointSearchQuery}
                    onChange={(e) => setEndpointSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 text-xs bg-white/[0.03] border border-white/[0.08] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-sky-500/50 transition-colors"
                  />
                  {endpointSearchQuery && (
                    <button
                      onClick={() => setEndpointSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Status Filter Tab Buttons */}
                <div className="flex items-center gap-1.5 p-1 bg-white/[0.02] border border-white/[0.05] rounded-xl self-start md:self-auto">
                  {(["all", "Healthy", "Warning", "Degraded"] as const).map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() => setEndpointStatusFilter(status)}
                        className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-colors cursor-pointer capitalize ${
                          endpointStatusFilter === status
                            ? status === "Healthy"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : status === "Warning"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : status === "Degraded"
                                  ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                  : "bg-white/[0.08] text-white border border-white/[0.08]"
                            : "text-zinc-400 hover:text-zinc-200 border border-transparent"
                        }`}
                      >
                        {status === "all" ? "Semua Status" : status}
                      </button>
                    ),
                  )}
                </div>
              </div>

              {/* Table Data Area */}
              <div className="flex-1 overflow-y-auto p-6 min-h-[300px]">
                {filteredEndpointMetrics.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-zinc-500">
                    <Server className="w-12 h-12 mb-3 opacity-30 animate-pulse text-zinc-400" />
                    <p className="text-sm font-semibold">
                      Tidak ada endpoint yang cocok
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Coba sesuaikan kata kunci pencarian atau filter status
                      Anda.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/[0.06] text-zinc-500 text-[10px] uppercase tracking-wider font-bold">
                        <th className="pb-3 pl-2">Endpoint</th>
                        <th className="pb-3 px-4">Method</th>
                        <th className="pb-3 px-4">Health Status</th>
                        <th className="pb-3 px-4 text-right">Rerata Latensi</th>
                        <th className="pb-3 px-4 text-right">
                          Tingkat Kesuksesan
                        </th>
                        <th className="pb-3 pr-2 text-right">
                          Trafik (24 Jam)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {filteredEndpointMetrics.map((e, idx) => {
                        const successRate = +(100 - e.errorRate).toFixed(1);
                        const isDegraded = e.health.label === "Degraded";
                        const isWarning = e.health.label === "Warning";

                        return (
                          <tr
                            key={idx}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="py-4 pl-2 font-mono text-xs font-semibold text-zinc-300 max-w-xs truncate">
                              {e.path}
                            </td>
                            <td className="py-4 px-4">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border backdrop-blur-md ${methodPillColor(
                                  e.method,
                                )}`}
                              >
                                {e.method}
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{
                                    backgroundColor: e.health.dot,
                                    boxShadow: `0 0 10px ${e.health.dot}`,
                                  }}
                                ></span>
                                <span
                                  className={`text-xs font-bold ${e.health.cls}`}
                                >
                                  {e.health.label}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 font-mono text-xs tabular-nums text-right">
                              <span
                                className={
                                  isDegraded
                                    ? "text-rose-400 font-bold"
                                    : isWarning
                                      ? "text-amber-400 font-medium"
                                      : "text-emerald-400 font-medium"
                                }
                              >
                                {formatLatency(e.avgLatency)}
                              </span>
                            </td>
                            <td className="py-4 px-4 font-mono text-xs tabular-nums text-right">
                              <span
                                className={
                                  successRate < 95
                                    ? "text-rose-400 font-bold"
                                    : successRate < 99
                                      ? "text-amber-400 font-medium"
                                      : "text-emerald-400 font-bold"
                                }
                              >
                                {successRate}%
                              </span>
                            </td>
                            <td className="py-4 pr-2 font-mono text-xs text-zinc-400 tabular-nums text-right font-bold">
                              {e.count.toLocaleString("id-ID")} reqs
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-[#0a0c10] border-t border-white/[0.04] flex justify-between items-center text-[10px] text-zinc-500">
                <div>
                  Menampilkan{" "}
                  <span className="text-zinc-300 font-bold">
                    {filteredEndpointMetrics.length}
                  </span>{" "}
                  dari{" "}
                  <span className="text-zinc-300 font-bold">
                    {allEndpointMetrics.length}
                  </span>{" "}
                  total endpoint aktif.
                </div>
                <div className="font-mono">Auto-sync realtime via SSE</div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// StatCard
// ────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: number;
  formatter?: (v: number) => string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconGradient: string;
  iconShadow: string;
  trendValue: number;
  trendType: "percentage" | "ms" | "absolute";
  higherIsBetter: boolean;
}

function StatCard({
  label,
  value,
  formatter = (v) => String(v),
  icon: Icon,
  iconGradient,
  iconShadow,
  trendValue,
  trendType,
  higherIsBetter,
}: StatCardProps) {
  const isUp = trendValue > 0;
  const isNeutral = trendValue === 0 || !isFinite(trendValue);
  const isGood = isNeutral ? false : higherIsBetter ? isUp : !isUp;

  const trendDisplay =
    trendType === "percentage"
      ? `${isUp ? "+" : ""}${trendValue.toFixed(1)}%`
      : trendType === "ms"
        ? `${isUp ? "+" : ""}${Math.round(trendValue)}ms`
        : `${isUp ? "+" : ""}${trendValue}`;

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{
        y: -6,
        scale: 1.02,
        transition: { duration: 0.3, ease: "easeOut" },
      }}
      className="relative group h-full"
    >
      {/* Dynamic border glow on hover */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-white/10 to-transparent rounded-[33px] opacity-0 group-hover:opacity-100 transition-opacity"></div>

      <div className="relative rounded-[32px] bg-[#0B0E14] border border-white/[0.03] p-7 h-full flex flex-col justify-between shadow-2xl overflow-hidden cursor-default transition-all duration-500 group-hover:shadow-sky-500/5">
        {/* Subtle inner glow matching the icon */}
        <div
          className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${iconGradient} rounded-full blur-[80px] opacity-[0.12] pointer-events-none group-hover:opacity-20 transition-opacity`}
        ></div>

        <div className="relative z-10 flex justify-between items-start">
          <div className="min-w-0 flex-1 mt-1">
            <h4 className="text-[40px] font-black text-white tracking-tight tabular-nums leading-none mb-4 group-hover:text-sky-100 transition-colors">
              <AnimatedNumber value={value} formatter={formatter} />
            </h4>
            <p className="text-zinc-400 text-[11px] font-bold uppercase tracking-widest leading-tight group-hover:text-zinc-300 transition-colors">
              {label}
            </p>
          </div>
          <div
            className={`relative w-14 h-14 rounded-[20px] bg-gradient-to-br ${iconGradient} flex items-center justify-center shadow-xl ${iconShadow} shrink-0 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 ml-4`}
          >
            <Icon
              className="w-6 h-6 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
              strokeWidth={2.2}
            />
          </div>
        </div>

        <div className="relative z-10 mt-8 flex items-center gap-3">
          {!isNeutral ? (
            <motion.span
              initial={{ opacity: 0.8, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-colors ${
                isGood
                  ? "text-emerald-400 bg-emerald-500/[0.08] border-emerald-500/20 group-hover:bg-emerald-500/[0.12]"
                  : "text-rose-400 bg-rose-500/[0.08] border-rose-500/20 group-hover:bg-rose-500/[0.12]"
              }`}
            >
              {isUp ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )}
              <span className="text-[11px] font-bold">{trendDisplay}</span>
            </motion.span>
          ) : (
            <span className="px-3 py-1.5 rounded-[10px] text-zinc-300 font-bold text-[11px] bg-white/[0.03] border border-white/[0.05] group-hover:bg-white/[0.06] transition-colors">
              stabil
            </span>
          )}
          <span className="text-[11px] text-zinc-500 font-medium group-hover:text-zinc-400 transition-colors">
            vs kemarin
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// GPU Monitor Card
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// System Monitor Card â€” fokus CPU/RAM/Disk per host fisik
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface SystemMonitorCardProps {
  data: GpuMetrics;
  accent: "sky" | "cyan";
  pulsing?: boolean;
}

function SystemMonitorCard({ data, accent, pulsing }: SystemMonitorCardProps) {
  const accentMap = {
    sky: {
      glow: "from-sky-500/30 to-blue-500/20",
      icon: "bg-gradient-to-br from-sky-500/20 to-blue-500/20 border-sky-500/30 shadow-sky-500/30",
      text: "text-sky-600 dark:text-sky-300",
      accentDot: "#0ea5e9",
    },
    cyan: {
      glow: "from-cyan-500/30 to-blue-500/20",
      icon: "bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border-cyan-500/30 shadow-cyan-500/30",
      text: "text-cyan-600 dark:text-cyan-300",
      accentDot: "#06b6d4",
    },
  };
  const c = accentMap[accent];
  const isFresh = data.status === "online";

  const cpuLoad = data.cpuLoad ?? 0;
  const memUsed = data.memUsed ?? 0;
  const memTotal = data.memTotal ?? 0;
  const diskUsed = data.diskUsed ?? 0;
  const diskTotal = data.diskTotal ?? 0;
  const memPct = memTotal > 0 ? (memUsed / memTotal) * 100 : 0;
  const diskPct = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;

  const cpuColor =
    cpuLoad > 85 ? "#fb7185" : cpuLoad > 65 ? "#fbbf24" : "#34d399";
  const memColor =
    memPct > 85 ? "#fb7185" : memPct > 65 ? "#fbbf24" : c.accentDot;
  const diskColor =
    diskPct > 85 ? "#fb7185" : diskPct > 65 ? "#fbbf24" : c.accentDot;

  return (
    <motion.div variants={itemVariants} className="relative group">
      <div
        className={`absolute -inset-0.5 bg-gradient-to-r ${c.glow} rounded-3xl blur-xl transition-opacity duration-500 ${
          isFresh ? "opacity-70 dark:opacity-60" : "opacity-40 dark:opacity-30"
        } group-hover:opacity-80`}
      ></div>
      <motion.div
        key={data.receivedAt || data.hostId}
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        className={`absolute -inset-0.5 bg-gradient-to-r ${c.glow} rounded-3xl blur-md pointer-events-none`}
      ></motion.div>
      <div className="relative rounded-3xl bg-white/70 dark:bg-zinc-950/60 backdrop-blur-2xl border border-white/60 dark:border-white/[0.06] p-6 overflow-hidden">
        <div
          className={`absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl ${c.glow} rounded-full blur-3xl -mr-16 -mt-16 opacity-30 pointer-events-none`}
        ></div>

        <div className="relative z-10 flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-11 h-11 rounded-xl ${c.icon} border flex items-center justify-center shadow-lg shrink-0`}
            >
              <Server className={`w-5 h-5 ${c.text}`} strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-zinc-800 dark:text-white text-base tracking-tight truncate">
                {data.name}
              </h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 font-mono truncate">
                {data.cpuModel
                  ? `${data.cpuModel}${data.cpuCores ? ` Â· ${data.cpuCores} cores` : ""}`
                  : "System Monitor"}
              </p>
            </div>
          </div>

          {data.status === "online" ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg backdrop-blur-md shrink-0 ml-2">
              <span
                className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${pulsing && isFresh ? "animate-pulse" : ""} shadow-[0_0_8px_rgba(16,185,129,0.8)]`}
              ></span>
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
                LIVE
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-500/10 border border-zinc-500/30 rounded-lg backdrop-blur-md shrink-0 ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400"></span>
              <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Offline
              </span>
            </div>
          )}
        </div>

        {data.status === "offline" && (
          <div className="relative z-10 mb-4 px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/20 backdrop-blur-md flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              <span className="font-bold text-amber-600 dark:text-amber-400">
                Menunggu data dari {data.name}.
              </span>{" "}
              Cek SSH poller atau koneksi ke bastion.
            </div>
          </div>
        )}

        {data.status === "online" && (
          <>
            <div className="relative z-10 grid grid-cols-2 gap-3 mb-4">
              <BigMetric
                label="CPU Load"
                icon={Cpu}
                value={cpuLoad}
                unit="%"
                barColor={cpuColor}
                max={100}
              />
              <BigMetric
                label="Load Avg"
                icon={Activity}
                value={
                  data.loadAvg1 != null
                    ? Math.round(data.loadAvg1 * 100) / 100
                    : 0
                }
                unit="1m"
                barColor={cpuColor}
                max={data.cpuCores ?? 16}
              />
            </div>

            {memTotal > 0 && (
              <div className="relative z-10 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MemoryStick className={`w-3.5 h-3.5 ${c.text}`} />
                    <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                      RAM Usage
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-200 tabular-nums">
                    {memUsed.toFixed(1)} / {memTotal.toFixed(0)} GB{" "}
                    <span className="text-zinc-400 ml-1">
                      ({memPct.toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div className="h-2.5 bg-zinc-200/60 dark:bg-white/[0.05] rounded-full overflow-hidden border border-white/40 dark:border-white/[0.04]">
                  <motion.div
                    key={`mem-${memUsed}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${memPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${memColor}, ${memColor}dd)`,
                      boxShadow: `0 0 12px ${memColor}80`,
                    }}
                  />
                </div>
              </div>
            )}

            {diskTotal > 0 && (
              <div className="relative z-10 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <HardDrive className={`w-3.5 h-3.5 ${c.text}`} />
                    <span className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                      Disk Usage
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-200 tabular-nums">
                    {diskUsed.toFixed(0)} / {diskTotal.toFixed(0)} GB{" "}
                    <span className="text-zinc-400 ml-1">
                      ({diskPct.toFixed(1)}%)
                    </span>
                  </span>
                </div>
                <div className="h-2.5 bg-zinc-200/60 dark:bg-white/[0.05] rounded-full overflow-hidden border border-white/40 dark:border-white/[0.04]">
                  <motion.div
                    key={`disk-${diskUsed}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${diskPct}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${diskColor}, ${diskColor}dd)`,
                      boxShadow: `0 0 12px ${diskColor}80`,
                    }}
                  />
                </div>
              </div>
            )}

            {data.uptime != null && (
              <div className="relative z-10 flex items-center justify-end gap-2 mt-3 pt-3 border-t border-white/40 dark:border-white/[0.04]">
                <Clock className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 tabular-nums">
                  Uptime {formatUptime(data.uptime)}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

function formatUptime(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

function BigMetric({
  label,
  icon: Icon,
  value,
  unit,
  barColor,
  max,
}: {
  label: string;
  icon: any;
  value: number;
  unit: string;
  barColor: string;
  max: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="bg-white/40 dark:bg-white/[0.02] border border-white/40 dark:border-white/[0.04] rounded-xl p-3.5 backdrop-blur-md">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            {label}
          </span>
        </div>
      </div>
      <div className="flex items-baseline gap-1 mb-2">
        <motion.span
          key={value}
          initial={{ scale: 1.1, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="text-2xl font-black tabular-nums tracking-tight"
          style={{ color: barColor }}
        >
          {value}
        </motion.span>
        <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
          {unit}
        </span>
      </div>
      <div className="h-1.5 bg-zinc-200/60 dark:bg-white/[0.05] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: barColor, boxShadow: `0 0 10px ${barColor}99` }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: any;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-2 bg-white/40 dark:bg-white/[0.02] border border-white/40 dark:border-white/[0.04] rounded-lg backdrop-blur-md">
      <Icon className={`w-3.5 h-3.5 ${accent} shrink-0`} />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider leading-none">
          {label}
        </p>
        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-200 tabular-nums mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}
