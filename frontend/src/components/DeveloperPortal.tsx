import React, { useState } from "react";
import {
  Terminal,
  Copy,
  Check,
  Play,
  Settings2,
  BookOpen,
  Key,
  AlertCircle,
  MessageSquare,
  Image as ImageIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

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
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4, ease: "easeOut" } },
} as const;

const contentVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
} as const;

export default function DeveloperPortal() {
  const [activeTab, setActiveTab] = useState("auth");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  const baseUrl = "https://kroombridge.kii.lat";

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ code, id }: { code: string; id: string }) => (
    <div className="relative group rounded-2xl overflow-hidden mt-3 shadow-sm border border-slate-700">
      <div className="absolute top-0 left-0 w-full h-8 bg-slate-800/80 flex items-center px-4 space-x-2 border-b border-slate-700/50">
        <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
      </div>
      <pre className="bg-[#0f111a] text-emerald-400 p-6 pt-12 rounded-2xl text-[13px] leading-relaxed font-mono overflow-auto custom-scrollbar">
        {code}
      </pre>
      <button
        onClick={() => copy(code, id)}
        className="absolute top-2 right-2 p-1.5 bg-slate-700/50 backdrop-blur-sm text-slate-300 hover:text-white rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-slate-600 border border-slate-600/50"
        title="Salin kode"
      >
        {copiedCode === id ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Copy className="w-3.5 h-3.5" />
        )}
      </button>
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
        className="flex justify-between items-center bg-white dark:bg-slate-900/50 p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group"
      >
        <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-indigo-100/60 dark:from-indigo-900/20 via-purple-50/40 dark:via-purple-900/10 to-blue-50/40 dark:to-blue-900/10 rounded-full blur-3xl -mr-16 -mt-16 opacity-80 group-hover:scale-110 transition-transform duration-700"></div>
        <div className="relative z-10 flex-1">
          <h2 className="text-2xl font-black bg-gradient-to-r from-slate-800 dark:from-white to-slate-600 dark:to-slate-300 bg-clip-text text-transparent flex items-center gap-4 mb-2 tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 dark:from-indigo-900/30 to-blue-50 dark:to-blue-900/30 flex items-center justify-center shadow-sm border border-indigo-100/50 dark:border-indigo-800/50">
              <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            Portal Developer & Sandbox
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm ml-1 font-medium">
            Dokumentasi API interaktif, panduan integrasi, dan lingkungan
            pengujian untuk klien Anda.
          </p>
        </div>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        <motion.div
          variants={itemVariants}
          className="w-full lg:w-72 shrink-0 space-y-1 bg-white dark:bg-slate-900/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]"
        >
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-4 pt-2">
            Persiapan Awal
          </div>
          <button
            onClick={() => setActiveTab("auth")}
            className={`w-full text-left px-4 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center space-x-3 ${activeTab === "auth" ? "bg-gradient-to-r from-blue-50 dark:from-blue-900/30 to-indigo-50 dark:to-indigo-900/30 text-blue-700 dark:text-blue-400 shadow-sm border border-blue-100/50 dark:border-blue-800/50" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent"}`}
          >
            <Key
              className={`w-4 h-4 ${activeTab === "auth" ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}
            />
            <span>Autentikasi</span>
          </button>
          <button
            onClick={() => setActiveTab("errors")}
            className={`w-full text-left px-4 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center space-x-3 mt-1 ${activeTab === "errors" ? "bg-gradient-to-r from-rose-50 dark:from-rose-900/30 to-orange-50 dark:to-orange-900/30 text-rose-700 dark:text-rose-400 shadow-sm border border-rose-100/50 dark:border-rose-800/50" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent"}`}
          >
            <AlertCircle
              className={`w-4 h-4 ${activeTab === "errors" ? "text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"}`}
            />
            <span>Kode Eror</span>
          </button>

          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-8 mb-3 px-4">
            Endpoint Gateway
          </div>
          <button
            onClick={() => setActiveTab("wa")}
            className={`w-full text-left px-4 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center space-x-3 ${activeTab === "wa" ? "bg-gradient-to-r from-emerald-50 dark:from-emerald-900/30 to-teal-50 dark:to-teal-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-100/50 dark:border-emerald-800/50" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent"}`}
          >
            <MessageSquare
              className={`w-4 h-4 ${activeTab === "wa" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}
            />
            <span>WA Notification API</span>
          </button>
          <button
            onClick={() => setActiveTab("chat")}
            className={`w-full text-left px-4 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center space-x-3 mt-1 ${activeTab === "chat" ? "bg-gradient-to-r from-purple-50 dark:from-purple-900/30 to-fuchsia-50 dark:to-fuchsia-900/30 text-purple-700 dark:text-purple-400 shadow-sm border border-purple-100/50 dark:border-purple-800/50" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent"}`}
          >
            <Terminal
              className={`w-4 h-4 ${activeTab === "chat" ? "text-purple-600 dark:text-purple-400" : "text-slate-400 dark:text-slate-500"}`}
            />
            <span>AI Chat API</span>
          </button>
          <button
            onClick={() => setActiveTab("image")}
            className={`w-full text-left px-4 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center space-x-3 mt-1 ${activeTab === "image" ? "bg-gradient-to-r from-amber-50 dark:from-amber-900/30 to-orange-50 dark:to-orange-900/30 text-amber-700 dark:text-amber-400 shadow-sm border border-amber-100/50 dark:border-amber-800/50" : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent"}`}
          >
            <ImageIcon
              className={`w-4 h-4 ${activeTab === "image" ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`}
            />
            <span>AI Image Generation</span>
          </button>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="flex-1 bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-10 min-h-[600px] overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 p-32 bg-gradient-to-bl from-slate-50 dark:from-slate-800/50 to-white dark:to-slate-900/50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60 pointer-events-none"></div>

          <AnimatePresence mode="wait">
            {activeTab === "auth" && (
              <motion.div
                key="auth"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-8 relative z-10"
              >
                <div>
                  <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                    Autentikasi API Key
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-3 max-w-2xl">
                    KroomBridge API Gateway menggunakan otorisasi <strong>API Key</strong>. Klien dapat langsung menggunakan <code className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 text-rose-500 dark:text-rose-400 px-1.5 py-0.5 rounded-md">API Key</code> mereka pada HTTP header <code className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-800 text-emerald-500 dark:text-emerald-400 px-1.5 py-0.5 rounded-md">Authorization: Bearer</code> tanpa perlu menukarkan JWT.
                  </p>
                </div>

                <div className="border border-emerald-100 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-900/20 p-5 rounded-2xl">
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-3">
                    <span className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm">
                      HEADER
                    </span>
                    <span className="font-mono text-sm">Authorization: Bearer &lt;API_KEY&gt;</span>
                  </h4>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-medium">
                    Sertakan header ini pada setiap permintaan (request) API yang Anda lakukan ke server KroomBridge.
                  </p>
                </div>

                <div className="grid gap-6 mt-8">
                  <div>
                    <h5 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-widest pl-1">
                      Contoh Request (Semua Endpoint)
                    </h5>
                    <CodeBlock
                      id="auth-req"
                      code={`curl -X POST \\
  ${baseUrl}/gateway/kroma/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk_b878621d573c..." \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Halo!"}]
  }'`}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === "wa" && (
              <motion.div
                key="wa"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="space-y-8 relative z-10"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                  <div>
                    <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                      WA Notification API
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mt-3 max-w-xl">
                      Kirim pesan WhatsApp otomatis (notifikasi, OTP, alert)
                      langsung melalui layanan upstream WA dengan mudah.
                    </p>
                  </div>
                  <button className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/30 text-white px-5 py-2.5 rounded-xl font-bold text-sm flex items-center space-x-2 transition-all">
                    <Play className="w-4 h-4 fill-current" />
                    <span>Uji Endpoint</span>
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm p-5 rounded-2xl">
                  <h4 className="font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-3 mb-3">
                    <span className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm">
                      POST
                    </span>
                    <span className="font-mono text-sm">/gateway/wa/send</span>
                  </h4>
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-400 text-xs font-bold">
                    <Settings2 className="w-3.5 h-3.5" />
                    <span>
                      Membutuhkan Akses API:{" "}
                      <code className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-800 dark:text-indigo-300">
                        /gateway/wa/send
                      </code>{" "}
                      atau{" "}
                      <code className="bg-white dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-800 dark:text-indigo-300">
                        *
                      </code>
                    </span>
                  </span>
                </div>

                <div>
                  <h5 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-widest pl-1 mb-3">
                    Skema Body Permintaan
                  </h5>
                  <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden text-sm">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-5 py-3 font-bold text-slate-600 dark:text-slate-400">
                            Properti
                          </th>
                          <th className="px-5 py-3 font-bold text-slate-600 dark:text-slate-400">
                            Tipe
                          </th>
                          <th className="px-5 py-3 font-bold text-slate-600 dark:text-slate-400">
                            Deskripsi
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-slate-600 dark:text-slate-400 font-medium pb-2">
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-5 py-4 font-mono font-bold text-rose-500 dark:text-rose-400">
                            to
                          </td>
                          <td className="px-5 py-4">
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 flex w-max rounded-md font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              string
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            Nomor telepon tujuan dalam format internasional
                            (contoh:{" "}
                            <code className="bg-slate-50 dark:bg-slate-800 px-1 font-mono rounded">
                              +6281...
                            </code>
                            )
                          </td>
                        </tr>
                        <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-5 py-4 font-mono font-bold text-rose-500 dark:text-rose-400">
                            text
                          </td>
                          <td className="px-5 py-4">
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 flex w-max rounded-md font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                              string
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            Isi pesan teks yang akan dikirim (mendukung format
                            WhatsApp standar).
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h5 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-widest pl-1 mt-8 mb-2">
                    Contoh Implementasi via cURL
                  </h5>
                  <CodeBlock
                    id="wa-req"
                    code={`curl -X POST \\
  ${baseUrl}/gateway/wa/send \\
  -H "Authorization: Bearer <API_KEY_ANDA>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "+6281234567890",
    "text": "Halo dari *KroomBridge Gateway*! 🚀"
  }'`}
                  />
                </div>
              </motion.div>
            )}

            {(activeTab === "chat" ||
              activeTab === "image" ||
              activeTab === "errors") && (
              <motion.div
                key="coming_soon"
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="flex items-center justify-center h-full text-slate-400 absolute inset-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm"
              >
                <div className="text-center space-y-6 max-w-sm">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl mx-auto flex items-center justify-center border border-slate-100 dark:border-slate-700 shadow-sm relative overflow-hidden group">
                    <Terminal className="w-8 h-8 text-slate-400 dark:text-slate-500 relative z-10 group-hover:scale-110 transition-transform" />
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-50 dark:from-blue-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">
                      Segera Hadir
                    </h3>
                    <p className="font-medium text-slate-500 dark:text-slate-400">
                      Dokumentasi untuk bagian ini sedang dalam tahap
                      penyusunan. Cek kembali nanti.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
}
