import React, { useState, useEffect } from "react";
import { adminFetch } from "../lib/api";
import { motion } from "motion/react";
import {
  Calculator,
  Zap,
  Image as ImageIcon,
  Video,
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
  const [budget, setBudget] = useState<number>(1000);
  const [selectedModelIdx, setSelectedModelIdx] = useState<number>(0);
  const [activeModels, setActiveModels] = useState(CHAT_MODELS);
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<"idle" | "success" | "error">("idle");
  const [apiKeyInput, setApiKeyInput] = useState("");

  const fetchKromaModels = async () => {
    setIsLoading(true);
    setSyncStatus("idle");
    try {
      const url = apiKeyInput.trim() 
        ? `/api/admin/providers?customKey=${encodeURIComponent(apiKeyInput.trim())}`
        : `/api/admin/providers`;
      const res = await adminFetch(url);
      if (!res.ok) {
        setIsLoading(false);
        setSyncStatus("error");
        setTimeout(() => setSyncStatus("idle"), 3000);
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
          
          if (n.includes("claude")) { 
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
          else if (n.includes("qwen")) { price = 0.9; } 
          else if (n.includes("llama")) { price = 0.75; } 
          else if (n.includes("kimi") || n.includes("moonshot") || n.includes("minimax")) { price = 1.5; }
          else if (n.includes("deepseek")) { price = 1.2; }
          else if (n.includes("nemotron")) { price = 1.0; }

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
        setSelectedModelIdx(0);
        setSyncStatus("success");
      } else {
        setActiveModels([]);
        setSyncStatus("error");
      }
    } catch (err) {
      console.error("Gagal mengambil Kroma models untuk pricing:", err);
      setSyncStatus("error");
    } finally {
      setIsLoading(false);
      setTimeout(() => setSyncStatus((prev) => prev !== "idle" ? "idle" : prev), 4000);
    }
  };

  useEffect(() => {
    fetchKromaModels();
  }, []);

  // Estimasi dinamis berdasarkan model yang dipilih
  const currentModelPrice = parseFloat(activeModels[selectedModelIdx]?.price.replace("$", "") || "4");
  const textTokens = (budget / currentModelPrice) * 1_000_000;

  const imageGens = budget / 0.02;
  const videoSecs = budget / 0.1;

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + "B";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return Math.floor(num).toLocaleString();
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
            Kroma AI Catalog & Budget Estimator
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm ml-1 font-medium max-w-2xl">
            Atur slider untuk melihat sejauh mana budget bulanan Anda bisa digunakan untuk inferensi menggunakan berbagai model dari Kroma AI.
          </p>
        </div>
      </motion.div>

      {/* Estimator Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white dark:bg-[#151921] border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-sm"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <Calculator className="w-5 h-5 text-slate-400" />
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">
              Monthly Budget
            </h3>
          </div>
          <div className="text-2xl font-black text-slate-800 dark:text-white">
            ${budget.toLocaleString()} <span className="text-sm font-bold text-slate-400">/ mo</span>
          </div>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-8">
          Gunakan satu slider ini untuk membandingkan kapasitas Teks, Gambar, dan Video secara langsung.
        </p>

        <div className="mb-12 relative px-2">
          <input
            type="range"
            min="10"
            max="5000"
            step="10"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
          />
          <div className="flex justify-between text-xs font-bold text-slate-400 mt-3 px-1">
            <span>$10</span>
            <span>$5,000+</span>
          </div>
        </div>

        {/* Capacity Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Text Card */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:border-sky-300 dark:hover:border-sky-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-sky-600 dark:text-sky-400 font-bold text-sm uppercase tracking-wider">
                <Zap className="w-4 h-4" />
                <span>TEXT</span>
              </div>
            </div>
            <div className="flex items-baseline space-x-2 min-w-0">
              <span className="text-3xl xl:text-4xl font-black tracking-tight text-slate-800 dark:text-white truncate">
                ~{formatNumber(textTokens)}
              </span>
              <div className="text-xs font-bold text-slate-500 shrink-0">
                Tokens
              </div>
            </div>
            <div className="mt-4 relative">
              <select
                value={selectedModelIdx}
                onChange={(e) => setSelectedModelIdx(Number(e.target.value))}
                className="w-full appearance-none px-3 py-1.5 pr-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300 outline-none cursor-pointer hover:border-sky-500/50 transition-colors truncate"
              >
                {activeModels.map((m, i) => (
                  <option key={i} value={i}>
                    {m.name} ({m.price})
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none">
                <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7"></path></svg>
              </div>
            </div>
          </div>

          {/* Image Card */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:border-purple-300 dark:hover:border-purple-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-purple-600 dark:text-purple-400 font-bold text-sm uppercase tracking-wider">
                <ImageIcon className="w-4 h-4" />
                <span>IMAGE</span>
              </div>
            </div>
            <div className="flex items-baseline space-x-2 min-w-0">
              <span className="text-3xl xl:text-4xl font-black tracking-tight text-slate-800 dark:text-white truncate">
                ~{formatNumber(imageGens)}
              </span>
              <div className="text-xs font-bold text-slate-500 shrink-0">
                Images
              </div>
            </div>
            <div className="mt-4">
              <span className="inline-block px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-300">
                Standard resolution
              </span>
            </div>
          </div>

          {/* Video Card */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 relative overflow-hidden group hover:border-amber-300 dark:hover:border-amber-700 transition-colors">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-amber-600 dark:text-amber-400 font-bold text-sm uppercase tracking-wider">
                <Video className="w-4 h-4" />
                <span>VIDEO</span>
              </div>
            </div>
            <div className="flex items-baseline space-x-2 min-w-0">
              <span className="text-3xl xl:text-4xl font-black tracking-tight text-slate-800 dark:text-white truncate">
                ~{formatNumber(videoSecs)}
              </span>
              <div className="text-xs font-bold text-slate-500 shrink-0">
                Seconds
              </div>
            </div>
            <div className="mt-4">
              <span className="inline-block px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-300">
                HD generation
              </span>
            </div>
          </div>
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
            <div className="relative hidden sm:block">
              <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                placeholder="Custom Kroma API Key..."
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="pl-9 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 w-48 lg:w-64 transition-all"
              />
            </div>
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
                  <th className="px-6 py-4">Est. Capacity</th>
                  <th className="px-6 py-4 text-right">Provider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                {activeModels.map((model, idx) => {
                  const rowPrice = parseFloat(model.price.replace("$", "")) || 4;
                  const rowTokens = (budget / rowPrice) * 1_000_000;
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
                    <td className="px-6 py-4">
                      <span className="font-black text-sky-600 dark:text-sky-400">
                        ~{formatNumber(rowTokens)}
                      </span>
                      <span className="text-xs font-bold text-slate-400 ml-1">Tokens</span>
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
                      Gagal mendapatkan daftar model. Pastikan Kroma API Key sudah dikonfigurasi di Settings atau coba klik tombol Sync Models.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 flex items-start space-x-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
            <p>Harga di atas merupakan estimasi harga markup berdasarkan nama model untuk simulasi perhitungan token.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
