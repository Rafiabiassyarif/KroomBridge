import { adminFetch } from "../lib/api";
import React, { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Key,
  RefreshCw,
  RotateCcw,
  StopCircle,
  PlayCircle,
  Plus,
  Copy,
  Check,
  Edit2,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { Client, Package } from "../../../backend/src/server/db";
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
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
} as const;

export default function ClientsView() {
  const [clients, setClients] = useState<Client[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPackage, setNewClientPackage] = useState("");
  const [newClientSecretKey, setNewClientSecretKey] = useState("");
  const [newClientCustomQuota, setNewClientCustomQuota] = useState<string>("");

  const [showEditModal, setShowEditModal] = useState<Client | null>(null);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [clientToRotate, setClientToRotate] = useState<string | null>(null);
  const [clientToResetUsage, setClientToResetUsage] = useState<string | null>(
    null,
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [resClients, resPackages] = await Promise.all([
        adminFetch("/api/admin/clients").then((r) => r.json()),
        adminFetch("/api/admin/packages").then((r) => r.json()),
      ]);
      setClients(Array.isArray(resClients) ? resClients : []);
      setPackages(Array.isArray(resPackages) ? resPackages : []);

      if (
        Array.isArray(resPackages) &&
        resPackages.length > 0 &&
        !newClientPackage
      ) {
        setNewClientPackage(resPackages[0].id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [newClientPackage]);

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Realtime SSE: reload saat ada perubahan klien ──────────
  useSSE(
    ["client:change", "stats:tick"],
    (type) => {
      if (type === "client:change") {
        // Reload data klien seketika saat ada create/update/delete
        fetchData();
      }
    },
    !showAddModal && !showEditModal && !clientToDelete && !clientToRotate && !clientToResetUsage,
  );

  // Fallback polling tetap ada, tapi jangka lebih lama karena SSE aktif
  useAutoRefresh(
    fetchData,
    !showAddModal &&
      !showEditModal &&
      !clientToDelete &&
      !clientToRotate &&
      !clientToResetUsage,
    30, // 30 detik sebagai fallback saja
  );

  const handleSyncUsers = async () => {
    setIsSyncing(true);
    try {
      const res = await adminFetch("/api/admin/sync-users", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Sync berhasil! Ditambahkan: ${data.addedCount}, Diperbarui: ${data.updatedCount}`);
        fetchData();
      } else {
        alert(data.error || "Gagal sinkronisasi");
      }
    } catch (e: any) {
      console.error(e);
      alert("Terjadi kesalahan: " + (e.message || String(e)));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName || !newClientPackage) return;
    try {
      const res = await adminFetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newClientName,
          packageId: newClientPackage,
          ...(newClientSecretKey ? { secretKey: newClientSecretKey } : {}),
          ...(newClientCustomQuota
            ? { customQuota: newClientCustomQuota }
            : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Gagal menambah klien");
        return;
      }
      setNewClientName("");
      setNewClientSecretKey("");
      setNewClientCustomQuota("");
      setShowAddModal(false);
      fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Terjadi kesalahan: " + (e.message || String(e)));
    }
  };

  const handleEditClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditModal) return;
    try {
      const res = await adminFetch(`/api/admin/clients/${showEditModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: showEditModal.name,
          packageId: showEditModal.packageId,
          ...(showEditModal.customQuota !== undefined
            ? { customQuota: showEditModal.customQuota }
            : {}),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Gagal memperbarui klien");
        return;
      }
      setShowEditModal(null);
      fetchData();
    } catch (e: any) {
      console.error(e);
      alert("Terjadi kesalahan: " + (e.message || String(e)));
    }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      setIsDeleting(true);
      setDeleteError(null);
      const res = await adminFetch(`/api/admin/clients/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorData = await res.json();
        setDeleteError(errorData.error || "Gagal menghapus klien");
        setIsDeleting(false);
        return;
      }
      setClientToDelete(null);
      fetchData();
    } catch (e) {
      console.error(e);
      setDeleteError("Gagal menghapus klien. Terjadi kesalahan server.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleStatus = async (id: string) => {
    await adminFetch(`/api/admin/clients/${id}/toggle`, { method: "PATCH" });
    fetchData();
  };

  const handleRotateKey = async (id: string) => {
    await adminFetch(`/api/admin/clients/${id}/rotate`, { method: "POST" });
    setClientToRotate(null);
    fetchData();
  };

  const handleResetUsage = async (id: string) => {
    await adminFetch(`/api/admin/clients/${id}/reset-usage`, {
      method: "POST",
    });
    setClientToResetUsage(null);
    fetchData();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
              <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            Manajemen Pengguna
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm ml-1">
            Kelola aplikasi klien dan API key yang mengakses KroomBridge.
          </p>
        </div>
        <div className="flex gap-3 relative z-10">
          <button
            onClick={handleSyncUsers}
            disabled={isSyncing}
            className="flex items-center space-x-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 outline-none"
          >
            <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
            <span>Sync Users</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all outline-none"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Klien</span>
          </button>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden text-sm relative"
      >
        <div className="overflow-x-auto p-0">
          <table className="w-full text-left min-w-max">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/50 text-slate-400 text-[11px] uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Nama Klien</th>
                <th className="px-8 py-5">Paket</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5">Penggunaan</th>
                <th className="px-8 py-5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {clients.map((client) => {
                const pkg = packages.find((p) => p.id === client.packageId);
                const activeQuota =
                  client.customQuota !== undefined &&
                  client.customQuota !== null
                    ? client.customQuota
                    : pkg?.monthlyQuota || 1;
                return (
                  <React.Fragment key={client.id}>
                    <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {client.name}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs font-mono mt-1.5 flex items-center space-x-2">
                          <span className="bg-slate-100/80 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                            ID: {client.id}
                          </span>
                          <button
                            onClick={() =>
                              copyToClipboard(client.id, client.id)
                            }
                            className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 p-1 rounded-md shadow-sm"
                            title="Salin ID"
                          >
                            {copiedId === client.id ? (
                              <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-800/50 shadow-sm">
                          {pkg?.name || client.packageId}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span
                          className={cn(
                            "inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide shadow-sm",
                            client.isActive
                              ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-800/50"
                              : "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100/50 dark:border-rose-800/50",
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full shadow-sm",
                              client.isActive
                                ? "bg-emerald-500 shadow-emerald-500/50"
                                : "bg-rose-500 shadow-rose-500/50",
                            )}
                          ></span>
                          <span>
                            {client.isActive ? "Aktif" : "Ditangguhkan"}
                          </span>
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="text-slate-800 dark:text-slate-100 font-bold">
                          {client.usageThisMonth.toLocaleString()}{" "}
                          <span className="text-slate-400 font-medium">
                            / {activeQuota.toLocaleString()}{" "}
                            token
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${client.usageThisMonth / activeQuota > 0.8 ? "bg-rose-500" : "bg-gradient-to-r from-blue-500 to-indigo-500"}`}
                            style={{
                              width: `${Math.min(100, (client.usageThisMonth / activeQuota) * 100)}%`,
                            }}
                          ></div>
                        </div>
                      </td>
                      <td className="px-8 py-5 flex items-center justify-end space-x-2 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() =>
                            setExpandedClientId(
                              expandedClientId === client.id ? null : client.id,
                            )
                          }
                          className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors px-3 py-1.5 flex items-center gap-1 rounded-lg font-bold text-xs"
                        >
                          <Key className="w-3.5 h-3.5" />
                          {expandedClientId === client.id ? "Tutup" : "Lihat"}
                        </button>
                        <button
                          onClick={() => setShowEditModal(client)}
                          className="text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1.5 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg"
                          title="Edit Klien"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setClientToRotate(client.id)}
                          className="text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors p-1.5 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-lg"
                          title="Rotasi Secret Code"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setClientToResetUsage(client.id)}
                          className="text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg"
                          title="Reset Kuota Klien Ini"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleStatus(client.id)}
                          className={cn(
                            "transition-colors p-1.5 rounded-lg",
                            client.isActive
                              ? "text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                              : "text-emerald-500 dark:text-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10",
                          )}
                          title={client.isActive ? "Tangguhkan" : "Aktifkan"}
                        >
                          {client.isActive ? (
                            <StopCircle className="w-4 h-4" />
                          ) : (
                            <PlayCircle className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                          )}
                        </button>
                        <button
                          onClick={() => setClientToDelete(client.id)}
                          className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors p-1.5 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg ml-2"
                          title="Hapus Klien"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    <AnimatePresence>
                      {expandedClientId === client.id && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 overflow-hidden"
                        >
                          <td colSpan={5} className="px-8 py-6">
                            <div className="bg-slate-900 rounded-2xl p-6 text-slate-300 font-mono text-xs flex flex-col space-y-5 shadow-lg shadow-slate-900/10 border border-slate-800/80 relative overflow-hidden">
                              <div className="absolute top-0 right-0 p-16 bg-blue-500 rounded-full blur-[80px] opacity-10 pointer-events-none"></div>

                              <div>
                                <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-2 block flex items-center gap-2">
                                  <Key className="w-3 h-3 text-slate-400" /> ID
                                  Klien
                                </span>
                                <div className="flex items-center justify-between bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 shadow-inner">
                                  <code className="text-blue-400 font-bold tracking-wide">
                                    {client.id}
                                  </code>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(client.id, client.id)
                                    }
                                    className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-1.5 rounded-md"
                                  >
                                    {copiedId === client.id ? (
                                      <Check className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>
                              <div>
                                <span className="text-slate-500 font-bold uppercase tracking-widest text-[10px] mb-2 block flex items-center gap-2">
                                  <Shield className="w-3 h-3 text-slate-400" />{" "}
                                  API Key
                                </span>
                                <div className="flex items-center justify-between bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 shadow-inner">
                                  <code className="text-emerald-400 font-bold tracking-wide">
                                    {client.secretKey}
                                  </code>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(
                                        client.secretKey,
                                        client.secretKey,
                                      )
                                    }
                                    className="text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 p-1.5 rounded-md"
                                  >
                                    {copiedId === client.secretKey ? (
                                      <Check className="w-4 h-4 text-emerald-400" />
                                    ) : (
                                      <Copy className="w-4 h-4" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="pt-4 border-t border-slate-800/60">
                                <span className="text-slate-400 font-bold text-xs block mb-3">
                                  Contoh API call (Dapatkan Access Token)
                                </span>
                                <pre className="bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 text-blue-200 overflow-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                                  <span className="text-rose-400">curl</span>{" "}
                                  <span className="text-indigo-300">
                                    -X POST
                                  </span>{" "}
                                  <span className="text-emerald-300">
                                    /api/auth/token
                                  </span>{" "}
                                  \<span className="text-indigo-300">-H</span>{" "}
                                  <span className="text-amber-300">
                                    "Content-Type: application/json"
                                  </span>{" "}
                                  \<span className="text-indigo-300">-d</span>{" "}
                                  <span className="text-amber-300">
                                    '{'{"clientId":"'}
                                    <span className="text-blue-300">
                                      {client.id}
                                    </span>
                                    {'","clientSecret":"'}
                                    <span className="text-blue-300">
                                      {client.secretKey}
                                    </span>
                                    {'"}'}'
                                  </span>
                                </pre>
                              </div>
                            </div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
              {clients.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-8 py-16 text-center text-slate-400 font-medium"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                        <Shield className="w-8 h-8 text-slate-400" />
                      </div>
                      Belum ada klien yang terdaftar.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <AnimatePresence>
        {showAddModal && (
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
                  Tambah Klien Baru
                </h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors outline-none"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleAddClient} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Nama Klien
                  </label>
                  <input
                    type="text"
                    autoFocus
                    required
                    className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white"
                    placeholder="cth. Aplikasi Web XYZ"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Paket Berlangganan
                  </label>
                  <select
                    required
                    className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 border bg-white dark:bg-slate-800 cursor-pointer outline-none dark:text-white"
                    value={newClientPackage}
                    onChange={(e) => setNewClientPackage(e.target.value)}
                  >
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.maxRequestsPerMinute} req/mnt)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Token / API Key (Opsional)
                  </label>
                  <input
                    type="text"
                    className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white"
                    placeholder="Biarkan kosong untuk random otomatis"
                    value={newClientSecretKey}
                    onChange={(e) => setNewClientSecretKey(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Batas Kuota Bulanan Kustom
                  </label>
                  <input
                    type="number"
                    className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white"
                    placeholder="Kosongkan untuk mengikuti paket"
                    value={newClientCustomQuota}
                    onChange={(e) => setNewClientCustomQuota(e.target.value)}
                  />
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-5 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-colors outline-none"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30 font-bold rounded-xl transition-all outline-none"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {showEditModal && (
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
                  Edit Klien
                </h3>
                <button
                  type="button"
                  onClick={() => setShowEditModal(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors outline-none"
                >
                  <Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleEditClient} className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Nama Klien
                  </label>
                  <input
                    type="text"
                    autoFocus
                    required
                    className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white"
                    value={showEditModal.name}
                    onChange={(e) =>
                      setShowEditModal({
                        ...showEditModal,
                        name: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Paket Berlangganan
                  </label>
                  <select
                    required
                    className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 border bg-white dark:bg-slate-800 cursor-pointer outline-none dark:text-white"
                    value={showEditModal.packageId}
                    onChange={(e) =>
                      setShowEditModal({
                        ...showEditModal,
                        packageId: e.target.value,
                      })
                    }
                  >
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.maxRequestsPerMinute} req/mnt)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Batas Kuota Bulanan Kustom
                  </label>
                  <input
                    type="number"
                    className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white"
                    placeholder="Kosongkan untuk mengikuti paket"
                    value={showEditModal.customQuota ?? ""}
                    onChange={(e) =>
                      setShowEditModal({
                        ...showEditModal,
                        customQuota: e.target.value
                          ? parseInt(e.target.value)
                          : undefined,
                      })
                    }
                  />
                </div>
                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(null)}
                    className="px-5 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-colors outline-none"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/30 font-bold rounded-xl transition-all outline-none"
                  >
                    Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {clientToDelete && (
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
                Hapus Klien
              </h3>
              {deleteError && (
                <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/50 rounded-xl text-sm font-bold">
                  {deleteError}
                </div>
              )}
              <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium leading-relaxed">
                Apakah Anda yakin ingin menghapus klien ini? Semua akses API
                klien akan dibatalkan, ini tidak dapat dikembalikan.
              </p>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setClientToDelete(null)}
                  className="px-5 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-colors outline-none disabled:opacity-50"
                  autoFocus
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() =>
                    clientToDelete && handleDeleteClient(clientToDelete)
                  }
                  className="px-5 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-rose-500/30 font-bold rounded-xl transition-all outline-none disabled:opacity-50"
                >
                  {isDeleting ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {clientToRotate && (
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
              <div className="w-14 h-14 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mb-6">
                <RefreshCw className="w-6 h-6" />
              </div>
              <h3 className="font-black text-xl text-slate-900 dark:text-slate-100 mb-3">
                Rotasi API Key
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium leading-relaxed">
                Yakin ingin merotasi API key? Ini akan membatalkan token API
                yang sedang aktif dari klien bersangkutan secara instan.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setClientToRotate(null)}
                  className="px-5 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-colors outline-none"
                  autoFocus
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleRotateKey(clientToRotate)}
                  className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/30 font-bold rounded-xl transition-all outline-none"
                >
                  Ya, Rotasi
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {clientToResetUsage && (
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
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h3 className="font-black text-xl text-slate-900 dark:text-slate-100 mb-3">
                Reset Kuota Klien
              </h3>
              <p className="text-slate-500 dark:text-slate-400 mb-8 font-medium leading-relaxed">
                Yakin ingin me-reset penggunaan bulan ini milik klien ini ke{" "}
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  0
                </span>
                ? Tindakan ini hanya mereset hitungan kuota, tidak menghapus log
                atau mengubah konfigurasi lainnya.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setClientToResetUsage(null)}
                  className="px-5 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-colors outline-none"
                  autoFocus
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleResetUsage(clientToResetUsage)}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30 font-bold rounded-xl transition-all outline-none"
                >
                  Ya, Reset Kuota
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
