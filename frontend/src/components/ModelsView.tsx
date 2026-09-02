import React, { useState, useEffect, useMemo } from "react";
import { adminFetch } from "../lib/api";
import { motion } from "motion/react";
import {
  Sparkles,
  Info,
  RefreshCw,
  Check,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Power,
  Server,
  Globe,
  Cpu,
  Edit2,
  X
} from "lucide-react";

type Source = "kroma" | "9r";

type ModelItem = {
  name: string;
  multiplier: number;
  provider: string;
  source: Source;
};

type SortConfig = {
  key: "name" | "multiplier";
  direction: "asc" | "desc";
} | null;

const SOURCE_META: Record<
  Source,
  {
    label: string;
    url: string;
    desc: string;
    icon: any;
    accent: string;
    badge: string;
  }
> = {
  kroma: {
    label: "Kroma AI",
    url: "https://kroma.kroombox.com",
    desc: "Model cloud Kroma AI (Airforce, PC Hitam, dll).",
    icon: Globe,
    accent: "from-blue-500 to-indigo-600",
    badge: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  },
  "9r": {
    label: "9r.kii.lat",
    url: "https://9r.kii.lat",
    desc: "Model lokal via LiteLLM (LM Studio & Ollama).",
    icon: Server,
    accent: "from-emerald-500 to-teal-600",
    badge: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
  },
};

function multiplierFor(name: string): number {
  const n = name.toLowerCase();
  if (n.includes("qwen")) return 0.8;
  if (n.includes("llama")) return 0.75;
  if (n.includes("kimi") || n.includes("moonshot") || n.includes("minimax")) return 0.95;
  if (n.includes("deepseek")) return 1.2;
  if (n.includes("nemotron")) return 1.0;
  if (n.includes("gemini")) return n.includes("pro") ? 3.0 : 1.5;
  if (n.includes("claude")) {
    if (n.includes("opus")) return 5.0;
    if (n.includes("sonnet")) return 3.5;
    if (n.includes("haiku")) return 0.5;
    return 3.5;
  }
  if (n.includes("gpt")) return n.includes("mini") ? 0.3 : 5.5;
  return 1.0;
}

