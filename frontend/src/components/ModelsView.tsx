import React, { useState, useEffect, useMemo } from "react";
import { adminFetch } from "../lib/api";
import { motion, AnimatePresence } from "motion/react";
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
  X,
  Search,
  Copy,
  LayoutGrid,
  Maximize2,
  Zap,
  Filter
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
    label: "Kroma AI (Cloud)",
    url: "https://kroma.kroombox.com",
    desc: "Model cloud Kroma AI (Airforce, PC Hitam, OpenCode, dll).",
    icon: Globe,
    accent: "from-blue-500 to-indigo-600",
    badge: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/40",
  },
  "9r": {
    label: "9r.kii.lat (Lokal)",
    url: "https://9r.kii.lat",
    desc: "Model lokal via LiteLLM (LM Studio & Ollama).",
    icon: Server,
    accent: "from-emerald-500 to-teal-600",
    badge: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40",
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
  
  // New UI controls: Search, active source tab, and layout mode
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | Source>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [layoutMode, setLayoutMode] = useState<"stacked" | "split">("stacked");
  const [copiedModel, setCopiedModel] = useState<string | null>(null);

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

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedModel(text);
    setTimeout(() => setCopiedModel(null), 2000);
  };

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
        body: JSON.stringify({ modelAliases: nextAliases }),
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

  // Filter and sort models
  const filteredAndSortedModels = useMemo(() => {
    let list = [...models];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((m) => {
        const alias = modelAliases[m.name]?.toLowerCase() || "";
        return (
          m.name.toLowerCase().includes(q) ||
          m.provider.toLowerCase().includes(q) ||
          alias.includes(q)
        );
      });
    }

    // Filter by status
    if (statusFilter === "active") {
      list = list.filter((m) => !disabledModels.includes(m.name));
    } else if (statusFilter === "disabled") {
      list = list.filter((m) => disabledModels.includes(m.name));
    }

    // Sort
    if (sortConfig !== null) {
      list.sort((a, b) => {
        const cmp =
          a[sortConfig.key] < b[sortConfig.key]
            ? -1
            : a[sortConfig.key] > b[sortConfig.key]
            ? 1
            : 0;
        return sortConfig.direction === "asc" ? cmp : -cmp;
      });
    }

    return list;
  }, [models, searchQuery, statusFilter, sortConfig, disabledModels, modelAliases]);

  const modelsBySource = (source: Source) =>
    filteredAndSortedModels.filter((m) => m.source === source);
  const totalCountBySource = (source: Source) =>
    models.filter((m) => m.source === source).length;
  const activeCountBySource = (source: Source) =>
    models.filter((m) => m.source === source && !disabledModels.includes(m.name)).length;

  const totalActiveModels = models.filter((m) => !disabledModels.includes(m.name)).length;

  const SortIcon = ({ columnKey }: { columnKey: "name" | "multiplier" }) => {
    if (sortConfig?.key !== columnKey)
      return (
        <ArrowUp className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      );
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-3 h-3 text-blue-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-500" />
    );
  };

  const getMultiplierStyle = (mult: number) => {
    if (mult < 1.0) {
      return "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/40";
    }
    if (mult === 1.0) {
      return "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/60";
    }
    if (mult <= 2.0) {
      return "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200/80 dark:border-blue-800/40";
    }
    return "bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border-purple-200/80 dark:border-purple-800/40";
  };

  const SourceCard = ({ source }: { source: Source }) => {
    const meta = SOURCE_META[source];
    const Icon = meta.icon;
    const list = modelsBySource(source);
    const status = syncStatus[source];
    const totalCount = totalCountBySource(source);
    const activeCount = activeCountBySource(source);

    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 rounded-3xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-[0_4px_20px_rgb(0,0,0,0.2)] overflow-hidden transition-all"
      >
        {/* Card Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 pb-5 border-b border-slate-100 dark:border-slate-800/80 gap-4 sm:gap-0 bg-slate-50/50 dark:bg-slate-900/30">
          <div className="flex items-center space-x-4">
            <div
              className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${meta.accent} flex items-center justify-center shadow-md shadow-blue-500/10`}
            >
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {meta.label}
                </h3>
                {isLoading && (
                  <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] uppercase font-bold tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                    <span>Syncing</span>
                  </span>
                )}
                {!isLoading && status === "success" && (
                  <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold tracking-wider border border-emerald-200/50 dark:border-emerald-800/40">
                    <Check className="w-3 h-3" />
                    <span>Terhubung</span>
                  </span>
                )}
                {!isLoading && status === "error" && (
                  <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] uppercase font-bold tracking-wider border border-rose-200/50 dark:border-rose-800/40">
                    <AlertCircle className="w-3 h-3" />
                    <span>Gagal</span>
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                {meta.url}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border ${meta.badge}`}
            >
              <Cpu className="w-3.5 h-3.5 mr-1.5" />
              {activeCount} / {totalCount} Model Aktif
            </span>
          </div>
        </div>

        {/* Table Container - Responsive & Never Squeezed */}
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm min-w-[700px]">
            <thead className="bg-slate-50/80 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 font-bold text-[11px] uppercase tracking-wider select-none border-b border-slate-100 dark:border-slate-800/80">
              <tr>
                <th
                  className="px-6 py-3.5 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors group w-[40%]"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center space-x-2">
                    <span>Model AI & ID</span>
                    <SortIcon columnKey="name" />
                  </div>
                </th>
                <th
                  className="px-4 py-3.5 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition-colors group w-[18%]"
                  onClick={() => handleSort("multiplier")}
                >
                  <div className="flex items-center space-x-2">
                    <span>Token Multiplier</span>
                    <SortIcon columnKey="multiplier" />
                  </div>
                </th>
                <th className="px-4 py-3.5 w-[12%]">Status</th>
                <th className="px-4 py-3.5 w-[18%]">Alias / Display Name</th>
                <th className="px-6 py-3.5 text-right w-[12%]">Provider</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {list.map((model, idx) => {
                const isDisabled = disabledModels.includes(model.name);
                const parts = model.name.split("/");
                const hasPrefix = parts.length > 1;
                const prefix = hasPrefix ? parts.slice(0, -1).join("/") + "/" : "";
                const shortName = parts[parts.length - 1];

                return (
                  <tr
                    key={idx}
                    className={`transition-colors group hover:bg-blue-50/30 dark:hover:bg-blue-950/10 ${
                      isDisabled
                        ? "bg-slate-50/50 dark:bg-slate-900/30 opacity-60 grayscale-[0.4]"
                        : ""
                    }`}
                  >
                    {/* Model Name & ID (Never Cut Off) */}
                    <td className="px-6 py-4">
                      <div className="flex items-start space-x-3.5">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isDisabled
                              ? "bg-slate-200 dark:bg-slate-800 text-slate-400"
                              : "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/30"
                          }`}
                        >
                          {isDisabled ? (
                            <Power className="w-3.5 h-3.5" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {hasPrefix && (
                              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100/90 dark:bg-slate-800/90 px-1.5 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60 font-medium">
                                {prefix}
                              </span>
                            )}
                            <span
                              className={`font-extrabold text-sm text-slate-900 dark:text-slate-100 break-words leading-tight ${
                                isDisabled
                                  ? "line-through text-slate-400 dark:text-slate-500 font-normal"
                                  : ""
                              }`}
                            >
                              {shortName}
                            </span>
                            <button
                              onClick={() => handleCopy(model.name)}
                              className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all opacity-40 group-hover:opacity-100 cursor-pointer"
                              title="Salin Full Model ID"
                            >
                              {copiedModel === model.name ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-1 select-all">
                            {model.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Multiplier Badge */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-extrabold border ${getMultiplierStyle(
                            model.multiplier,
                          )}`}
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          {model.multiplier}x
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                          {model.multiplier < 1.0
                            ? "Hemat"
                            : model.multiplier > 2.0
                            ? "Pro"
                            : "Standar"}
                        </span>
                      </div>
                    </td>

                    {/* Status Toggle */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleModelStatus(model.name)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer ${
                            !isDisabled
                              ? "bg-emerald-500"
                              : "bg-slate-300 dark:bg-slate-700"
                          }`}
                          title={isDisabled ? "Klik untuk Mengaktifkan" : "Klik untuk Menonaktifkan"}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                              !isDisabled ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                          {!isDisabled ? "Aktif" : "Mati"}
                        </span>
                      </div>
                    </td>

                    {/* Alias */}
                    <td className="px-4 py-4">
                      <div className="flex items-center group/alias space-x-2">
                        {modelAliases[model.name] ? (
                          <>
                            <span
                              className="text-xs px-2.5 py-1 rounded-lg bg-blue-50/80 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-bold border border-blue-200/60 dark:border-blue-800/40 truncate max-w-[160px]"
                              title={modelAliases[model.name]}
                            >
                              {modelAliases[model.name]}
                            </span>
                            <button
                              onClick={() => {
                                setTempAlias(modelAliases[model.name]);
                                setEditingAlias(model.name);
                              }}
                              className="p-1 text-slate-400 hover:text-blue-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-all opacity-0 group-hover/alias:opacity-100 cursor-pointer"
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
                            className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Tambah Alias"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span className="font-medium">+ Atur Alias</span>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Provider (Full Width, Never Cut Off) */}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60 shadow-sm"
                        title={model.provider}
                      >
                        {model.provider}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {list.length === 0 && !isLoading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 text-sm font-medium"
                  >
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p>
                        {searchQuery
                          ? `Tidak ada model yang cocok dengan kata kunci "${searchQuery}".`
                          : errorMsg ||
                            `Tidak ada model dari ${meta.label}. Pastikan server aktif dan API key benar.`}
                      </p>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline cursor-pointer"
                        >
                          Reset Pencarian
                        </button>
                      )}
                    </div>
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
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Banner & Header */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white dark:bg-[#121826] p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm relative overflow-hidden gap-6"
      >
        <div className="absolute top-0 right-0 p-36 bg-gradient-to-bl from-blue-500/10 via-indigo-500/5 to-transparent rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        <div className="relative z-10 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-extrabold uppercase tracking-wider mb-3 border border-blue-100 dark:border-blue-800/40">
            <Sparkles className="w-3.5 h-3.5" />
            AI Gateway Registry
          </div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Katalog Model AI
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1.5 font-medium max-w-2xl leading-relaxed">
            Kelola model dari upstream <strong>9r.kii.lat</strong> (lokal) dan{" "}
            <strong>kroma.kroombox.com</strong> (cloud). Atur status, alias nama, dan token multiplier tanpa terpotong.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 shrink-0">
          <button
            onClick={fetchModels}
            disabled={isLoading}
            className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Sinkronisasi..." : "Sinkronkan Semua"}</span>
          </button>
        </div>
      </motion.div>

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Total Model
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {models.length}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Model Lokal (9r)
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalCountBySource("9r")}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Model Cloud (Kroma)
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalCountBySource("kroma")}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#121826] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
            <Power className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
              Model Aktif
            </span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {totalActiveModels}{" "}
              <span className="text-xs font-bold text-slate-400">/ {models.length}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Control Toolbar: Search, Source Tabs, Status Filter, and View Mode */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white dark:bg-[#121826] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari model, provider, atau alias..."
            className="w-full bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700/80 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters and View Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Source Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                activeTab === "all"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Semua ({models.length})
            </button>
            <button
              onClick={() => setActiveTab("9r")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "9r"
                  ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              <Server className="w-3 h-3" />
              9r Lokal ({totalCountBySource("9r")})
            </button>
            <button
              onClick={() => setActiveTab("kroma")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "kroma"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              <Globe className="w-3 h-3" />
              Kroma Cloud ({totalCountBySource("kroma")})
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Aktif
            </button>
            <button
              onClick={() => setStatusFilter("disabled")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "disabled"
                  ? "bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              Mati
            </button>
          </div>

          {/* Layout Mode Toggle (Stacked Full-Width vs Split Grid) */}
          <div className="hidden sm:flex bg-slate-100 dark:bg-slate-900/80 p-1 rounded-xl border border-slate-200/60 dark:border-slate-800">
            <button
              onClick={() => setLayoutMode("stacked")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                layoutMode === "stacked"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              title="Tampilan Penuh (Full Width - Rekomendasi agar tidak kepotong)"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLayoutMode("split")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                layoutMode === "split"
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
              title="Tampilan Berdampingan (Split Grid)"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Display Source Cards */}
      {layoutMode === "stacked" || activeTab !== "all" ? (
        <div className="space-y-8">
          {(activeTab === "all" || activeTab === "9r") && <SourceCard source="9r" />}
          {(activeTab === "all" || activeTab === "kroma") && <SourceCard source="kroma" />}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <SourceCard source="9r" />
          <SourceCard source="kroma" />
        </div>
      )}

      {/* Helper Info Footer */}
      <div className="p-5 bg-white dark:bg-[#121826] border border-slate-200/80 dark:border-slate-800/80 rounded-2xl text-xs font-medium text-slate-500 dark:text-slate-400 flex items-start space-x-3 shadow-sm">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
        <p className="leading-relaxed">
          <strong>Tips:</strong> Klik ikon <strong>Salin</strong> di samping nama model untuk mengambil Model ID lengkap. 
          Gunakan tombol <strong>+ Atur Alias</strong> untuk memberi nama khusus (misalnya <em>"Fable 5"</em> atau <em>"Claude 3.5 Sonnet"</em>) 
          yang akan dikenali dan ditranslasikan secara otomatis oleh Gateway untuk klien Anda.
        </p>
      </div>

      {/* Edit Alias Modal */}
      {editingAlias && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-[#151a28] rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden"
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="flex items-center space-x-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-500">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 dark:text-slate-100">
                    Atur Alias Model
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-[220px]">
                    {editingAlias}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingAlias(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={saveAliasForm} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nama Alias Kustom
                  </label>
                  <input
                    type="text"
                    value={tempAlias}
                    onChange={(e) => setTempAlias(e.target.value)}
                    placeholder="Contoh: Fable 5 atau Pro-Search"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                    autoFocus
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2.5 leading-relaxed">
                    Klien Anda dapat memanggil model ini menggunakan nama alias di atas. Kosongkan jika ingin menghapus alias.
                  </p>
                </div>
              </div>
              <div className="mt-8 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setEditingAlias(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingAlias}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {isSavingAlias ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{isSavingAlias ? "Menyimpan..." : "Simpan Alias"}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
