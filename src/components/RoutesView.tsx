import { adminFetch } from "../lib/api";
import React, { useState, useEffect } from "react";
import { Network, Plus, Trash2, Edit2, Play, Combine } from "lucide-react";
import { motion } from "motion/react";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import { useSSE } from "../lib/useSSE";

type Route = {
  id: string;
  path: string;
  upstreamUrl: string;
  description: string;
  isActive: boolean;
};

export default function RoutesView() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [routeToDelete, setRouteToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
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
        setError(data.error || "Gagal menyimpan route");
      }
    } catch (err) {
      console.error(err);
      setError("Terjadi kesalahan server saat menyimpan route");
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
            API Upstream Routes{" "}
            <span className="text-emerald-500">(Integrasi)</span>
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Petakan endpoint gateway ke backend asli (upstream) yang diberikan
            developer.
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 text-sm font-bold"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Route Baru</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(3)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="h-48 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-2xl"
              ></div>
            ))
        ) : routes.length === 0 ? (
          <div className="col-span-full py-12 text-center bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
            <Combine className="w-12 h-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">
              Belum Ada Route
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2 text-sm">
              Tambahkan pemetaan antara gateway publik KroomBridge ke URL server
              / API backend Anda yang sebenarnya.
            </p>
          </div>
        ) : (
          routes.map((r) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={r.id}
              className="group bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:border-emerald-500/30 transition-all relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110"></div>

              <div className="flex justify-between items-start mb-4 relative z-10">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <Network className="w-5 h-5" />
                </div>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => openEditModal(r)}
                    className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setRouteToDelete(r.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4 relative z-10">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Gateway Endpoint
                  </span>
                  <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-sm font-mono text-emerald-600 dark:text-emerald-400 font-bold break-all">
                      {r.path}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Upstream URL
                  </span>
                  <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-700">
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400 break-all">
                      {r.upstreamUrl}
                    </span>
                  </div>
                </div>

                {r.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                    {r.description}
                  </p>
                )}

                {(r as any).transformations &&
                  ((r as any).transformations.requestBodyMap ||
                    (r as any).transformations.responseBodyMap) && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                      {(r as any).transformations.requestBodyMap && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded font-bold">
                          Req Transform
                        </span>
                      )}
                      {(r as any).transformations.responseBodyMap && (
                        <span className="text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-2 py-0.5 rounded font-bold">
                          Res Transform
                        </span>
                      )}
                    </div>
                  )}
              </div>

              <div className="absolute bottom-5 right-5 z-0 opacity-10">
                <Play className="w-24 h-24 text-emerald-500" />
              </div>
            </motion.div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          ></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {editingRoute ? "Edit Route" : "Tambah Route Baru"}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors outline-none"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {error && (
                <div className="p-4 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-800/30 rounded-2xl text-sm font-bold flex items-start gap-2.5 shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0 animate-pulse"></div>
                  <span>{error}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Gateway Endpoint Path
                </label>
                <input
                  type="text"
                  value={formData.path}
                  onChange={(e) =>
                    setFormData({ ...formData, path: e.target.value })
                  }
                  placeholder="/wa/v1/send"
                  className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white font-mono text-sm"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  Path yang akan diakses oleh klien Anda.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Upstream / Target URL
                </label>
                <input
                  type="url"
                  value={formData.upstreamUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, upstreamUrl: e.target.value })
                  }
                  placeholder="https://api.upstream.com/wa/send"
                  className="w-full border-slate-200 dark:border-slate-700 rounded-xl shadow-sm focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 px-4 py-3 border bg-slate-50/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 transition-colors outline-none dark:text-white font-mono text-sm"
                  required
                />
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  Gateway akan meneruskan request ke URL backend asli ini.
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Deskripsi Route (Opsional)
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="API Kirim Pesan WA (Server Upstream)"
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
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all outline-none"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {routeToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setRouteToDelete(null)}
          ></div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-800 shadow-2xl text-center"
          >
            <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2">
              Hapus Route Ini?
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Apakah Anda yakin ingin menghapus route upstream ini? Gateway
              tidak akan meneruskan request ke endpoint ini lagi.
            </p>
            <div className="flex gap-3">
              <button
                disabled={isDeleting}
                onClick={() => setRouteToDelete(null)}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                disabled={isDeleting}
                onClick={() => handleDelete(routeToDelete)}
                className="flex-1 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-500/30 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
