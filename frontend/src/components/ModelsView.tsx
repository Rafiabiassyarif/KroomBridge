import React, { useState, useEffect } from "react";
import { adminFetch } from "../lib/api";
import { motion } from "motion/react";
import {
  Sparkles,
  Info,
  RefreshCw,
  Check,
  AlertCircle,
  Key
} from "lucide-react";

const CHAT_MODELS = [
  { name: "GPT 5.6", price: "$5.5", unit: "1M tokens", provider: "OpenAI" },
  { name: "Claude Sonnet 3.5", price: "$3.5", unit: "1M tokens", provider: "Anthropic" },
  { name: "Gemini 3.5 Flash", price: "$1.5", unit: "1M tokens", provider: "Google" },
  { name: "Kimi K2.7 Code", price: "$0.95", unit: "1M tokens", provider: "Moonshot" },
  { name: "Qwen 3.6 72B", price: "$0.8", unit: "1M tokens", provider: "Alibaba" },
];

export default function ModelsView() {
  const [activeModels, setActiveModels] = useState(CHAT_MODELS);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchKromaModels = async () => {
    setIsLoading(true);
    setSyncStatus("idle");
    try {
      const url = `/api/admin/providers`;
      const res = await adminFetch(url);
      if (!res.ok) {
        let msg = "Gagal mengambil data dari server.";
        try {
          const errData = await res.json();
          if (errData.error) msg = errData.error;
        } catch(e) {}
        
        console.error("Sync Kroma Error:", msg);
        setErrorMsg(msg);
        setActiveModels([]);
        setSyncStatus("error");
        setTimeout(() => setSyncStatus("idle"), 5000);
        return;
      }
      const responseData = await res.json();
      const providers = responseData.data || [];
      
      let allModels: any[] = [];

      providers.forEach((providerObj: any) => {
        const providerName = providerObj.name || providerObj.id || "Kroma AI";
        const modelsList = providerObj.models || [];

        modelsList.forEach((modelStr: string) => {
          const name = modelStr;
          let price = 2.0; // Default
          const n = name.toLowerCase();
          
          if (n.includes("qwen")) { price = 0.9; } 
          else if (n.includes("llama")) { price = 0.75; } 
          else if (n.includes("kimi") || n.includes("moonshot") || n.includes("minimax")) { price = 1.5; }
          else if (n.includes("deepseek")) { price = 1.2; }
          else if (n.includes("nemotron")) { price = 1.0; }
          else if (n.includes("claude")) { 
            if (n.includes("opus")) price = 16.5; 
            else if (n.includes("sonnet")) price = 3.5; 
            else if (n.includes("haiku")) price = 0.5; 
            else price = 3.5; 
          }
          else if (n.includes("gpt")) { 
            if (n.includes("mini")) price = 0.3; 
            else if (n.includes("4o")) price = 5.5; 
            else price = 5.5; 
          }
          else if (n.includes("gemini")) { 
            if (n.includes("flash")) price = 0.15; 
            else if (n.includes("pro")) price = 1.5; 
            else price = 1.0; 
          }

          allModels.push({
            name,
            price: `$${price}`,
            unit: "1M tokens",
            provider: providerName
          });
        });
      });

      if (allModels.length > 0) {
        setActiveModels(allModels);
        setSyncStatus("success");
      } else {
        setActiveModels(CHAT_MODELS);
        setSyncStatus("idle");
      }
    } catch (err: any) {
      console.error("Gagal mengambil Kroma models untuk pricing:", err);
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
            Daftar model Kroma AI yang tersedia dan tersinkronisasi di gateway Anda beserta estimasi harga per token.
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
              Daftar model Kroma AI yang tersedia di gateway Anda beserta estimasi harga per token.
            </p>
          </div>
          <div className="flex items-center space-x-3">
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
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Model</th>
                  <th className="px-6 py-4">Unit Price</th>
                  <th className="px-6 py-4 text-right">Provider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {activeModels.map((model, idx) => {
                  return (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-6 py-4 font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-3">
                      <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Sparkles className="w-3 h-3 text-slate-400" />
                      </div>
                      <span>{model.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{model.price}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-500 font-medium">/ {model.unit}</span>
                      </div>
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
                    <td colSpan={3} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400 text-sm font-medium">
                      {errorMsg || "Gagal mendapatkan daftar model. Pastikan server Kroma AI Anda menyala dan terhubung."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-start space-x-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
            <p>Daftar harga di atas merupakan estimasi harga per token berdasarkan nama model AI.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
