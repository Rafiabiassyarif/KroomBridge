import { adminFetch } from "../lib/api";
import React, { useState, useEffect } from "react";
import { Package } from "../../../backend/src/server/db";
import { Zap, Activity, Edit2, Trash2, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import { useSSE } from "../lib/useSSE";

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
    monthlyQuota: 10000,
    quotaType: "token",
    allowOverage: false,
    overageRatePer1K: 0,
    allowedEndpoints: ["*"],
  });

  const fetchData = async () => {
    try {
      const res = await adminFetch("/api/admin/packages");
      if (res.ok) {
        const data = await res.json();
        setPackages(Array.isArray(data) ? data : []);
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
      monthlyQuota: 10000,
      quotaType: "token",
      allowOverage: false,
      overageRatePer1K: 0,
      allowedEndpoints: ["*"],
    });
    setShowAddModal(true);
  };

  const openEditModal = (pkg: Package) => {
    setFormData({ ...pkg });
    setShowEditModal(pkg);
  };

  if (loading)
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
            Daftar paket API yang tersedia, menentukan batas kuota dan rate
            limit.
          </p>
        </div>
        <button
          onClick={openAddModal}
          className="relative z-10 flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Paket</span>
        </button>
      </motion.div>

      <motion.div
        variants={containerVariants}
        className="grid md:grid-cols-3 gap-6"
      >
        {packages.map((pkg, idx) => {
          // Calculate gradient based on index to differentiate packages
          const gradients = [
            "from-blue-50 to-indigo-50",
            "from-emerald-50 to-teal-50",
            "from-purple-50 to-pink-50",
            "from-amber-50 to-orange-50",
          ];
          const iconColors = [
            "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30",
            "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30",
            "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30",
            "text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30",
          ];
          const buttonHoverTextColors = [
            "hover:text-blue-600 dark:hover:text-blue-400",
            "hover:text-emerald-600 dark:hover:text-emerald-400",
            "hover:text-purple-600 dark:hover:text-purple-400",
            "hover:text-amber-600 dark:hover:text-amber-400",
          ];
          const accentColor = idx % gradients.length;

          return (
            <motion.div
              variants={itemVariants}
              whileHover={{ y: -5 }}
              key={pkg.id}
              className="bg-white dark:bg-slate-900/50 border text-sm border-slate-100 dark:border-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-8 relative overflow-hidden flex flex-col group cursor-default"
            >
              <div
                className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl ${gradients[accentColor]} dark:opacity-10 rounded-full blur-3xl -mr-10 -mt-10 opacity-70 group-hover:scale-125 transition-transform duration-700`}
              ></div>

              <div className="flex items-start justify-between mb-6 relative z-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                    {pkg.name}
                  </h3>
                  <p className="text-slate-400 dark:text-slate-500 font-mono text-xs mt-1.5 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 rounded-md w-max border border-slate-100 dark:border-slate-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>{" "}
                    ID: {pkg.id}
                  </p>
                </div>
                <div
                  className={`w-14 h-14 ${iconColors[accentColor]} rounded-2xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300`}
                >
                  <Zap className="w-6 h-6" />
                </div>
              </div>

              <div className="space-y-4 mt-2 flex-1 relative z-10">
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
                    Kuota Bulanan
                  </span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-100 dark:border-slate-700">
                    {pkg.monthlyQuota.toLocaleString()}{" "}
                    <span className="text-slate-500 dark:text-slate-400 font-medium text-xs">
                      tokens
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
                        / 1k tokens
                      </span>
                    </span>
                  ) : (
                    <span className="font-extrabold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-3 py-1 rounded-lg border border-rose-100/50 dark:border-rose-800/50 shadow-sm text-[11px] uppercase tracking-wider">
                      Putus Otomatis
                    </span>
                  )}
                </div>
                <div className="pt-2">
                  <span className="text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider block mb-3">
                    Akses API Terbuka
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {pkg.allowedEndpoints?.map((ep, idx) => (
                      <span
                        key={idx}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-md text-xs font-mono font-bold shadow-sm"
                      >
                        {ep}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 mt-8 py-3 px-4 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl relative z-10">
                <button
                  onClick={() => openEditModal(pkg)}
                  className={`text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 p-2 rounded-xl flex items-center space-x-1 font-bold transition-all ${buttonHoverTextColors[accentColor]}`}
                  title="Edit Paket"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPackageToDelete(pkg.id)}
                  className="text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-transparent hover:bg-red-50 dark:hover:bg-red-950/20 p-2 rounded-xl hover:text-red-600 dark:hover:text-red-400 flex items-center space-x-1 font-bold transition-all text-red-600/0"
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
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-lg overflow-hidden my-8 border border-slate-100 dark:border-slate-800"
            >
              <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                  {showEditModal ? "Edit Paket" : "Tambah Paket Baru"}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors outline-none"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Nama Paket
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                      Rate Limit (req/mnt)
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none font-mono dark:text-white"
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
                      Kuota Bulanan
                    </label>
                    <input
                      type="number"
                      required
                      className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none font-mono dark:text-white"
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

                <div className="bg-slate-50/80 dark:bg-slate-800/50 p-5 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                        Izinkan Overage (Terlewat Batas)
                      </label>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        Klien dapat memanggil API setelah kuota habis dengan
                        biaya tambahan.
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
                      <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
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

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Endpoint API yang Diizinkan
                  </label>
                  <input
                    type="text"
                    className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 border font-mono text-sm mb-2 bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white"
                    value={formData.allowedEndpoints?.join(", ")}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        allowedEndpoints: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="/ai/chat, /wa/send, atau * untuk semua"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    Gunakan koma sebagai pemisah. Gunakan{" "}
                    <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-bold text-rose-500 dark:text-rose-400">
                      *
                    </code>{" "}
                    untuk akses tak terbatas.
                  </p>
                </div>

                <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800 mt-6">
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
              className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-md overflow-hidden border border-slate-100 dark:border-slate-800 p-8"
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
