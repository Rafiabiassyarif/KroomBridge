import { adminFetch } from "../lib/api";
import React, { useState, useEffect } from "react";
import {
  Cpu,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Bot,
  ImageIcon,
  Database,
  Link2,
  Terminal,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import { useSSE } from "../lib/useSSE";

type Route = {
  id: string;
  path: string;
  upstreamUrl: string;
  description: string;
  isActive: boolean;
};

function getModelIcon(path: string, desc: string) {
  const s = (path + (desc || "")).toLowerCase();
  if (s.includes("chat") || s.includes("text-to-text") || s.includes("llm"))
    return Bot;
  if (
    s.includes("image") ||
    s.includes("txt2img") ||
    s.includes("vision") ||
    s.includes("sdxl")
  )
    return ImageIcon;
  if (s.includes("db") || s.includes("data")) return Database;
  return Cpu;
}

function isKromaRoute(path: string) {
  return path.includes("/gateway/kroma");
}

export default function RoutesView() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [routeToDelete, setRouteToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    path: "",
    upstreamUrl: "",
    description: "",
    reqObjStr: "",
    resObjStr: "",
  });

  const fetchRoutes = async () => {
    try {
      const res = await adminFetch("/api/admin/routes");
      const data = await res.json();
      setRoutes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  // ─── Realtime SSE: reload saat ada perubahan route atau log baru ──
  useSSE(
    ["route:change", "log:new"],
    (type) => {
      if (type === "route:change") fetchRoutes();
      // log:new bisa update request count tapi rate limited via fallback polling
    },
    !showModal && !editingRoute && !routeToDelete,
  );

  // Fallback polling (jangka panjang) untuk update request count tiap 30 dtk.
  useAutoRefresh(
    fetchRoutes,
    !showModal && !editingRoute && !routeToDelete,
    30,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const url = editingRoute
        ? `/api/admin/routes/${editingRoute.id}`
        : "/api/admin/routes";
      const method = editingRoute ? "PATCH" : "POST";

      let requestBodyMap, responseBodyMap;
      try {
        if (formData.reqObjStr.trim())
          requestBodyMap = JSON.parse(formData.reqObjStr);
        if (formData.resObjStr.trim())
          responseBodyMap = JSON.parse(formData.resObjStr);
      } catch (err) {
        setError("Format JSON pada Mapping tidak valid");
        return;
      }

      const payload = {
        path: formData.path,
        upstreamUrl: formData.upstreamUrl,
        description: formData.description,
        transformations: {
          requestBodyMap,
          responseBodyMap,
        },
      };

      const res = await adminFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setShowModal(false);
        fetchRoutes();
      } else {
        const data = await res.json();
        setError(data.error || "Gagal menyimpan Model API");
      }
    } catch (err) {
      console.error(err);
      setError("Terjadi kesalahan server saat menyimpan Model API");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      await adminFetch(`/api/admin/routes/${id}`, { method: "DELETE" });
      setRouteToDelete(null);
      fetchRoutes();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const openNewModal = () => {
    setEditingRoute(null);
    setError(null);
    setFormData({
      path: "/api/...",
      upstreamUrl: "https://...",
      description: "",
      reqObjStr: "",
      resObjStr: "",
    });
    setShowModal(true);
  };

  const handleSyncKroma = async () => {
    try {
      setIsSyncing(true);
      const res = await adminFetch("/api/admin/sync-kroma", { method: "POST" });
      if (res.ok) {
        fetchRoutes();
      } else {
        const data = await res.json();
        setError(data.error || "Gagal sinkronisasi dengan Kroma AI");
      }
    } catch (err) {
      console.error(err);
      setError("Terjadi kesalahan saat sinkronisasi Kroma AI");
    } finally {
      setIsSyncing(false);
    }
  };

  const openEditModal = (r: any) => {
    setEditingRoute(r);
    setError(null);
    setFormData({
      path: r.path,
      upstreamUrl: r.upstreamUrl,
      description: r.description,
      reqObjStr: r.transformations?.requestBodyMap
        ? JSON.stringify(r.transformations.requestBodyMap, null, 2)
        : "",
      resObjStr: r.transformations?.responseBodyMap
        ? JSON.stringify(r.transformations.responseBodyMap, null, 2)
        : "",
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 dark:from-white dark:to-slate-300">
            Model API{" "}
            <span className="text-emerald-500">(Integrasi)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Kelola pemetaan endpoint Model AI dan layanan backend eksternal ke dalam KroomBridge.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSyncKroma}
            disabled={isSyncing}
            className="flex items-center space-x-2 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-500/30 active:scale-95 text-sm font-bold disabled:opacity-50 group"
          >
            <RefreshCw
              className={`w-4 h-4 ${isSyncing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`}
            />
            <span>{isSyncing ? "Syncing..." : "Sync Kroma AI"}</span>
          </button>
          <button
            onClick={openNewModal}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 text-sm font-bold"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Model Baru</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          Array(3)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="h-56 bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded-3xl"
              ></div>
            ))
        ) : routes.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-white dark:bg-slate-900/50 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5">
              <Cpu className="w-10 h-10" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              Belum Ada Model API
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-3 text-sm">
              Tambahkan pemetaan antara gateway publik KroomBridge ke URL server
              backend atau sinkronisasi dengan Kroma AI untuk model bawaan.
            </p>
            <button
              onClick={openNewModal}
              className="mt-6 px-6 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-xl font-bold transition-colors"
            >
              Tambah Model Sekarang
            </button>
          </div>
        ) : (
          routes.map((r) => {
            const Icon = getModelIcon(r.path, r.description);
            const isKroma = isKromaRoute(r.path);

            return (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                key={r.id}
                className={`group rounded-3xl p-6 border transition-all duration-300 relative overflow-hidden ${
                  isKroma
                    ? "bg-gradient-to-br from-white to-indigo-50/30 dark:from-slate-900 dark:to-indigo-950/20 border-indigo-100 dark:border-indigo-800/40 hover:border-indigo-400/50 shadow-[0_4px_20px_-4px_rgba(99,102,241,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(99,102,241,0.15)]"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-500/40 shadow-sm hover:shadow-xl"
                }`}
              >
                {/* Glow Effect / Backdrop */}
                {isKroma && (
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-400/10 dark:bg-indigo-500/10 rounded-bl-full -mr-16 -mt-16 transition-transform duration-500 group-hover:scale-110 blur-3xl pointer-events-none"></div>
                )}
                {!isKroma && (
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-bl-full -mr-12 -mt-12 transition-transform duration-500 group-hover:scale-110 blur-2xl pointer-events-none"></div>
                )}

                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div
                    className={`p-3.5 rounded-2xl ${
                      isKroma
                        ? "bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-500/20 dark:to-purple-500/20 text-indigo-600 dark:text-indigo-400 shadow-inner"
                        : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex items-center space-x-1 bg-white/60 dark:bg-slate-800/60 p-1.5 rounded-2xl backdrop-blur-md border border-slate-100 dark:border-slate-700/50 shadow-sm">
                    <button
                      onClick={() => openEditModal(r)}
                      className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 rounded-xl transition-all"
                      title="Edit Model API"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setRouteToDelete(r.id)}
                      className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/20 rounded-xl transition-all"
                      title="Hapus Model API"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-5 relative z-10">
                  <div className="min-h-[40px]">
                    {r.description ? (
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
                        {r.description}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-slate-400 italic">
                        Tanpa deskripsi
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Link2 className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Gateway Path
                          </span>
                        </div>
                        {isKroma && (
                          <span className="flex items-center gap-1 text-[9px] font-bold bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                            <Sparkles className="w-2.5 h-2.5" />
                            KROMA
                          </span>
                        )}
                      </div>
                      <div
                        className={`flex items-center px-3.5 py-3 rounded-xl border ${
                          isKroma
                            ? "bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800/30"
                            : "bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700/50"
                        }`}
                      >
                        <span
                          className={`text-xs font-mono font-bold break-all ${
                            isKroma
                              ? "text-indigo-700 dark:text-indigo-300"
                              : "text-emerald-700 dark:text-emerald-300"
                          }`}
                        >
                          {r.path}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Terminal className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Target Endpoint
                        </span>
                      </div>
                      <div className="flex items-center px-3.5 py-3 rounded-xl border bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-700/50">
                        <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 break-all leading-relaxed">
                          {r.upstreamUrl}
                        </span>
                      </div>
                    </div>
                  </div>

                  {(r as any).transformations &&
                    ((r as any).transformations.requestBodyMap ||
                      (r as any).transformations.responseBodyMap) && (
                      <div className="pt-3 flex gap-2">
                        {(r as any).transformations.requestBodyMap && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5">
                            <ArrowRight className="w-3 h-3" /> Req Transform
                          </span>
                        )}
                        {(r as any).transformations.responseBodyMap && (
                          <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1.5">
                            <ArrowRight className="w-3 h-3" /> Res Transform
                          </span>
                        )}
                      </div>
                    )}
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          ></div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
          >
            <div className="px-4 sm:px-6 lg:px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 leading-tight">
                    {editingRoute ? "Edit Model API" : "Tambah Model API"}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-500">
                    Konfigurasi integrasi routing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-2.5 rounded-full transition-colors outline-none border border-slate-200 dark:border-slate-700"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8 space-y-6">
              {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30 rounded-2xl text-sm font-bold flex items-start gap-2.5 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0 animate-pulse"></div>
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Gateway Path
                </label>
                <input
                  type="text"
                  value={formData.path}
                  onChange={(e) =>
                    setFormData({ ...formData, path: e.target.value })
                  }
                  placeholder="/api/v1/chat/completions"
                  className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white font-mono text-sm"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  Path yang akan diakses oleh klien Anda di KroomBridge.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Target Endpoint (Upstream URL)
                </label>
                <input
                  type="url"
                  value={formData.upstreamUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, upstreamUrl: e.target.value })
                  }
                  placeholder="https://api.openai.com/v1/chat/completions"
                  className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white font-mono text-sm"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  Gateway akan meneruskan request ke URL eksternal ini.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Deskripsi Model (Opsional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Mis. Model Kroma AI: qwen3.6-27b"
                  className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Transformasi Request (JSON)
                  </label>
                  <textarea
                    rows={4}
                    placeholder={'{"oldKey": "newKey"}'}
                    value={formData.reqObjStr}
                    onChange={(e) =>
                      setFormData({ ...formData, reqObjStr: e.target.value })
                    }
                    className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white font-mono text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Transformasi Response (JSON)
                  </label>
                  <textarea
                    rows={4}
                    placeholder={'{"oldKey": "newKey"}'}
                    value={formData.resObjStr}
                    onChange={(e) =>
                      setFormData({ ...formData, resObjStr: e.target.value })
                    }
                    className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white font-mono text-sm resize-none"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-2.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold rounded-xl transition-colors outline-none"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 sm:px-6 lg:px-8 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all outline-none"
                >
                  Simpan
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <AnimatePresence>
        {routeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setRouteToDelete(null)}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white dark:bg-slate-900 rounded-[2rem] w-full max-w-sm p-4 sm:p-6 lg:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl text-center"
            >
              <div className="w-20 h-20 bg-rose-50 dark:bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-5">
                <Trash2 className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
                Hapus Model API Ini?
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                Apakah Anda yakin ingin menghapus model API ini? Request yang masuk ke path tersebut akan langsung gagal.
              </p>
              <div className="flex gap-3">
                <button
                  disabled={isDeleting}
                  onClick={() => setRouteToDelete(null)}
                  className="flex-1 px-4 py-3 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50 border border-slate-200 dark:border-slate-700"
                >
                  Batal
                </button>
                <button
                  disabled={isDeleting}
                  onClick={() => handleDelete(routeToDelete)}
                  className="flex-1 px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-500/30 transition-colors disabled:opacity-50"
                >
                  {isDeleting ? "Menghapus..." : "Ya, Hapus"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