export default function ModelsView() {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [disabledModels, setDisabledModels] = useState<string[]>([]);
  const [modelAliases, setModelAliases] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<Record<Source, "idle" | "success" | "error">>({
    kroma: "idle",
    "9r": "idle",
  });
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [editingAlias, setEditingAlias] = useState<string | null>(null);
  const [tempAlias, setTempAlias] = useState<string>("");
  const [isSavingAlias, setIsSavingAlias] = useState(false);

  const loadDisabledModels = async () => {
    const metaRes = await adminFetch(`/api/admin/system/meta?t=${Date.now()}`);
    if (metaRes.ok) {
      const metaData = await metaRes.json();
      setDisabledModels(metaData.disabledModels || []);
      setModelAliases(metaData.modelAliases || {});
    }
  };

  const fetchModels = async () => {
    setIsLoading(true);
    setErrorMsg("");
    setSyncStatus({ kroma: "idle", "9r": "idle" });
    try {
      const res = await adminFetch(`/api/admin/providers?t=${Date.now()}`);
      if (!res.ok) throw new Error("Gagal mengambil data model dari server.");

      const providers = (await res.json()).data || [];
      const all: ModelItem[] = [];

      providers.forEach((p: any) => {
        const source: Source = p.source === "9r" ? "9r" : "kroma";
        const providerName = p.name || (source === "9r" ? "9r" : "Kroma AI");
        (p.models || []).forEach((m: string) => {
          all.push({
            name: m,
            multiplier: multiplierFor(m),
            provider: providerName,
            source,
          });
        });
        // Tandai status per source
        if ((p.models || []).length > 0) {
          setSyncStatus((prev) => ({ ...prev, [source]: "success" }));
        }
      });

      setModels(all);
      await loadDisabledModels();
    } catch (err: any) {
      console.error("Sync Models Error:", err);
      setErrorMsg(err.message || "Terjadi kesalahan jaringan.");
      setSyncStatus({ kroma: "error", "9r": "error" });
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setSyncStatus((prev) => ({
          kroma: prev.kroma !== "idle" ? "idle" : prev.kroma,
          "9r": prev["9r"] !== "idle" ? "idle" : prev["9r"],
        }));
      }, 4000);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleSort = (key: "name" | "multiplier") => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const toggleModelStatus = async (modelName: string) => {
    const prevDisabled = [...disabledModels];
    const isDisabled = disabledModels.includes(modelName);
    const nextDisabled = isDisabled
      ? disabledModels.filter((m) => m !== modelName)
      : [...disabledModels, modelName];
      
    setDisabledModels(nextDisabled);

    try {
      const res = await adminFetch(`/api/admin/system/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledModels: nextDisabled }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan status");
    } catch (error) {
      console.error("Failed to update disabled models:", error);
      alert("Gagal menyimpan perubahan status model.");
      setDisabledModels(prevDisabled);
    }
  };

  const saveAliasForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAlias) return;
    setIsSavingAlias(true);
    try {
      const nextAliases = { ...modelAliases };
      if (tempAlias.trim() === "") {
        delete nextAliases[editingAlias];
      } else {
        nextAliases[editingAlias] = tempAlias.trim();
      }
      
      const res = await adminFetch(`/api/admin/system/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelAliases: nextAliases }), // Note: only update modelAliases or include disabledModels as well. 
        // Wait, sending `modelAliases` only will merge it because backend accepts partial updates!
      });
      if (!res.ok) throw new Error("Gagal menyimpan alias");
      
      setModelAliases(nextAliases);
      setEditingAlias(null);
    } catch (error) {
      console.error("Failed to update alias:", error);
      alert("Gagal menyimpan alias.");
    } finally {
      setIsSavingAlias(false);
    }
  };

  const sortedModels = useMemo(() => {
    let list = [...models];
    if (sortConfig !== null) {
      list.sort((a, b) => {
        const cmp = a[sortConfig.key] < b[sortConfig.key] ? -1 : a[sortConfig.key] > b[sortConfig.key] ? 1 : 0;
        return sortConfig.direction === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [models, sortConfig]);

  const modelsBySource = (source: Source) => sortedModels.filter((m) => m.source === source);
  const countBySource = (source: Source) => models.filter((m) => m.source === source).length;

  const SortIcon = ({ columnKey }: { columnKey: "name" | "multiplier" }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUp className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-3 h-3 text-blue-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-500" />
    );
  };

  const SourceCard = ({ source }: { source: Source }) => {
    const meta = SOURCE_META[source];
    const Icon = meta.icon;
    const list = modelsBySource(source);
    const status = syncStatus[source];
    const count = countBySource(source);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden"
      >
        {/* Card header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 pb-4 border-b border-slate-100 dark:border-slate-800 gap-4 sm:gap-0">
          <div className="flex items-center space-x-4">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${meta.accent} flex items-center justify-center shadow-md`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">{meta.label}</h3>
                {isLoading && (
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] uppercase font-bold tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    <span>Syncing</span>
                  </span>
                )}
                {!isLoading && status === "success" && (
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold tracking-wider">
                    <Check className="w-3 h-3" />
                    <span>Synced</span>
                  </span>
                )}
                {!isLoading && status === "error" && (
                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] uppercase font-bold tracking-wider">
                    <AlertCircle className="w-3 h-3" />
                    <span>Failed</span>
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">{meta.url}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${meta.badge}`}>
              <Cpu className="w-3.5 h-3.5 mr-1.5" />
              {count} model
            </span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm table-fixed">
            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider select-none">
              <tr>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors group w-[35%]"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center space-x-2">
                    <span>Model</span>
                    <SortIcon columnKey="name" />
                  </div>
                </th>
                <th
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors group w-[15%]"
                  onClick={() => handleSort("multiplier")}
                >
                  <div className="flex items-center space-x-2">
                    <span>Multiplier</span>
                    <SortIcon columnKey="multiplier" />
                  </div>
                </th>
                <th className="px-4 py-3 w-[10%]">Status</th>
                <th className="px-4 py-3 w-[25%]">Alias</th>
                <th className="px-4 py-3 text-right w-[15%]">Provider</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
              {list.map((model, idx) => {
                const isDisabled = disabledModels.includes(model.name);
                return (
                  <tr
                    key={idx}
                    className={`transition-colors ${isDisabled ? 'bg-slate-50/50 dark:bg-slate-900/20 opacity-60 grayscale-[0.5]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}
                  >
                    <td className="px-4 py-3.5 overflow-hidden">
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isDisabled ? 'bg-slate-200 dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          {isDisabled ? (
                            <Power className="w-3 h-3 text-slate-400" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                        <span className={`font-bold truncate text-slate-800 dark:text-slate-200 ${isDisabled ? 'line-through text-slate-500 dark:text-slate-500' : ''}`} title={model.name}>
                          {model.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center space-x-1.5 whitespace-nowrap">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{model.multiplier}x</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-500 font-medium tracking-wide">MULT</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => toggleModelStatus(model.name)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900 ${
                          !isDisabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            !isDisabled ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center group/alias space-x-2 min-h-[28px]">
                        {modelAliases[model.name] ? (
                          <>
                            <span className="text-sm truncate text-blue-600 dark:text-blue-400 font-bold" title={modelAliases[model.name]}>
                              {modelAliases[model.name]}
                            </span>
                            <button
                              onClick={() => {
                                setTempAlias(modelAliases[model.name]);
                                setEditingAlias(model.name);
                              }}
                              className="p-1.5 shrink-0 text-slate-400 hover:text-blue-500 bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md opacity-0 group-hover/alias:opacity-100 transition-all"
                              title="Edit Alias"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setTempAlias("");
                              setEditingAlias(model.name);
                            }}
                            className="p-1.5 shrink-0 text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-all opacity-60 hover:opacity-100 group-hover/alias:opacity-100"
                            title="Tambah Alias"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50 truncate max-w-[80px]" title={model.provider}>
                        {model.provider}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 sm:py-6 lg:py-10 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
                    {errorMsg || `Tidak ada model dari ${meta.label}. Pastikan server reachable dan API key benar.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-900/50 p-4 sm:p-6 lg:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden gap-4 sm:gap-0"
      >
        <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-blue-100/60 dark:from-blue-900/20 via-sky-50/40 dark:via-sky-900/10 to-transparent rounded-full blur-3xl -mr-16 -mt-16 opacity-80 pointer-events-none"></div>
        <div className="relative z-10 flex-1">
          <h2 className="text-2xl font-black bg-gradient-to-r from-slate-800 dark:from-white to-slate-600 dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-4 mb-2 tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 dark:from-blue-900/30 to-sky-50 dark:from-sky-900/30 flex items-center justify-center shadow-sm border border-blue-100/50 dark:border-blue-800/50">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            Model AI Catalog
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm ml-1 font-medium max-w-2xl">
            Daftar model dari kedua upstream — <strong>9r.kii.lat</strong> (model lokal) dan <strong>kroma.kroombox.com</strong> (model cloud Kroma) — beserta pengali token (multiplier).
          </p>
        </div>
        <div className="relative z-10 flex items-center space-x-3 shrink-0">
          <button
            onClick={fetchModels}
            disabled={isLoading}
            className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-500" : ""}`} />
            <span>{isLoading ? "Syncing..." : "Sync All"}</span>
          </button>
        </div>
      </motion.div>

      {/* Two source cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <SourceCard source="9r" />
        <SourceCard source="kroma" />
      </div>

      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-medium text-slate-500 dark:text-slate-400 flex items-start space-x-2">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
        <p>Klik header <strong>Model</strong> atau <strong>Token Multiplier</strong> untuk mengurutkan. Matikan model dengan toggle status, atau klik ikon Edit (pensil) di kolom Alias untuk mengganti nama model yang muncul di klien. Perubahan tersimpan secara global.</p>
      </div>

      {/* Edit Alias Modal */}
      {editingAlias && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Edit Nama Model</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate max-w-[200px]">{editingAlias}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingAlias(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveAliasForm} className="p-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Alias / Custom Name
                  </label>
                  <input
                    type="text"
                    value={tempAlias}
                    onChange={(e) => setTempAlias(e.target.value)}
                    placeholder="Contoh: Fable 5"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Kosongkan kolom ini jika ingin kembali menggunakan nama asli (<code className="font-mono">{editingAlias}</code>).
                  </p>
                </div>
              </div>
              <div className="mt-8 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingAlias(null)}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingAlias}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-50 transition-colors"
                >
                  {isSavingAlias ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{isSavingAlias ? "Menyimpan..." : "Simpan"}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
