import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { BookOpen, Key, Terminal, Code, Server, Copy, Check, Blocks } from "lucide-react";

const CodeSnippet = ({ code, language = "bash" }: { code: string; language?: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative mt-4 mb-6 group">
      <div className="absolute flex items-center justify-between top-0 inset-x-0 px-4 py-2 bg-slate-900/80 border-b border-white/10 rounded-t-xl z-10 backdrop-blur-md">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{language}</span>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className="bg-[#0D1117] rounded-xl border border-slate-800/80 overflow-hidden shadow-inner pt-11 pb-4 px-5">
        <pre className="text-[13px] text-slate-300 font-mono whitespace-pre overflow-x-auto leading-relaxed custom-scrollbar">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export default function DocsView() {
  const baseUrl = "https://kroombridge.kroombox.com";

  const chatRequestCode = `curl -X POST ${baseUrl}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <API_KEY_ANDA>" \\
  -d '{
    "model": "qwen3.5-9b-ultra-uncensored-heretic-v2",
    "messages": [
      {
        "role": "system",
        "content": "Anda adalah asisten AI yang cerdas dan membantu."
      },
      {
        "role": "user",
        "content": "Halo! Tolong buatkan saya pantun jenaka."
      }
    ],
    "stream": false
  }'`;

  const pythonSdkCode = `import openai

# Inisialisasi client OpenAI dengan Base URL KroomBridge
client = openai.OpenAI(
    base_url="${baseUrl}/v1",
    api_key="<API_KEY_ANDA>"  # Masukkan API Key Klien di sini
)

# Request Chat Completion
response = client.chat.completions.create(
    model="pc-putih/lmstudio/qwen3.6-27b-uncensored-hauhaucs-aggressive",
    messages=[
        {"role": "system", "content": "Anda adalah asisten cerdas."},
        {"role": "user", "content": "Halo, apa kabar?"}
    ],
    stream=False
)

print(response.choices[0].message.content)`;

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-5 mb-8 bg-gradient-to-r from-blue-500/10 to-transparent p-6 rounded-2xl border border-blue-500/10"
      >
        <div className="p-3.5 bg-blue-500 text-white rounded-xl shadow-lg shadow-blue-500/30 flex-shrink-0 w-fit">
          <BookOpen className="w-8 h-8" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">KroomBridge API Documentation</h2>
          <p className="text-[15px] text-slate-600 dark:text-slate-400 mt-1.5 font-medium leading-relaxed">
            Panduan lengkap integrasi API Gateway. Anda dapat membagikan halaman ini atau mengirimkan instruksi di bawah kepada klien Anda agar mereka bisa langsung terhubung menggunakan API Key.
          </p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-6"
      >
        {/* Section 1: Konsep Autentikasi */}
        <div className="p-6 md:p-8 bg-white dark:bg-[#11141A] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-5">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Key className="w-5 h-5" />
            </div>
            1. Sistem Keamanan (API Key)
          </h3>
          <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed mb-6">
            KroomBridge menggunakan sistem keamanan berbasis <strong>API Key</strong> yang 100% kompatibel dengan aplikasi pihak ketiga mana pun (seperti OpenAI atau OpenRouter). 
            Setiap klien Anda memiliki <strong>API Key</strong> mereka sendiri yang bisa digunakan secara langsung sebagai otorisasi.
          </p>
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-5">
            <p className="font-bold text-amber-900 dark:text-amber-400 mb-3 flex items-center gap-2">
              Cara Mendapatkan API Key:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-[14px] text-amber-800 dark:text-amber-200/90 font-medium">
              <li>Masuk ke menu <strong>Manajemen Pengguna (Clients & Access)</strong> di Dashboard.</li>
              <li>Salin nilai <strong className="text-amber-900 dark:text-amber-300">API Key</strong> milik klien yang bersangkutan (misal: <code>sk_b878...</code>).</li>
              <li>Berikan API Key tersebut kepada Klien untuk digunakan sebagai kredensial <em>Bearer Token</em> mereka (misalnya di OpenRouter, SillyTavern, dll).</li>
            </ol>
          </div>
        </div>

        {/* Section 2: Menggunakan AI */}
        <div className="p-6 md:p-8 bg-white dark:bg-[#11141A] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-5">
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <Terminal className="w-5 h-5" />
            </div>
            2. Contoh Integrasi (cURL & Python)
          </h3>
          <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed mb-4">
            Struktur request dan respons KroomBridge dirancang <strong>100% kompatibel</strong> dengan API OpenAI, sehingga Anda bisa langsung menggunakan pustaka bawaan <em>OpenAI SDK</em> dengan memasukkan API Key ke dalam kolom <code>api_key</code>.
          </p>

          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 rounded-xl p-4 mb-6">
            <p className="text-emerald-800 dark:text-emerald-300 text-[14px] font-medium leading-relaxed">
              <strong>💡 Smart Routing:</strong> KroomBridge secara otomatis akan memproses request inference Anda berdasarkan <strong>nama model</strong> yang diminta. Jika model tersebut berasal dari server Kroma, request akan otomatis diarahkan ke <strong>Kroma AI</strong>. Jika model tersebut merupakan model lokal/LiteLLM, request akan otomatis diteruskan ke <strong>https://9r.kii.lat/</strong>. Anda hanya cukup menggunakan satu Endpoint URL dan API Key yang sama untuk semua!
            </p>
          </div>

          <div className="mt-8">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-3 text-[15px] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              A. Melalui Terminal (cURL)
            </h4>
            <p className="text-[14px] text-slate-600 dark:text-slate-400 mb-2">Buka aplikasi Terminal (MacOS/Linux) atau Command Prompt/PowerShell (Windows), lalu jalankan perintah ini:</p>
            <CodeSnippet code={chatRequestCode} language="bash" />
          </div>

          <div className="mt-8">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-3 text-[15px] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              B. Melalui Postman
            </h4>
            <ol className="list-decimal pl-5 space-y-2 text-[14px] text-slate-700 dark:text-slate-300">
              <li>Buka aplikasi Postman, buat Request baru lalu ubah method menjadi <strong>POST</strong>.</li>
              <li>Masukkan URL: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-sky-600 dark:text-sky-400">{baseUrl}/v1/chat/completions</code></li>
              <li>Buka tab <strong>Headers</strong>, tambahkan Key: <code>Authorization</code> dengan Value: <code>Bearer &lt;API_KEY_ANDA&gt;</code>.</li>
              <li>Buka tab <strong>Body</strong>, pilih opsi <strong>raw</strong> lalu ganti text menjadi <strong>JSON</strong>.</li>
              <li>Paste JSON payload berikut ke dalamnya, lalu klik <strong>Send</strong>:</li>
            </ol>
            <CodeSnippet code={`{
  "model": "qwen3.5-9b-ultra-uncensored-heretic-v2",
  "messages": [
    { "role": "system", "content": "Anda adalah asisten AI yang cerdas." },
    { "role": "user", "content": "Halo! Tolong buatkan saya pantun jenaka." }
  ],
  "stream": false
}`} language="json" />
          </div>

          <div className="mt-8">
            <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-3 text-[15px] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              C. Menggunakan Python (OpenAI SDK)
            </h4>
            <CodeSnippet code={pythonSdkCode} language="python" />
          </div>
        </div>

        {/* Section 3: Integrasi di Aplikasi Pihak Ketiga */}
        <div className="p-6 md:p-8 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-[#11141A] dark:to-sky-950/10 rounded-2xl border border-sky-100 dark:border-sky-900/30 shadow-sm relative overflow-hidden">
          
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none -mr-10 -mt-10">
            <Blocks className="w-64 h-64 text-sky-500" />
          </div>

          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-5 relative z-10">
            <div className="p-2 bg-sky-500 text-white rounded-lg shadow-md shadow-sky-500/20">
              <Code className="w-5 h-5" />
            </div>
            3. Pemakaian di Aplikasi UI Pihak Ketiga
          </h3>
          <p className="text-slate-700 dark:text-slate-300 text-[15px] leading-relaxed mb-6 relative z-10">
            Jika Klien Anda tidak memprogram aplikasinya sendiri, melainkan menggunakan antarmuka AI (Chat UI) yang sudah jadi, KroomBridge <strong>sangat mendukung</strong> integrasi tersebut secara *plug-and-play*.
          </p>
          
          <div className="bg-white/60 dark:bg-black/20 backdrop-blur-sm rounded-xl p-5 border border-sky-200/50 dark:border-sky-800/30 mb-6 relative z-10">
            <p className="font-semibold text-sky-900 dark:text-sky-300 mb-3 text-sm uppercase tracking-wider">Aplikasi yang Kompatibel (Diuji & Didukung):</p>
            <div className="flex flex-wrap gap-2">
              {['OpenRouter', 'SillyTavern', 'Jan', 'LMStudio', 'Open WebUI', 'AnythingLLM', 'Dify', 'Chatbox', 'NextChat', 'Hermes', '9router'].map(tool => (
                <span key={tool} className="px-3 py-1 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 rounded-full text-[13px] font-medium border border-sky-200 dark:border-sky-800/50">
                  {tool}
                </span>
              ))}
            </div>
          </div>

          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-4 relative z-10">Langkah Konfigurasi di Aplikasi (Custom Endpoint):</p>
          <ul className="space-y-5 relative z-10">
            <li className="flex gap-4 items-start">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-200 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 font-bold text-sm shrink-0 shadow-sm border border-sky-300/50 dark:border-sky-700/50">1</span>
              <div className="w-full">
                <p className="text-slate-700 dark:text-slate-300 text-[14.5px] font-bold">Pilih "OpenAI Compatible" atau "Custom Provider"</p>
                <p className="text-slate-600 dark:text-slate-400 text-[13.5px] mt-1">Saat menambahkan koneksi API di aplikasi klien, pilih tipe <strong>OpenAI Compatible</strong> karena KroomBridge 100% mengikuti standar format OpenAI.</p>
              </div>
            </li>
            <li className="flex gap-4 items-start">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-200 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 font-bold text-sm shrink-0 shadow-sm border border-sky-300/50 dark:border-sky-700/50">2</span>
              <div className="w-full">
                <p className="text-slate-700 dark:text-slate-300 text-[14.5px] font-bold">Ubah Pengaturan "Base URL"</p>
                <p className="text-slate-600 dark:text-slate-400 text-[13.5px] mt-1">Hapus URL bawaan OpenAI (seperti <code>https://api.openai.com/v1</code>) dan ganti menjadi Base URL KroomBridge Anda:</p>
                <div className="mt-2.5 bg-white dark:bg-[#0B0E14] px-4 py-2.5 rounded-lg border border-sky-200 dark:border-sky-800/60 shadow-inner flex items-center justify-between group">
                  <code className="text-sky-600 dark:text-sky-400 font-mono text-[14px] select-all break-all">
                    {baseUrl}/v1
                  </code>
                </div>
              </div>
            </li>
            <li className="flex gap-4 items-start">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-200 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 font-bold text-sm shrink-0 shadow-sm border border-sky-300/50 dark:border-sky-700/50">3</span>
              <div>
                <p className="text-slate-700 dark:text-slate-300 text-[14.5px] font-bold">Masukkan "API Key"</p>
                <p className="text-slate-600 dark:text-slate-400 text-[13.5px] mt-1">Tempelkan <strong>API Key</strong> milik Klien dari dashboard KroomBridge ke dalam kolom <code>API Key (for Check)</code> di aplikasi.</p>
              </div>
            </li>
            <li className="flex gap-4 items-start">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-200 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 font-bold text-sm shrink-0 shadow-sm border border-sky-300/50 dark:border-sky-700/50">4</span>
              <div>
                <p className="text-slate-700 dark:text-slate-300 text-[14.5px] font-bold">Isi "Model ID" (Opsional)</p>
                <p className="text-slate-600 dark:text-slate-400 text-[13.5px] mt-1">Jika diminta, masukkan nama model yang Anda dukung (contoh: <code>qwen3.6-27b...</code>) agar aplikasi bisa melakukan validasi tes koneksi.</p>
              </div>
            </li>
            <li className="flex gap-4 items-center mt-6">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-200 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-sm shrink-0 shadow-sm border border-emerald-300/50 dark:border-emerald-700/50">
                <Check className="w-4 h-4" />
              </span>
              <p className="text-slate-800 dark:text-slate-200 text-[15px] font-bold">Aplikasi pihak ketiga siap digunakan dengan server Anda!</p>
            </li>
          </ul>
        </div>
      </motion.div>
    </div>
  );
}
