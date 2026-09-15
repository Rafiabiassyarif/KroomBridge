import { adminFetch } from "../lib/api";
import React, { useState, useEffect } from "react";
import { Package } from "../../../backend/src/server/db";
import {
  Zap,
  Activity,
  Edit2,
  Trash2,
  Plus,
  Check,
  RefreshCw,
  Cpu,
  Sparkles,
  Layers,
  Crown,
  CheckCircle2,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import { useSSE } from "../lib/useSSE";

const TIER_ORDER = ["Free", "Starter", "Basic", "Pro", "Business", "Enterprise"];

const TIER_META: Record<
  string,
  {
    tag: string;
    gradient: string;
    iconBg: string;
    borderActive: string;
    profitMargin: string;
    popular?: boolean;
    description: string;
  }
> = {
  Free: {
    tag: "Tingkat Gratis",
    gradient: "from-slate-50 to-gray-100",
    iconBg: "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800",
    borderActive: "border-slate-200 dark:border-slate-800",
    profitMargin: "0%",
    description: "Akses uji coba gratis dengan saldo awal Rp 5.000 untuk semua model AI.",
  },
  Starter: {
    tag: "Tingkat Pemula",
    gradient: "from-sky-50 to-blue-50",
    iconBg: "text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/30",
    borderActive: "border-slate-100 dark:border-slate-800",
    profitMargin: "28.6%",
    description: "Cocok untuk testing & eksplorasi integrasi awal.",
  },
  Basic: {
    tag: "Paling Populer",
    gradient: "from-emerald-50 to-teal-50",
    iconBg: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30",
    borderActive: "border-emerald-300/80 dark:border-emerald-700/60 ring-2 ring-emerald-500/20",
    profitMargin: "23.1%",
    popular: true,
    description: "Pilihan favorit untuk project personal & website kecil.",
  },
  Pro: {
    tag: "Rekomendasi Dev",
    gradient: "from-indigo-50 to-purple-50",
    iconBg: "text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30",
    borderActive: "border-indigo-300/80 dark:border-indigo-700/60 ring-2 ring-indigo-500/20",
    profitMargin: "20.0%",
    popular: true,
    description: "Kapasitas ideal untuk freelancer & software engineer aktif.",
  },
  Business: {
    tag: "Skala Bisnis",
    gradient: "from-amber-50 to-orange-50",
    iconBg: "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30",
    borderActive: "border-slate-100 dark:border-slate-800",
    profitMargin: "16.7%",
    description: "Untuk tim & aplikasi produksi dengan traffic stabil.",
  },
  Enterprise: {
    tag: "Solusi Skala Besar",
    gradient: "from-rose-50 to-purple-50",
    iconBg: "text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30",
    borderActive: "border-slate-100 dark:border-slate-800",
    profitMargin: "16.7%",
    description: "Kapasitas maksimum dengan rate limit tertinggi.",
  },
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
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
} as const;

export default function PackagesView() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Package | null>(null);
  const [packageToDelete, setPackageToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Package>>({
    name: "",
    maxRequestsPerMinute: 60,
    monthlyQuota: 35000,
    quotaType: "credit",
    costPerRequest: 1,
    costPer1KTokens: 20,
    allowOverage: false,
    overageRatePer1K: 0,
    price: 35000,
    allowedEndpoints: ["*"],
    allowedModels: [],
  });

  const fetchData = async () => {
    try {
      const res = await adminFetch("/api/admin/packages");
      if (res.ok) {
        const data = await res.json();
        setPackages(Array.isArray(data) ? data : []);
      }
      
      const provRes = await adminFetch("/api/admin/providers");
      if (provRes.ok) {
        const provData = await provRes.json();
        const providers = provData.data || [];
        const modelsSet = new Set<string>();
        providers.forEach((p: any) => {
          if (p.models) {
            p.models.forEach((m: string) => {
              const parts = m.split("/");
              const shortName = parts[parts.length - 1];
              modelsSet.add(shortName);
            });
          }
        });
        setAvailableModels(Array.from(modelsSet));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Realtime SSE: reload saat paket atau klien berubah ──
  // Klien berubah bisa mempengaruhi clientCount per paket.
  useSSE(
    ["package:change", "client:change"],
    () => {
      fetchData();
    },
    !showAddModal && !showEditModal && !packageToDelete,
  );

  // Fallback polling jangka panjang (60 dtk).
  useAutoRefresh(
    fetchData,
    !showAddModal && !showEditModal && !packageToDelete,
    60,
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEditing = !!showEditModal;
      const url = isEditing
        ? `/api/admin/packages/${showEditModal.id}`
        : "/api/admin/packages";
      const method = isEditing ? "PATCH" : "POST";

      await adminFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setShowAddModal(false);
      setShowEditModal(null);
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      setDeleteError(null);
      const res = await adminFetch(`/api/admin/packages/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json();
        setDeleteError(errorData.error);
        setIsDeleting(false);
        return;
      }
      setPackageToDelete(null);
      fetchData();
    } catch (e) {
      console.error(e);
      setDeleteError("Gagal menghapus paket. Terjadi kesalahan server.");
    } finally {
      setIsDeleting(false);
    }
  };

  const openAddModal = () => {
    setFormData({
      name: "",
      maxRequestsPerMinute: 60,
      monthlyQuota: 25000,
      quotaType: "credit",
      costPerRequest: 1,
      costPer1KTokens: 20,
      allowOverage: false,
      overageRatePer1K: 0,
      price: 35000,
      allowedEndpoints: ["*"],
      allowedModels: ["*"],
    });
    setShowAddModal(true);
  };

  const openEditModal = (pkg: Package) => {
    setFormData({
      ...pkg,
      quotaType: pkg.quotaType || "credit",
      costPerRequest: pkg.costPerRequest || 1,
      costPer1KTokens: pkg.costPer1KTokens || 20,
    });
    setShowEditModal(pkg);
  };

  if (loading)
    return (
      <div className="flex items-center justify-center p-4 sm:p-6 lg:p-10">
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
        className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-24 bg-gradient-to-bl from-blue-100/60 dark:from-blue-900/20 to-indigo-50/40 dark:to-indigo-900/20 rounded-full blur-3xl -mr-10 -mt-10 opacity-80 group-hover:scale-110 transition-transform duration-700"></div>
        <div className="relative z-10 flex-1">
          <h2 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shadow-sm">
              <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            Manajemen Paket
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm ml-1">
            Daftar paket API yang tersedia, menentukan batas kuota dan rate limit.
          </p>
        </div>
        
        <button
          onClick={openAddModal}
          className="relative z-10 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-5 py-2.5 rounded-xl font-bold shadow-sm border border-slate-200 dark:border-slate-700 transition-colors flex items-center gap-2 outline-none"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Paket</span>
        </button>
      </motion.div>





      {/* ─── Detail Cards Grid ─── */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
      >
        {[...packages]
          .sort((a, b) => {
            const indexA = TIER_ORDER.indexOf(a.name);
            const indexB = TIER_ORDER.indexOf(b.name);
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            return (a.price || 0) - (b.price || 0);
          })
          .map((pkg, idx) => {
            const meta = TIER_META[pkg.name];
            const gradientClass = meta?.gradient || "from-blue-50 to-indigo-50";
            const iconBgClass = meta?.iconBg || "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30";
            const borderClass = meta?.borderActive || "border-slate-100 dark:border-slate-800";

            return (
              <motion.div
                variants={itemVariants}
                whileHover={{ y: -5 }}
                key={pkg.id}
                className={`bg-white dark:bg-slate-900/50 border text-sm ${borderClass} rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-4 sm:p-6 lg:p-8 relative overflow-hidden flex flex-col group cursor-default`}
              >
                <div
                  className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${gradientClass} dark:opacity-10 rounded-full blur-3xl -mr-10 -mt-10 opacity-70 group-hover:scale-125 transition-transform duration-700`}
                ></div>

                {meta?.popular && (
                  <div className="absolute top-0 right-0">
                    <div className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-[10px] tracking-wider uppercase px-4 py-1 rounded-bl-2xl shadow-sm flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" />
                      {meta.tag}
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between mb-4 relative z-10">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                        {pkg.name}
                      </h3>
                      {!meta?.popular && meta?.tag && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {meta.tag}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 dark:text-slate-500 font-mono text-xs mt-1.5 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 rounded-md w-max border border-slate-100 dark:border-slate-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>{" "}
                      ID: {pkg.id}
                    </p>
                  </div>
                  <div
                    className={`w-14 h-14 ${iconBgClass} rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Zap className="w-6 h-6" />
                  </div>
                </div>

                {meta?.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 relative z-10">
                    {meta.description}
                  </p>
                )}

                <div className="space-y-4 mt-2 flex-1 relative z-10">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center">
                      <Activity className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-500" />{" "}
                      Harga
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-700 flex items-baseline gap-1">
                      {pkg.price === 0 || !pkg.price ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Gratis</span>
                      ) : (
                        <span>Rp {pkg.price.toLocaleString("id-ID")}</span>
                      )}
                      <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">
                        / bulan
                      </span>
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold flex items-center">
                      <Activity className="w-4 h-4 mr-2 text-slate-400 dark:text-slate-500" />{" "}
                      Rate Limit
                    </span>
                    <span className="font-extrabold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                      {pkg.maxRequestsPerMinute}{" "}
                      <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">
                        req/mnt
                      </span>
                    </span>
                  </div>



                  <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">
                      Overage
                    </span>
                    {pkg.allowOverage ? (
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-lg border border-emerald-100/50 dark:border-emerald-800/50 shadow-sm">
                        ${pkg.overageRatePer1K}{" "}
                        <span className="text-emerald-700/60 dark:text-emerald-400/60 font-medium text-xs">
                          / 1k {pkg.quotaType === "request" ? "req" : "tokens"}
                        </span>
                      </span>
                    ) : (
                      <span className="font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-3 py-1 rounded-lg border border-rose-100/50 dark:border-rose-800/50 shadow-sm text-[11px] uppercase tracking-wider">
                        Putus Otomatis
                      </span>
                    )}
                  </div>

                  <div className="pt-4 mt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <span className="text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-widest block mb-3">
                      Model AI yang Diizinkan
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {pkg.allowedModels && pkg.allowedModels.length > 0 && !pkg.allowedModels.includes("*") ? (
                        pkg.allowedModels.filter(m => availableModels.includes(m)).length > 0 ? (
                          pkg.allowedModels.filter(m => availableModels.includes(m)).map((m, idx) => (
                            <span
                              key={idx}
                              className="flex items-center gap-1.5 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/30 dark:to-blue-900/20 border border-indigo-100/50 dark:border-indigo-700/30 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-sm"
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 opacity-70"></span>
                              {m}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-400 italic">Tidak ada model aktif yang diizinkan</span>
                        )
                      ) : (
                        <div className="w-full bg-gradient-to-r from-emerald-50/50 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/10 border border-emerald-100/50 dark:border-emerald-800/30 rounded-xl p-3 flex items-center gap-3">
                          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 leading-none mb-1">Akses Tanpa Batas</p>
                            <p className="text-[10px] font-bold text-emerald-600/60 dark:text-emerald-400/60 uppercase tracking-wider leading-none">Semua Model (*)</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  <button
                    onClick={() => openEditModal(pkg)}
                    className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg outline-none cursor-pointer"
                    title="Edit Paket"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setPackageToDelete(pkg.id)}
                    className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-2 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg outline-none cursor-pointer"
                    title="Hapus Paket"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            );
          })}
      </motion.div>

      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden my-auto border border-slate-100 dark:border-slate-800 flex flex-col max-h-[90vh]"
            >
              <div className="p-4 sm:p-6 lg:p-8 border-b border-slate-100 dark:border-slate-800/60 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20 shrink-0">
                <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  {showEditModal ? "Edit Paket" : "Tambah Paket"}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(null);
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-4 sm:p-6 lg:p-8 space-y-6 overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-2">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Nama Paket
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 px-4 py-3 bg-slate-50/50 dark:bg-[#0f172a]/40 hover:bg-white dark:hover:bg-[#0f172a]/80 transition-all outline-none dark:text-white font-medium"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Harga Paket (Rp / bulan)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-slate-500">
                        Rp
                      </span>
                      <input
                        type="number"
                        required
                        className="w-full border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 pl-11 pr-4 py-3 bg-slate-50/50 dark:bg-[#0f172a]/40 hover:bg-white dark:hover:bg-[#0f172a]/80 transition-all outline-none font-mono dark:text-white"
                        value={formData.price || 0}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            price: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
                {/* Pilihan Tipe Kuota Paket */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Tipe Kuota Paket
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Option 1: Credit Balance (Command Code style) */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, quotaType: "credit", costPer1KTokens: formData.costPer1KTokens || 20 })}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                        formData.quotaType === "credit" || (!formData.quotaType && formData.quotaType !== "token")
                          ? "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                          : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          Saldo AI (Rp)
                        </span>
                        {(formData.quotaType === "credit" || (!formData.quotaType && formData.quotaType !== "token")) && (
                          <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                        Model Command Code. Saldo rupiah terpotong per token & model rate.
                      </span>
                    </button>

                    {/* Option 2: Token based */}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, quotaType: "token" })}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between cursor-pointer ${
                        formData.quotaType === "token"
                          ? "bg-blue-50/80 dark:bg-blue-900/20 border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
                          : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          Token AI
                        </span>
                        {formData.quotaType === "token" && (
                          <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                            <Check className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                        Kuota total token AI prompt + completion * multiplier.
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Rate Limit <span className="text-slate-400 dark:text-slate-500 font-medium ml-1">(req/mnt)</span>
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 px-4 py-3 bg-slate-50/50 dark:bg-[#0f172a]/40 hover:bg-white dark:hover:bg-[#0f172a]/80 transition-all outline-none font-mono dark:text-white"
                      value={formData.maxRequestsPerMinute}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          maxRequestsPerMinute: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      {formData.quotaType === "credit" || (!formData.quotaType && formData.quotaType !== "token")
                        ? "Saldo AI Diberikan (Rp)"
                        : "Kuota Bulanan (tokens)"}
                    </label>
                    <div className="relative">
                      {(formData.quotaType === "credit" || (!formData.quotaType && formData.quotaType !== "token")) && (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400 dark:text-slate-500">
                          Rp
                        </span>
                      )}
                      <input
                        type="number"
                        required
                        className={`w-full border border-slate-200 dark:border-slate-700/60 rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)] focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 py-3 bg-slate-50/50 dark:bg-[#0f172a]/40 hover:bg-white dark:hover:bg-[#0f172a]/80 transition-all outline-none font-mono dark:text-white ${
                          formData.quotaType === "credit" || (!formData.quotaType && formData.quotaType !== "token")
                            ? "pl-11 pr-4"
                            : "px-4"
                        }`}
                        value={formData.monthlyQuota}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            monthlyQuota: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/80 dark:bg-[#0f172a]/30 p-5 border border-slate-200 dark:border-slate-700/60 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        Izinkan Overage (Terlewat Batas)
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        Klien dapat memanggil API setelah kuota habis dengan biaya tambahan.
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.allowOverage}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            allowOverage: e.target.checked,
                          })
                        }
                      />
                      <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-6 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 shadow-inner"></div>
                    </label>
                  </div>

                  {formData.allowOverage && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                    >
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                        Tarif Overage per 1.000 req ($)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                          $
                        </span>
                        <input
                          type="number"
                          className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 pl-8 pr-4 py-3 border bg-white dark:bg-slate-900 outline-none font-mono dark:text-white"
                          value={formData.overageRatePer1K}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              overageRatePer1K: Number(e.target.value),
                            })
                          }
                        />
                      </div>
                    </motion.div>
                  )}
                </div>



                <div className="mt-2">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Model AI yang Diizinkan
                  </label>
                  
                  {/* Model Selector Container */}
                  <div className="bg-slate-50 dark:bg-[#0f172a]/30 border border-slate-200 dark:border-slate-700/60 rounded-2xl overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]">
                    
                    {/* Header: Unlimited Access Toggle */}
                    <label className="flex items-center justify-between p-4 bg-white dark:bg-[#151e32]/50 border-b border-slate-200 dark:border-slate-700/60 cursor-pointer group hover:bg-slate-50 dark:hover:bg-[#1e293b]/50 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">Akses Tanpa Batas (Semua Model)</span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">Berikan akses penuh ke semua model yang tersedia di gateway.</span>
                      </div>
                      <div className="relative flex items-center justify-center shrink-0 ml-4">
                        <input
                          type="checkbox"
                          className="w-5 h-5 rounded-md border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-blue-500 cursor-pointer accent-blue-600 outline-none"
                          checked={!!formData.allowedModels?.includes("*")}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, allowedModels: ["*"] });
                            } else {
                              setFormData({ ...formData, allowedModels: [] });
                            }
                          }}
                        />
                      </div>
                    </label>
                    
                    {/* Models List Area (no nested scrollbar) */}
                    <div className={`p-2 transition-opacity duration-300 ${formData.allowedModels?.includes("*") ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {availableModels.map((modelName) => {
                          const isChecked = !formData.allowedModels?.includes("*") && !!formData.allowedModels?.includes(modelName);
                          return (
                            <label key={modelName} className={`flex items-center space-x-3 p-2.5 rounded-xl transition-all cursor-pointer border ${isChecked ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700/50'}`}>
                              <div className="relative flex items-center justify-center shrink-0">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus:ring-blue-500 cursor-pointer accent-blue-600 outline-none"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    let newModels = [...(formData.allowedModels || [])].filter(m => m !== "*");
                                    if (e.target.checked) {
                                      newModels.push(modelName);
                                    } else {
                                      newModels = newModels.filter(m => m !== modelName);
                                    }
                                    setFormData({ ...formData, allowedModels: newModels });
                                  }}
                                />
                              </div>
                              <span className={`text-sm font-medium tracking-tight truncate ${isChecked ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}>{modelName}</span>
                            </label>
                          );
                        })}
                      </div>
                      
                      {availableModels.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-4 sm:py-6 lg:py-8 text-slate-400">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                            <RefreshCw className="w-4 h-4 animate-spin text-slate-500" />
                          </div>
                          <p className="text-xs font-semibold">Mengambil daftar model...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="pt-6 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800/60 mt-8">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(null);
                    }}
                    className="px-5 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-colors mt-6 outline-none"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30 font-bold rounded-xl transition-all mt-6 outline-none"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {packageToDelete && (
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
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800 p-4 sm:p-6 lg:p-8"
            >
              <div className="w-14 h-14 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-2xl flex items-center justify-center mb-6">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-black text-xl text-slate-900 dark:text-slate-100 mb-3">
                Hapus Paket
              </h3>
              {deleteError && (
                <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50 rounded-xl text-sm font-bold">
                  {deleteError}
                </div>
              )}
              <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium leading-relaxed">
                Yakin ingin menghapus paket ini? Klien yang terhubung (jika ada
                yang terlewat validasi) akan mengalami error.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setPackageToDelete(null)}
                  className="px-5 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-colors outline-none disabled:opacity-50"
                  autoFocus
                >
                  Batal
                </button>
                <button
                  type="button"
                  id="btn-confirm-delete-pkg"
                  disabled={isDeleting}
                  onClick={() =>
                    packageToDelete && handleDelete(packageToDelete)
                  }
                  className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose-500/30 font-bold rounded-xl transition-all outline-none disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
