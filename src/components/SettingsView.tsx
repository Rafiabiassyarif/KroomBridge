import { adminFetch } from "../lib/api";
import React, { useState, useEffect } from "react";
import {
  Users,
  Shield,
  Plus,
  Edit2,
  Trash2,
  Settings,
  AlertOctagon,
  RotateCcw,
  Database,
  Calendar,
  Clock,
} from "lucide-react";
import { AdminUser } from "../server/db";
import { motion, AnimatePresence } from "motion/react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import { useSSE } from "../lib/useSSE";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function SettingsView() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Admin Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<AdminUser | null>(null);
  const [adminToDelete, setAdminToDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // System Utility State
  const [systemMessage, setSystemMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [resetDay, setResetDay] = useState<string>("1");
  const [resetMonth, setResetMonth] = useState<string>("1");
  const [resetMode, setResetMode] = useState<"monthly" | "purchase" | "annual">("monthly");

  const [formData, setFormData] = useState<Partial<AdminUser>>({
    name: "",
    email: "",
    role: "Admin",
    password: "",
  });

  const fetchData = async () => {
    try {
      const [resAdmins, resMeta] = await Promise.all([
        adminFetch("/api/admin/users"),
        adminFetch("/api/admin/system/meta"),
      ]);
      if (resAdmins.ok) setAdmins(await resAdmins.json());
      if (resMeta.ok) {
        const meta = await resMeta.json();
        setResetDay(String(meta.quotaResetDay || 1));
        setResetMode(meta.quotaResetMode || "monthly");
        setResetMonth(String(meta.quotaResetMonth || 1));
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

  // ─── Realtime SSE: reload saat admin user berubah ──
  useSSE(
    ["admin:change"],
    () => {
      fetchData();
    },
    !showAddModal && !showEditModal && !adminToDelete,
  );

  // Fallback polling 60 dtk (settings jarang berubah dari sumber lain).
  useAutoRefresh(
    fetchData,
    !showAddModal && !showEditModal && !adminToDelete,
    60,
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const isEditing = !!showEditModal;
      const url = isEditing
        ? `/api/admin/users/${showEditModal.id}`
        : "/api/admin/users";
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
      setDeleteError(null);
      const res = await adminFetch(`/api/admin/users/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json();
        setDeleteError(errorData.error);
        return;
      }
      setAdminToDelete(null);
      fetchData();
    } catch (e) {
      console.error(e);
      setDeleteError("Gagal menghapus admin. Terjadi kesalahan server.");
    }
  };

  const openAddModal = () => {
    setFormData({ name: "", email: "", role: "Admin", password: "" });
    setShowAddModal(true);
  };

  const openEditModal = (admin: AdminUser) => {
    setFormData({ ...admin, password: "" });
    setShowEditModal(admin);
  };

  const handleClearLogs = async () => {
    if (
      !confirm(
        "Apakah Anda yakin ingin menghapus SEMUA log aktivitas gateway? Ini tidak dapat dikembalikan.",
      )
    )
      return;
    setIsProcessing(true);
    try {
      const res = await adminFetch("/api/admin/system/logs", {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setSystemMessage({ text: data.message, type: "success" });
      } else {
        setSystemMessage({
          text: data.error || "Gagal menghapus log.",
          type: "error",
        });
      }
    } catch (e) {
      setSystemMessage({ text: "Terjadi kesalahan sistem.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setSystemMessage(null), 5000);
    }
  };

  const handleResetQuotas = async () => {
    if (
      !confirm(
        "Peringatan: Ini akan me-reset kuota (penggunaan bulanan) SEMUA klien ke angka 0 saat ini juga. Yakin?",
      )
    )
      return;
    setIsProcessing(true);
    try {
      const res = await adminFetch("/api/admin/system/reset-quotas", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setSystemMessage({ text: data.message, type: "success" });
      } else {
        setSystemMessage({
          text: data.error || "Gagal mereset kuota.",
          type: "error",
        });
      }
    } catch (e) {
      setSystemMessage({ text: "Terjadi kesalahan sistem.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setSystemMessage(null), 5000);
    }
  };

  const handleSaveResetSchedule = async () => {
    setIsProcessing(true);
    try {
      const payload: any = {
        quotaResetDay: parseInt(resetDay),
        quotaResetMode: resetMode,
      };
      if (resetMode === "annual") {
        payload.quotaResetMonth = parseInt(resetMonth);
      }
      const res = await adminFetch("/api/admin/system/reset-schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setSystemMessage({
          text: "Jadwal auto-reset berhasil disimpan!",
          type: "success",
        });
      } else {
        setSystemMessage({
          text: data.error || "Gagal menyimpan jadwal.",
          type: "error",
        });
      }
    } catch (e) {
      setSystemMessage({ text: "Terjadi kesalahan sistem.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setSystemMessage(null), 5000);
    }
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
      className="space-y-8 max-w-7xl mx-auto pb-10"
    >
      <motion.div
        variants={itemVariants}
        className="flex justify-between items-center bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl p-8 rounded-3xl border border-white/50 dark:border-white/[0.06] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-blue-100/60 dark:from-blue-900/20 via-purple-50/40 dark:via-purple-900/10 to-pink-50/40 dark:to-pink-900/10 rounded-full blur-3xl -mr-16 -mt-16 opacity-80 group-hover:scale-110 transition-transform duration-700"></div>
        <div className="absolute bottom-0 left-0 p-24 bg-gradient-to-tr from-slate-50/40 dark:from-slate-800/40 to-slate-100/40 dark:to-slate-700/40 rounded-full blur-3xl -ml-16 -mb-16 opacity-60"></div>

        <div className="relative z-10 flex-1">
          <h2 className="text-2xl font-black bg-gradient-to-r from-slate-800 dark:from-white to-slate-600 dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-4 mb-2 tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 dark:from-blue-900/30 to-indigo-50 dark:to-indigo-900/30 flex items-center justify-center shadow-sm border border-blue-100/50 dark:border-blue-800/50">
              <Settings className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>Pengaturan Gateway & Sistem</div>
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm ml-1 font-medium">
            Kelola administrator dan utilitas basis data KroomBridge.
          </p>
        </div>
      </motion.div>

      {/* SYSTEM UTILITIES SECTION */}
      <motion.div
        variants={itemVariants}
        className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/50 dark:border-white/[0.06] rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden"
      >
        <div className="p-8 border-b border-white/50 dark:border-white/[0.06] flex justify-between items-center bg-white/60 dark:bg-white/[0.02] relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-2xl font-black text-zinc-800 dark:text-white flex items-center space-x-3 tracking-tight">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.04] shadow-sm border border-white/50 dark:border-white/[0.04] flex items-center justify-center">
                <Database className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              </div>
              <span>Utilitas Basis Data</span>
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm mt-2 ml-11">
              Pembersihan *cache* dan fungsi *maintenance* sistem.
            </p>
          </div>
        </div>

        <div className="p-8">
          {systemMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`mb-6 p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${systemMessage.type === "success" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800"}`}
            >
              {systemMessage.type === "success" ? (
                <Shield className="w-5 h-5" />
              ) : (
                <AlertOctagon className="w-5 h-5" />
              )}
              {systemMessage.text}
            </motion.div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CLEAR LOGS */}
            <div className="border border-white/50 dark:border-white/[0.04] rounded-2xl p-6 bg-white/60 dark:bg-white/[0.02] hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-zinc-800 dark:text-white text-lg mb-2">
                Hapus Semua Log Gateway
              </h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
                Bersihkan tabel riwayat *Request & Error*. Disarankan dilakukan
                sebulan sekali untuk menghemat penyimpanan *database MySQL*.
              </p>
              <button
                onClick={handleClearLogs}
                disabled={isProcessing}
                className="w-full py-3 bg-white dark:bg-[#0d0f14] border border-white/50 dark:border-white/[0.04] hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl transition-all shadow-sm outline-none disabled:opacity-50"
              >
                Bersihkan Log Sekarang
              </button>
            </div>

            {/* RESET QUOTAS */}
            <div className="border border-white/50 dark:border-white/[0.04] rounded-2xl p-6 bg-white/60 dark:bg-white/[0.02] hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center mb-4">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-zinc-800 dark:text-white text-lg mb-2">
                Reset Kuota Secara Paksa
              </h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">
                Setel ulang penggunaan seluruh klien menjadi 0 saat ini juga.
                Biasanya sistem melakukan ini secara otomatis setiap awal bulan.
              </p>
              <button
                onClick={handleResetQuotas}
                disabled={isProcessing}
                className="w-full py-3 bg-white dark:bg-[#0d0f14] border border-white/50 dark:border-white/[0.04] hover:border-amber-500 hover:text-amber-600 dark:hover:text-amber-400 text-zinc-700 dark:text-zinc-300 font-bold rounded-xl transition-all shadow-sm outline-none disabled:opacity-50"
              >
                Reset Semua Kuota
              </button>
            </div>

            {/* AUTO-RESET SCHEDULE */}
            <div className="md:col-span-2 border border-white/50 dark:border-white/[0.04] rounded-2xl p-6 bg-white/60 dark:bg-white/[0.02] hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 rounded-xl flex items-center justify-center shrink-0">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-800 dark:text-white text-lg mb-1">
                    Jadwal Auto-Reset Kuota Bulanan
                  </h4>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Sistem akan mereset kuota semua klien secara otomatis sesuai
                    jadwal. Pilih mode dan tanggal reset-nya.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                    Mode Reset
                  </label>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-white/50 dark:border-white/[0.04] hover:border-purple-400 dark:hover:border-purple-600 transition-colors">
                      <input
                        type="radio"
                        name="resetMode"
                        value="monthly"
                        checked={resetMode === "monthly"}
                        onChange={() => setResetMode("monthly")}
                        className="accent-purple-600"
                      />
                      <div>
                        <div className="font-bold text-sm text-zinc-800 dark:text-white">
                          Awal Bulan
                        </div>
                        <div className="text-xs text-slate-500">
                          Reset pada tanggal tertentu setiap bulan
                        </div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-white/50 dark:border-white/[0.04] hover:border-purple-400 dark:hover:border-purple-600 transition-colors">
                      <input
                        type="radio"
                        name="resetMode"
                        value="annual"
                        checked={resetMode === "annual"}
                        onChange={() => setResetMode("annual")}
                        className="accent-purple-600"
                      />
                      <div>
                        <div className="font-bold text-sm text-zinc-800 dark:text-white">
                          Tahunan (Tanggal & Bulan)
                        </div>
                        <div className="text-xs text-slate-500">
                          Reset setahun sekali pada tanggal & bulan spesifik
                        </div>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-white/50 dark:border-white/[0.04] hover:border-purple-400 dark:hover:border-purple-600 transition-colors">
                      <input
                        type="radio"
                        name="resetMode"
                        value="purchase"
                        checked={resetMode === "purchase"}
                        onChange={() => setResetMode("purchase")}
                        className="accent-purple-600"
                      />
                      <div>
                        <div className="font-bold text-sm text-zinc-800 dark:text-white">
                          Tanggal Pembelian
                        </div>
                        <div className="text-xs text-slate-500">
                          Setiap klien reset pada tanggal{" "}
                          <code className="bg-zinc-100 dark:bg-white/[0.04] px-1 rounded">
                            createdAt
                          </code>
                          -nya
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {resetMode === "monthly" && (
                  <div>
                    <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                      Tanggal Reset (1-31)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={resetDay}
                      onChange={(e) => setResetDay(e.target.value)}
                      className="w-full border border-white/50 dark:border-white/[0.04] rounded-xl px-4 py-3 bg-white dark:bg-[#0d0f14] outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 font-bold text-zinc-800 dark:text-white text-2xl text-center"
                    />
                    <p className="text-xs text-slate-400 mt-2 text-center">
                      Tanggal <strong>{resetDay}</strong> setiap bulannya
                    </p>
                  </div>
                )}

                {resetMode === "annual" && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                        Pilih Bulan
                      </label>
                      <select
                        value={resetMonth}
                        onChange={(e) => setResetMonth(e.target.value)}
                        className="w-full border border-white/50 dark:border-white/[0.04] rounded-xl px-4 py-2 bg-white dark:bg-[#0d0f14] outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 font-bold text-zinc-800 dark:text-white text-sm"
                      >
                        <option value="1">Januari</option>
                        <option value="2">Februari</option>
                        <option value="3">Maret</option>
                        <option value="4">April</option>
                        <option value="5">Mei</option>
                        <option value="6">Juni</option>
                        <option value="7">Juli</option>
                        <option value="8">Agustus</option>
                        <option value="9">September</option>
                        <option value="10">Oktober</option>
                        <option value="11">November</option>
                        <option value="12">Desember</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                        Tanggal Reset (1-31)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={resetDay}
                        onChange={(e) => setResetDay(e.target.value)}
                        className="w-full border border-white/50 dark:border-white/[0.04] rounded-xl px-4 py-3 bg-white dark:bg-[#0d0f14] outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 font-bold text-zinc-800 dark:text-white text-2xl text-center"
                      />
                      <p className="text-xs text-slate-400 mt-2 text-center">
                        Reset otomatis tiap <strong>Tanggal {resetDay} Bulan {resetMonth}</strong> setiap tahunnya
                      </p>
                    </div>
                  </div>
                )}

                {resetMode === "purchase" && (
                  <div className="flex items-center justify-center p-4">
                    <div className="text-center">
                      <Clock className="w-10 h-10 text-purple-400 mx-auto mb-2" />
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        Setiap klien akan direset secara individual berdasarkan
                        hari pembelian masing-masing.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveResetSchedule}
                disabled={isProcessing}
                className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-purple-500/30 outline-none disabled:opacity-50"
              >
                Simpan Jadwal Auto-Reset
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ADMIN USERS SECTION */}
      <motion.div
        variants={itemVariants}
        className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/50 dark:border-white/[0.06] rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden"
      >
        <div className="p-8 border-b border-white/50 dark:border-white/[0.06] flex justify-between items-center bg-white/60 dark:bg-white/[0.02] relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-2xl font-black text-zinc-800 dark:text-white flex items-center space-x-3 tracking-tight">
              <div className="w-8 h-8 rounded-lg bg-white dark:bg-white/[0.04] shadow-sm border border-white/50 dark:border-white/[0.04] flex items-center justify-center">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span>Akses & Administrator</span>
            </h3>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm mt-2 ml-11">
              Staf yang dapat mengakses dashboard KroomBridge.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="relative z-10 flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:-translate-y-0.5 transition-all outline-none"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Admin</span>
          </button>
        </div>
        <div className="p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/40 dark:bg-white/[0.04] border-b border-white/50 dark:border-white/[0.06] text-zinc-600 dark:text-zinc-400">
              <tr>
                <th className="px-8 py-4 font-bold uppercase tracking-widest text-[11px]">
                  Nama / Kredensial
                </th>
                <th className="px-8 py-4 font-bold uppercase tracking-widest text-[11px] text-right">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50 dark:divide-white/[0.04] text-slate-700 font-medium">
              {admins.map((admin, idx) => (
                <motion.tr
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  key={admin.id}
                  className="hover:bg-white/40 dark:hover:bg-white/[0.04] transition-colors group"
                >
                  <td className="px-8 py-5">
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-base">
                      {admin.name}
                    </div>
                    <div className="text-zinc-500 dark:text-zinc-400 text-sm mt-0.5">
                      {admin.email}
                    </div>
                  </td>
                  <td className="px-8 py-5 flex justify-end space-x-2 mt-2">
                    <button
                      onClick={() => openEditModal(admin)}
                      className="w-9 h-9 rounded-xl bg-white dark:bg-white/[0.04] border border-white/50 dark:border-white/[0.04] text-slate-400 flex items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                      title="Edit Admin"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setAdminToDelete(admin.id)}
                      className="w-9 h-9 rounded-xl bg-white dark:bg-white/[0.04] border border-white/50 dark:border-white/[0.04] text-slate-400 flex items-center justify-center hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                      title="Hapus Admin"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </motion.tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="text-center py-12 text-slate-500 font-medium bg-white/20 dark:bg-white/[0.02] border-t border-white/50 dark:border-white/[0.06]/30"
                  >
                    Belum ada admin terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#0d0f14] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-md overflow-hidden border border-white/50 dark:border-white/[0.06]"
            >
              <div className="px-8 py-6 border-b border-white/50 dark:border-white/[0.06] flex justify-between items-center bg-white/60 dark:bg-white/[0.02]">
                <h3 className="font-bold text-lg text-zinc-800 dark:text-white">
                  {showEditModal ? "Edit Admin" : "Tambah Admin Baru"}
                </h3>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(null);
                  }}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-white dark:bg-white/[0.04] hover:bg-white/60 dark:hover:bg-white/[0.06] p-2 rounded-full transition-colors outline-none"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSave} className="p-8 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                    Nama
                  </label>
                  <input
                    type="text"
                    autoFocus
                    required
                    placeholder="Admin Nama"
                    className="w-full border border-white/50 dark:border-white/[0.04] rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 bg-white/60 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none font-medium dark:text-white"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                    Email Login
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin@kroombridge.io"
                    className="w-full border border-white/50 dark:border-white/[0.04] rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 bg-white/60 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none font-medium text-slate-600 dark:text-slate-300"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                    Kata Sandi{" "}
                    {showEditModal && (
                      <span className="text-slate-400 font-normal ml-1">
                        (Biarkan kosong bila tidak ingin diubah)
                      </span>
                    )}
                  </label>
                  <input
                    type="password"
                    required={!showEditModal}
                    placeholder="••••••••"
                    className="w-full border border-white/50 dark:border-white/[0.04] rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 bg-white/60 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none font-medium text-slate-600 dark:text-slate-300"
                    value={formData.password || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                  />
                </div>

                <div className="pt-6 mt-2 flex justify-end space-x-3 border-t border-white/50 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(null);
                    }}
                    className="px-5 py-2.5 text-zinc-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-colors outline-none"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30 font-bold rounded-xl transition-all outline-none"
                  >
                    Simpan Akses
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {adminToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#0d0f14] rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-sm overflow-hidden text-center relative border border-white/50 dark:border-white/[0.06]"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-pink-500"></div>
              <div className="p-10">
                <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/30 rounded-2xl mx-auto flex items-center justify-center mb-6">
                  <Trash2 className="w-8 h-8 text-rose-500 dark:text-rose-400" />
                </div>
                <h3 className="font-black text-2xl text-zinc-800 dark:text-white mb-2 tracking-tight">
                  Hapus Admin?
                </h3>
                {deleteError && (
                  <div className="mb-4 mt-2 p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50 rounded-xl text-sm font-bold">
                    {deleteError}
                  </div>
                )}
                <p className="text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed mb-8 mt-2">
                  Apakah Anda yakin ingin menghapus akses administrator ini?
                  Tindakan ini tidak dapat dibatalkan.
                </p>

                <div className="flex flex-col space-y-3">
                  <button
                    onClick={() => adminToDelete && handleDelete(adminToDelete)}
                    className="w-full px-5 py-3.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-rose-500/30 transition-shadow outline-none"
                  >
                    Ya, Hapus Permanen
                  </button>
                  <button
                    onClick={() => setAdminToDelete(null)}
                    className="w-full px-5 py-3 text-zinc-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-slate-300 bg-zinc-100 dark:bg-white/[0.04] hover:bg-white/80 dark:hover:bg-white/[0.08] font-bold rounded-xl transition-colors outline-none"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
