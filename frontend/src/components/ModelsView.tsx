import React, { useState, useEffect } from "react";
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
  Power
} from "lucide-react";



type SortConfig = {
  key: "name" | "multiplier";
  direction: "asc" | "desc";
} | null;

export default function ModelsView() {
  const [activeModels, setActiveModels] = useState<any[]>([]);
  const [disabledModels, setDisabledModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchKromaModels = async () => {
    setIsLoading(true);
    setSyncStatus("idle");
    try {
      // Ambil daftar model dari Kroma AI
      const res = await adminFetch(`/api/admin/providers`);
      if (!res.ok) {
        throw new Error("Gagal mengambil data model dari server Kroma AI.");
      }
      
      // Ambil data meta (untuk mendapatkan disabledModels)
      const metaRes = await adminFetch(`/api/admin/system/meta`);
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        setDisabledModels(metaData.disabledModels || []);
        setHasChanges(false);
      }

      const responseData = await res.json();
      const providers = responseData.data || [];
      
      let allModels: any[] = [];

      providers.forEach((providerObj: any) => {
        const providerName = providerObj.name || providerObj.id || "Kroma AI";
        const modelsList = providerObj.models || [];

        modelsList.forEach((modelStr: string) => {
          const name = modelStr;
          let multiplier = 1.0; // Default multiplier
          const n = name.toLowerCase();
          
          if (n.includes("qwen")) { multiplier = 0.8; } 
          else if (n.includes("llama")) { multiplier = 0.75; } 
          else if (n.includes("kimi") || n.includes("moonshot") || n.includes("minimax")) { multiplier = 0.95; }
          else if (n.includes("deepseek")) { multiplier = 1.2; }
          else if (n.includes("nemotron")) { multiplier = 1.0; }
          else if (n.includes("gemini")) { 
            if (n.includes("flash")) multiplier = 1.5; 
            else if (n.includes("pro")) multiplier = 3.0; 
            else multiplier = 1.5; 
          }
          else if (n.includes("claude")) { 
            if (n.includes("opus")) multiplier = 5.0; 
            else if (n.includes("sonnet")) multiplier = 3.5; 
            else if (n.includes("haiku")) multiplier = 0.5; 
            else multiplier = 3.5; 
          }
          else if (n.includes("gpt")) { 
            if (n.includes("mini")) multiplier = 0.3; 
            else multiplier = 5.5; 
          }

          allModels.push({
            name,
            multiplier,
            provider: providerName
          });
        });
      });

      if (allModels.length > 0) {
        setActiveModels(allModels);
        setSyncStatus("success");
      } else {
        setActiveModels([]);
        setSyncStatus("idle");
      }
    } catch (err: any) {
      console.error("Sync Kroma Error:", err);
      setErrorMsg(err.message || "Terjadi kesalahan jaringan.");
      setActiveModels([]);
      setSyncStatus("error");
    } finally {
      setIsLoading(false);
      setTimeout(() => setSyncStatus((prev) => prev !== "idle" ? "idle" : prev), 4000);
    }
  };

  useEffect(() => {
    fetchKromaModels();
  }, []);

  const handleSort = (key: "name" | "multiplier") => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const toggleModelStatus = (modelName: string) => {
    const isCurrentlyDisabled = disabledModels.includes(modelName);
    const newDisabledModels = isCurrentlyDisabled
      ? disabledModels.filter((m) => m !== modelName)
      : [...disabledModels, modelName];

    setDisabledModels(newDisabledModels);
    setHasChanges(true);
  };

  const saveChanges = async () => {
    setIsSaving(true);
    try {
      const res = await adminFetch(`/api/admin/system/meta`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledModels }),
      });
      
      if (!res.ok) {
        throw new Error("Gagal menyimpan perubahan");
      }
      
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to update disabled models:", error);
      alert("Gagal menyimpan perubahan. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  // Apply sorting
  const sortedModels = React.useMemo(() => {
    let sortableModels = [...activeModels];
    if (sortConfig !== null) {
      sortableModels.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableModels;
  }, [activeModels, sortConfig]);

  const SortIcon = ({ columnKey }: { columnKey: "name" | "multiplier" }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUp className="w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-3 h-3 text-blue-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-500" />
    );
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-blue-100/60 dark:from-blue-900/20 via-sky-50/40 dark:via-sky-900/10 to-transparent rounded-full blur-3xl -mr-16 -mt-16 opacity-80 pointer-events-none"></div>
        <div className="relative z-10 flex-1">
          <h2 className="text-2xl font-black bg-gradient-to-r from-slate-800 dark:from-white to-slate-600 dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-4 mb-2 tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 dark:from-blue-900/30 to-sky-50 dark:from-sky-900/30 flex items-center justify-center shadow-sm border border-blue-100/50 dark:border-blue-800/50">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            Kroma AI Catalog
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm ml-1 font-medium max-w-2xl">
            Daftar model Kroma AI yang tersedia dan tersinkronisasi di gateway Anda beserta pengali token (multiplier).
          </p>
        </div>
      </motion.div>


      {/* Pricing Table Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 tracking-tight flex items-center space-x-2">
              <span>Kroma AI Synced Models</span>
              {isLoading && (
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] uppercase font-bold tracking-wider ml-2 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                  <span>Syncing</span>
                </span>
              )}
              {!isLoading && syncStatus === "success" && (
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] uppercase font-bold tracking-wider ml-2 shrink-0">
                  <Check className="w-3 h-3" />
                  <span>Success</span>
                </span>
              )}
              {!isLoading && syncStatus === "error" && (
                <span className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-[10px] uppercase font-bold tracking-wider ml-2 shrink-0">
                  <AlertCircle className="w-3 h-3" />
                  <span>Failed</span>
                </span>
              )}
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              Atur status model dan urutkan berdasarkan nama atau nilai pengali (multiplier).
            </p>
          </div>
          <div className="flex items-center space-x-3">
            {hasChanges && (
              <button
                onClick={saveChanges}
                disabled={isSaving}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-sm disabled:opacity-50 transition-colors shrink-0"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{isSaving ? "Menyimpan..." : "Simpan Perubahan"}</span>
              </button>
            )}
            <button
              onClick={fetchKromaModels}
              disabled={isLoading || syncStatus === "success"}
              className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 transition-colors shadow-sm disabled:opacity-50 shrink-0"
            >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
            ) : syncStatus === "success" ? (
              <Check className="w-4 h-4 text-emerald-500" />
            ) : syncStatus === "error" ? (
              <RefreshCw className="w-4 h-4 text-rose-500" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            <span>{isLoading ? "Syncing..." : syncStatus === "success" ? "Synced" : syncStatus === "error" ? "Retry" : "Sync Models"}</span>
          </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider select-none">
                <tr>
                  <th 
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors group"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Model</span>
                      <SortIcon columnKey="name" />
                    </div>
                  </th>
                  <th 
                    className="px-6 py-4 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors group"
                    onClick={() => handleSort("multiplier")}
                  >
                    <div className="flex items-center space-x-2">
                      <span>Token Multiplier</span>
                      <SortIcon columnKey="multiplier" />
                    </div>
                  </th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Provider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {sortedModels.map((model, idx) => {
                  const isDisabled = disabledModels.includes(model.name);
                  
                  return (
                  <tr
                    key={idx}
                    className={`transition-colors ${isDisabled ? 'bg-slate-50/50 dark:bg-slate-900/20 opacity-60 grayscale-[0.5]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${isDisabled ? 'bg-slate-200 dark:bg-slate-800' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          {isDisabled ? (
                             <Power className="w-3 h-3 text-slate-400" />
                          ) : (
                             <Sparkles className="w-3 h-3 text-slate-400" />
                          )}
                        </div>
                        <span className={`font-bold text-slate-800 dark:text-slate-200 ${isDisabled ? 'line-through text-slate-500 dark:text-slate-500' : ''}`}>{model.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{model.multiplier}x</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-500 font-medium tracking-wide">MULTIPLIER</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700/50">
                        {model.provider}
                      </span>
                    </td>
                  </tr>
                )})}
                {activeModels.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
                      {errorMsg || "Gagal mendapatkan daftar model. Pastikan server Kroma AI Anda menyala dan terhubung."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-start space-x-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
            <p>Klik pada header kolom <strong>Model</strong> atau <strong>Token Multiplier</strong> untuk mengurutkan daftar. Anda dapat mematikan model tertentu dengan menekan tombol status.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
