import { adminFetch } from "../lib/api";
import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Lock,
  Plus,
  Trash2,
  Globe,
  Shield,
  Activity,
  ShieldCheck,
  Database,
  Key,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import { useSSE } from "../lib/useSSE";

type IPAllow = { ip: string; label: string };
type IPDeny = { ip: string; reason: string };

type SecurityConfig = {
  ipAllowlist: IPAllow[];
  ipDenylist: IPDeny[];
  rateLimitAnomalyDetection: boolean;
  upstreamValidationShield: boolean;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
} as const;

const layoutVariants = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: "easeOut" },
  },
} as const;

export default function SecurityView() {
  const [activeTab, setActiveTab] = useState("ip");
  const [config, setConfig] = useState<SecurityConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals for Add IP
  const [showAddAllowModal, setShowAddAllowModal] = useState(false);
  const [newAllowIP, setNewAllowIP] = useState("");
  const [newAllowLabel, setNewAllowLabel] = useState("");

  const [showAddDenyModal, setShowAddDenyModal] = useState(false);
  const [newDenyIP, setNewDenyIP] = useState("");
  const [newDenyReason, setNewDenyReason] = useState("");

  const fetchSecurity = useCallback(async () => {
    try {
      const res = await adminFetch("/api/admin/security");
      if (res.ok) setConfig(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecurity();
  }, []);

  // ─── Realtime SSE: reload saat ada perubahan keamanan ──────
  useSSE(
    ["route:change", "client:change"],
    () => {
      fetchSecurity();
    },
    !showAddAllowModal && !showAddDenyModal,
  );

  // Fallback polling (jarang — keamanan jarang berubah)
  useAutoRefresh(fetchSecurity, !showAddAllowModal && !showAddDenyModal, 60);

  const updateServer = async (updates: Partial<SecurityConfig>) => {
    if (!config) return;
    const newConfig = { ...config, ...updates };
    setConfig(newConfig); // optimistic
    try {
      await adminFetch("/api/admin/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    } catch (e) {
      console.error(e);
      fetchSecurity(); // revert on failure
    }
  };

  const handleAddAllow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !newAllowIP) return;
    const newList = [
      ...config.ipAllowlist,
      { ip: newAllowIP, label: newAllowLabel },
    ];
    updateServer({ ipAllowlist: newList });
    setShowAddAllowModal(false);
    setNewAllowIP("");
    setNewAllowLabel("");
  };

  const handleDeleteAllow = (index: number) => {
    if (!config) return;
    const newList = [...config.ipAllowlist];
    newList.splice(index, 1);
    updateServer({ ipAllowlist: newList });
  };

  const handleAddDeny = (e: React.FormEvent) => {
    e.preventDefault();
    if (!config || !newDenyIP) return;
    const newList = [
      ...config.ipDenylist,
      { ip: newDenyIP, reason: newDenyReason },
    ];
    updateServer({ ipDenylist: newList });
    setShowAddDenyModal(false);
    setNewDenyIP("");
    setNewDenyReason("");
  };

  const handleDeleteDeny = (index: number) => {
    if (!config) return;
    const newList = [...config.ipDenylist];
    newList.splice(index, 1);
    updateServer({ ipDenylist: newList });
  };

  if (loading || !config)
    return (
      <div className="flex items-center justify-center p-10">
        <div className="w-8 h-8 flex space-x-2">
          <div
            className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          ></div>
          <div
            className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          ></div>
          <div
            className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          ></div>
        </div>
      </div>
    );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-7xl mx-auto pb-10"
    >
      <motion.div
        variants={itemVariants}
        className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-rose-100/60 dark:from-rose-900/20 via-orange-50/40 dark:via-orange-900/10 to-yellow-50/40 dark:to-yellow-900/10 rounded-full blur-3xl -mr-16 -mt-16 opacity-80 group-hover:scale-110 transition-transform duration-700"></div>
        <div className="absolute bottom-0 left-0 p-24 bg-gradient-to-tr from-blue-50/40 dark:from-blue-900/20 to-indigo-50/40 dark:to-indigo-900/20 rounded-full blur-3xl -ml-16 -mb-16 opacity-60"></div>

        <div className="relative z-10 flex-1">
          <h2 className="text-2xl font-black bg-gradient-to-r from-slate-800 dark:from-white to-slate-600 dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-4 mb-2 tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-50 dark:from-rose-900/30 to-orange-50 dark:to-orange-900/30 flex items-center justify-center shadow-sm border border-rose-100/50 dark:border-rose-800/50">
              <Shield className="w-5 h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div>Keamanan Lanjutan & Akses Kontrol</div>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm ml-1 font-medium">
            Kelola kebijakan jaringan, allowlist IP, deteksi ancaman, dan
            perisai gateway.
          </p>
        </div>
      </motion.div>

      <motion.div
        variants={layoutVariants}
        className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden flex flex-col md:flex-row min-h-[600px] relative"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 dark:from-slate-800/50 to-white/20 dark:to-slate-900/20 pointer-events-none"></div>

        <div className="w-full md:w-72 bg-slate-50/80 dark:bg-slate-800/80 border-r border-slate-100 dark:border-slate-800 p-6 shrink-0 flex flex-col space-y-2 relative z-10">
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 px-4">
            Modul Keamanan
          </div>

          <button
            onClick={() => setActiveTab("ip")}
            className={`w-full text-left px-4 py-3 rounded-2xl font-bold transition-all flex items-center space-x-3 ${activeTab === "ip" ? "bg-gradient-to-r from-blue-50 dark:from-blue-900/30 to-indigo-50 dark:to-indigo-900/30 text-blue-700 dark:text-blue-400 shadow-sm border border-blue-100/50 dark:border-blue-800/50" : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm border border-transparent"}`}
          >
            <Globe
              className={`w-4 h-4 ${activeTab === "ip" ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}
            />
            <span>Penyaringan IP</span>
          </button>
          <button
            onClick={() => setActiveTab("threats")}
            className={`w-full text-left px-4 py-3 rounded-2xl font-bold transition-all flex items-center space-x-3 ${activeTab === "threats" ? "bg-gradient-to-r from-emerald-50 dark:from-emerald-900/30 to-teal-50 dark:to-teal-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-100/50 dark:border-emerald-800/50" : "text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm border border-transparent"}`}
          >
            <ShieldAlert
              className={`w-4 h-4 ${activeTab === "threats" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}
            />
            <span>Deteksi Ancaman</span>
          </button>
        </div>

        <div className="flex-1 p-8 lg:p-10 relative z-10">
          <AnimatePresence mode="wait">
            {activeTab === "ip" && (
              <motion.div
                key="ip"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10 max-w-4xl"
              >
                {/* ALLOWLIST */}
                <div>
                  <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                        <ShieldCheck className="w-6 h-6 text-emerald-500" />
                        <span>IP Terizinkan (Allowlist)</span>
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-2 max-w-xl">
                        Batasi akses API hanya untuk IP klien yang dikenal.{" "}
                        <span className="text-slate-700 dark:text-slate-300 font-bold">
                          Jika kosong, gateway menerima dari IP mana saja.
                        </span>
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddAllowModal(true)}
                      className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all outline-none"
                    >
                      <Plus className="w-4 h-4" /> <span>Tambah IP</span>
                    </button>
                  </div>

                  <div className="bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80">
                        <tr>
                          <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-[11px]">
                            Alamat IP / CIDR
                          </th>
                          <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-[11px]">
                            Label
                          </th>
                          <th className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest text-[11px] text-right">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300 font-medium pb-2">
                        {config.ipAllowlist.map((item, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                          >
                            <td className="px-6 py-4 font-mono font-bold text-slate-800 dark:text-slate-100">
                              {item.ip}
                            </td>
                            <td className="px-6 py-4">
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2.5 py-1 rounded-md text-xs">
                                {item.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 flex justify-end">
                              <button
                                onClick={() => handleDeleteAllow(idx)}
                                className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 flex items-center justify-center hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-500 dark:hover:text-rose-400 hover:border-transparent transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                                title="Hapus IP"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {config.ipAllowlist.length === 0 && (
                          <tr className="bg-white dark:bg-slate-900/50">
                            <td
                              colSpan={3}
                              className="py-12 text-center text-slate-400 font-medium"
                            >
                              Belum ada IP yang terizinkan secara spesifik.
                              <br />
                              <span className="text-xs mt-1 block">
                                Akses terbuka untuk semua alamat IP.
                              </span>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* DENYLIST */}
                <div className="pt-8 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
                    <div>
                      <h3 className="text-2xl font-black text-rose-700 dark:text-rose-500 tracking-tight flex items-center gap-2">
                        <Database className="w-6 h-6" />
                        <span>IP Diblokir (Denylist)</span>
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-2 max-w-xl">
                        Tolak lalu lintas masuk secara mutlak dari alamat IP
                        yang diketahui nakal atau abusif sebelum mengevaluasi
                        autentikasi.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowAddDenyModal(true)}
                      className="flex items-center space-x-2 bg-white dark:bg-slate-800 border-2 border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 px-5 py-2 rounded-xl font-bold hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:border-rose-200 dark:hover:border-rose-800/50 transition-all outline-none"
                    >
                      <Plus className="w-4 h-4" /> <span>Blokir IP</span>
                    </button>
                  </div>

                  <div className="bg-rose-50/30 dark:bg-rose-900/10 rounded-2xl border border-rose-100/50 dark:border-rose-900/30 shadow-[0_4px_20px_rgb(0,0,0,0.02)] overflow-hidden">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-rose-100/50 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-900/20">
                        <tr>
                          <th className="px-6 py-4 font-bold text-rose-800 dark:text-rose-400 uppercase tracking-widest text-[11px]">
                            Alamat IP
                          </th>
                          <th className="px-6 py-4 font-bold text-rose-800 dark:text-rose-400 uppercase tracking-widest text-[11px]">
                            Alasan Pemblokiran
                          </th>
                          <th className="px-6 py-4 font-bold text-rose-800 dark:text-rose-400 uppercase tracking-widest text-[11px] text-right">
                            Aksi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100/30 dark:divide-rose-900/30 text-rose-900 dark:text-rose-200 font-medium pb-2">
                        {config.ipDenylist.map((item, idx) => (
                          <tr
                            key={idx}
                            className="hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors"
                          >
                            <td className="px-6 py-4 font-mono font-bold text-rose-600 dark:text-rose-400">
                              {item.ip}
                            </td>
                            <td className="px-6 py-4">
                              <span className="bg-rose-100/80 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 px-2.5 py-1 rounded-md text-xs">
                                {item.reason}
                              </span>
                            </td>
                            <td className="px-6 py-4 flex justify-end">
                              <button
                                onClick={() => handleDeleteDeny(idx)}
                                className="bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 text-rose-500 dark:text-rose-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:border-blue-200 dark:hover:border-blue-800 hover:text-blue-600 dark:hover:text-blue-400 transition-all font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm"
                              >
                                Cabut Blokir
                              </button>
                            </td>
                          </tr>
                        ))}
                        {config.ipDenylist.length === 0 && (
                          <tr className="bg-white/50 dark:bg-slate-900/30">
                            <td
                              colSpan={3}
                              className="py-12 text-center text-slate-400 font-medium"
                            >
                              Tidak ada alamat IP yang diblokir saat ini.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "threats" && (
              <motion.div
                key="threats"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8 max-w-3xl"
              >
                <div className="flex items-start space-x-4 text-emerald-800 dark:text-emerald-400 mb-8 border border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/20 p-6 rounded-2xl">
                  <div className="w-10 h-10 rounded-xl bg-white dark:bg-emerald-900/50 flex items-center justify-center shadow-sm shrink-0 border border-emerald-100 dark:border-emerald-800/50">
                    <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">
                      Status Enjin Deteksi
                    </h3>
                    <p className="font-medium text-emerald-700/80 dark:text-emerald-500/80 leading-relaxed text-sm">
                      Mode "Pantau" (Monitor) sedang aktif. Aktivitas
                      mencurigakan akan dicatat untuk analisis namun tidak akan
                      diblokir secara mutlak otomatis demi menghindari
                      false-positive.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-6 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900/50 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all gap-4">
                    <div className="flex-1 pr-6">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
                        <span>Deteksi Anomali Rate Limit</span>
                      </h4>
                      <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed text-sm">
                        Identifikasi otomatis lonjakan respons{" "}
                        <code className="bg-slate-100 dark:bg-slate-800 text-rose-500 dark:text-rose-400 px-1 py-0.5 rounded text-xs font-bold font-mono">
                          429 Too Many Requests
                        </code>{" "}
                        untuk mendeteksi potensi token klien yang disalahgunakan
                        atau serangan enumerasi.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={config.rateLimitAnomalyDetection}
                        onChange={(e) =>
                          updateServer({
                            rateLimitAnomalyDetection: e.target.checked,
                          })
                        }
                      />
                      <div className="w-14 h-7 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                    </label>
                  </div>

                  <div className="group flex flex-col sm:flex-row sm:items-center justify-between p-6 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm bg-white dark:bg-slate-900/50 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all gap-4">
                    <div className="flex-1 pr-6">
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg flex items-center gap-2">
                        <span>Perisai Validasi Upstream</span>
                      </h4>
                      <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed text-sm">
                        Gunakan skema ketat untuk menolak permintaan yang secara
                        struktural cacat sebelum menyentuh atau membebani server
                        backend internal (LLM / WA API).
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={config.upstreamValidationShield}
                        onChange={(e) =>
                          updateServer({
                            upstreamValidationShield: e.target.checked,
                          })
                        }
                      />
                      <div className="w-14 h-7 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                    </label>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAddAllowModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800"
            >
              <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                  Tambah IP Terizinkan
                </h3>
                <button
                  onClick={() => setShowAddAllowModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors outline-none"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddAllow} className="p-8 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Alamat IP / CIDR
                  </label>
                  <input
                    type="text"
                    autoFocus
                    required
                    placeholder="192.168.1.1 atau 10.0.0.0/24"
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none font-mono dark:text-white"
                    value={newAllowIP}
                    onChange={(e) => setNewAllowIP(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Label (Catatan)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Server Internal VPS"
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white"
                    value={newAllowLabel}
                    onChange={(e) => setNewAllowLabel(e.target.value)}
                  />
                </div>
                <div className="pt-6 mt-2 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddAllowModal(false)}
                    className="px-5 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-colors outline-none"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30 font-bold rounded-xl transition-all outline-none"
                  >
                    Tambah IP
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showAddDenyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-md overflow-hidden border border-rose-100 dark:border-rose-900/50"
            >
              <div className="px-8 py-6 border-b border-rose-100 dark:border-rose-900/50 text-rose-800 dark:text-rose-400 flex justify-between items-center bg-rose-50 dark:bg-rose-900/20 border-t-4 border-t-rose-500">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <Database className="w-5 h-5" /> Blokir IP Definitif
                </h3>
                <button
                  onClick={() => setShowAddDenyModal(false)}
                  className="text-rose-400 dark:text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 bg-white dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-900/40 p-2 rounded-full transition-colors outline-none"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddDeny} className="p-8 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Alamat IP Berbahaya
                  </label>
                  <input
                    type="text"
                    autoFocus
                    required
                    placeholder="45.x.x.x"
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none font-mono text-rose-700 dark:text-rose-400 font-bold"
                    value={newDenyIP}
                    onChange={(e) => setNewDenyIP(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Alasan Pemblokiran (Opsional)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Sering melakukan brute force"
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 px-4 py-3 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white"
                    value={newDenyReason}
                    onChange={(e) => setNewDenyReason(e.target.value)}
                  />
                </div>
                <div className="pt-6 mt-2 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowAddDenyModal(false)}
                    className="px-5 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-colors outline-none"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose-500/30 font-bold rounded-xl transition-all outline-none"
                  >
                    Blokir IP Ini
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
