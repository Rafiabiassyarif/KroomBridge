import React, { useState, useEffect } from "react";
import { adminFetch } from "../lib/api";
import { motion } from "motion/react";
import { Key, Shield, AlertOctagon, Plus, Trash2, Copy, Pencil, Check } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export type ApiKey = {
  id: string;
  name: string;
  key: string;
  provider: string;
  createdAt: string;
};

export function ApiKeyViewInner() {
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  
  // Form state
  const [keyName, setKeyName] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [keyProvider, setKeyProvider] = useState("kroma");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [systemMessage, setSystemMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await adminFetch("/api/admin/system/meta");
      if (res.ok) {
        const meta = await res.json();
        // Migrate old kromaApiKey if apiKeys is empty but old key exists
        let keys = Array.isArray(meta.apiKeys) ? meta.apiKeys : [];
        if (keys.length === 0 && meta.kromaApiKey) {
          const migratedKey: ApiKey = {
            id: crypto.randomUUID(),
            name: "Default Kroma Key",
            key: meta.kromaApiKey,
            provider: "kroma",
            createdAt: new Date().toISOString()
          };
          keys = [migratedKey];
          // Auto save the migration
          await adminFetch("/api/admin/system/meta", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiKeys: keys }),
          });
        }
        setApiKeys(keys);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName || !keyValue) return;

    setIsProcessing(true);
    
    let updatedKeys;
    if (editingId) {
      updatedKeys = apiKeys.map(k => 
        k.id === editingId 
          ? { ...k, name: keyName, key: keyValue, provider: keyProvider }
          : k
      );
    } else {
      const newKey: ApiKey = {
        id: crypto.randomUUID(),
        name: keyName,
        key: keyValue,
        provider: keyProvider,
        createdAt: new Date().toISOString()
      };
      updatedKeys = [...apiKeys, newKey];
    }

    try {
      const res = await adminFetch("/api/admin/system/meta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeys: updatedKeys }),
      });
      const data = await res.json();
      if (res.ok) {
        setApiKeys(updatedKeys);
        setKeyName("");
        setKeyValue("");
        setEditingId(null);
        setSystemMessage({
          text: editingId ? "API Key berhasil diperbarui!" : "API Key berhasil ditambahkan!",
          type: "success",
        });
      } else {
        setSystemMessage({
          text: data.error || "Gagal menyimpan API Key.",
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

  const handleDeleteKey = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus API Key ini?")) return;
    
    setIsProcessing(true);
    const updatedKeys = apiKeys.filter(k => k.id !== id);

    try {
      const res = await adminFetch("/api/admin/system/meta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeys: updatedKeys }),
      });
      
      if (res.ok) {
        setApiKeys(updatedKeys);
        if (editingId === id) handleCancelEdit();
        setSystemMessage({
          text: "API Key berhasil dihapus!",
          type: "success",
        });
      }
    } catch (e) {
      setSystemMessage({ text: "Terjadi kesalahan saat menghapus.", type: "error" });
    } finally {
      setIsProcessing(false);
      setTimeout(() => setSystemMessage(null), 5000);
    }
  };

  const handleEditClick = (k: ApiKey) => {
    setEditingId(k.id);
    setKeyName(k.name);
    setKeyValue(k.key);
    setKeyProvider(k.provider);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setKeyName("");
    setKeyValue("");
    setKeyProvider("kroma");
  };

  const handleCopy = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Helper to mask key (e.g. sk-27d0...8645)
  const maskKey = (key?: string) => {
    if (!key || typeof key !== "string" || key.length < 10) return "******";
    return `${key.substring(0, 7)}...${key.substring(key.length - 4)}`;
  };

  if (loading)
    return (
      <div className="flex items-center justify-center p-4 sm:p-6 lg:p-10">
        <div className="w-8 h-8 flex space-x-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
          <div className="w-3 h-3 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
          <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
        </div>
      </div>
    );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8 max-w-5xl mx-auto pb-10"
    >
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl p-4 sm:p-6 lg:p-8 rounded-3xl border border-white/50 dark:border-white/[0.06] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group gap-4 sm:gap-0"
      >
        <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-emerald-100/60 dark:from-emerald-900/20 via-teal-50/40 dark:via-teal-900/10 to-cyan-50/40 dark:to-cyan-900/10 rounded-full blur-3xl -mr-16 -mt-16 opacity-80 group-hover:scale-110 transition-transform duration-700"></div>
        <div className="absolute bottom-0 left-0 p-24 bg-gradient-to-tr from-slate-50/40 dark:from-slate-800/40 to-slate-100/40 dark:to-slate-700/40 rounded-full blur-3xl -ml-16 -mb-16 opacity-60"></div>

        <div className="relative z-10 flex-1">
          <h2 className="text-2xl font-black bg-gradient-to-r from-slate-800 dark:from-white to-slate-600 dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-4 mb-2 tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-50 dark:from-emerald-900/30 to-teal-50 dark:to-teal-900/30 flex items-center justify-center shadow-sm border border-emerald-100/50 dark:border-emerald-800/50">
              <Key className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>Manajemen API Key</div>
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm ml-1 font-medium">
            Kelola dan daftarkan berbagai kunci rahasia API (Kroma AI, dll) dalam satu wadah.
          </p>
        </div>
      </motion.div>

      {systemMessage && (
        <motion.div
          variants={itemVariants}
          className={`p-4 rounded-2xl flex items-center gap-3 font-bold text-sm ${
            systemMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800"
              : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-800"
          }`}
        >
          {systemMessage.type === "success" ? (
            <Shield className="w-5 h-5" />
          ) : (
            <AlertOctagon className="w-5 h-5" />
          )}
          {systemMessage.text}
        </motion.div>
      )}

      {/* Form Tambah Key Baru */}
      <motion.div
        variants={itemVariants}
        className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/50 dark:border-white/[0.06] rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden"
      >
        <div className="p-6 border-b border-white/50 dark:border-white/[0.06] flex justify-between items-center bg-white/60 dark:bg-white/[0.02]">
          <h3 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center space-x-2 tracking-tight">
            {editingId ? <Pencil className="w-4 h-4 text-emerald-500" /> : <Plus className="w-4 h-4 text-emerald-500" />}
            <span>{editingId ? "Edit API Key" : "Tambah API Key Baru"}</span>
          </h3>
        </div>

        <div className="p-6">
          <form onSubmit={handleAddKey} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">Nama Key</label>
              <input
                type="text"
                required
                placeholder="Misal: Kroma Prod Key"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="w-full border border-white/50 dark:border-white/[0.04] rounded-xl px-4 py-3 bg-white dark:bg-[#0d0f14] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-zinc-800 dark:text-white text-sm"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">Provider</label>
              <select
                value={keyProvider}
                onChange={(e) => setKeyProvider(e.target.value)}
                className="w-full border border-white/50 dark:border-white/[0.04] rounded-xl px-4 py-3 bg-white dark:bg-[#0d0f14] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-zinc-800 dark:text-white text-sm cursor-pointer"
              >
                <option value="kroma">Kroma AI</option>
                <option value="openai">OpenAI</option>
                <option value="custom">Custom Provider</option>
              </select>
            </div>
            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">Secret Key</label>
              <input
                type="text"
                required
                placeholder="sk-..."
                value={keyValue}
                onChange={(e) => setKeyValue(e.target.value)}
                className="w-full border border-white/50 dark:border-white/[0.04] rounded-xl px-4 py-3 bg-white dark:bg-[#0d0f14] outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 font-mono text-zinc-800 dark:text-white text-sm"
              />
            </div>
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={isProcessing}
                className="flex-1 h-[46px] flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30 outline-none disabled:opacity-50"
              >
                {editingId ? "Update" : "Simpan"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isProcessing}
                  className="px-4 h-[46px] flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold rounded-xl transition-all hover:bg-zinc-200 dark:hover:bg-zinc-700 outline-none disabled:opacity-50"
                >
                  Batal
                </button>
              )}
            </div>
          </form>
        </div>
      </motion.div>

      {/* Tabel API Keys */}
      <motion.div
        variants={itemVariants}
        className="bg-white/40 dark:bg-white/[0.03] backdrop-blur-xl border border-white/50 dark:border-white/[0.06] rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] overflow-hidden"
      >
        <div className="p-6 border-b border-white/50 dark:border-white/[0.06] flex justify-between items-center bg-white/60 dark:bg-white/[0.02]">
          <h3 className="text-lg font-bold text-zinc-800 dark:text-white flex items-center space-x-2 tracking-tight">
            <Key className="w-4 h-4 text-zinc-500" />
            <span>Daftar API Keys Tersimpan</span>
          </h3>
          <span className="text-xs font-medium px-2.5 py-1 bg-zinc-100 dark:bg-white/5 text-zinc-600 dark:text-zinc-400 rounded-lg">
            {apiKeys.length} Total
          </span>
        </div>

        <div className="overflow-x-auto">
          {apiKeys.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/[0.04]">
                  <th className="py-4 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nama Key</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Provider</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Secret Key</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Dibuat Pada</th>
                  <th className="py-4 px-6 text-[10px] font-bold text-zinc-400 uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((k) => (
                  <tr key={k.id} className="border-b border-zinc-50 dark:border-white/[0.02] hover:bg-zinc-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                    <td className="py-4 px-6">
                      <div className="font-bold text-sm text-zinc-800 dark:text-zinc-200">{k.name}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 capitalize">
                        {k.provider}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-300 rounded text-xs font-mono">
                          {maskKey(k.key)}
                        </code>
                        <button
                          onClick={() => handleCopy(k.key, k.id)}
                          className="p-1 text-zinc-400 hover:text-emerald-500 transition-colors"
                          title="Salin Key"
                        >
                          {copiedId === k.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {k.createdAt && !isNaN(new Date(k.createdAt).getTime()) 
                          ? new Date(k.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                          : "Tidak diketahui"}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleEditClick(k)}
                          disabled={isProcessing}
                          className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"
                          title="Edit Key"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteKey(k.id)}
                          disabled={isProcessing}
                          className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                          title="Hapus Key"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800/50 rounded-full flex items-center justify-center mb-4">
                <Key className="w-8 h-8 text-zinc-400" />
              </div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-white mb-1">Belum ada API Key</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                Tambahkan kunci rahasia API Anda menggunakan form di atas untuk mulai menghubungkan KroomBridge dengan layanan pihak ketiga.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: Error | null}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 sm:p-6 lg:p-10 bg-rose-50 dark:bg-rose-900/20 text-rose-600 rounded-xl m-10 border border-rose-500">
          <h2 className="font-bold text-xl mb-4">Component Crash!</h2>
          <pre className="text-xs whitespace-pre-wrap">{this.state.error?.stack || this.state.error?.message || String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ApiKeyView() {
  return (
    <ErrorBoundary>
      <ApiKeyViewInner />
    </ErrorBoundary>
  );
}
