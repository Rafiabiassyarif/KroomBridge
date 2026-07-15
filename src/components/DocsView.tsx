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
  const [baseUrl, setBaseUrl] = useState("http://localhost:3000");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const tokenRequestCode = `curl -X POST ${baseUrl}/api/auth/token \\
  -H "Content-Type: application/json" \\
  -d '{
    "clientId": "ID_KLIEN_ANDA",
    "clientSecret": "SECRET_KEY_ANDA"
  }'`;

  const tokenResponseCode = `{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5...",
  "expiresIn": "never"
}`;

  const chatRequestCode = `curl -X POST ${baseUrl}/gateway/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <ACCESS_TOKEN_JWT>" \\
  -d '{
    "model": "pc-putih/lmstudio/qwen3.6-27b-uncensored-hauhaucs-aggressive",
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
    base_url="${baseUrl}/gateway/v1",
    api_key="<ACCESS_TOKEN_JWT>"  # Token yang didapat dari langkah 2
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
            Panduan lengkap integrasi API Gateway. Anda dapat membagikan halaman ini atau mengirimkan instruksi di bawah kepada klien Anda agar mereka bisa langsung terhubung.
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
            1. Sistem Keamanan (Token-Based)
          </h3>
          <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed mb-6">
            KroomBridge dirancang dengan keamanan tingkat tinggi bergaya OAuth2. Klien <strong>dilarang keras</strong> mengirimkan <em>Secret Key</em> secara langsung ke endpoint AI demi menghindari kebocoran data. Sebagai gantinya, klien harus melakukan proses otentikasi dua langkah:
          </p>
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-5">
            <p className="font-bold text-amber-900 dark:text-amber-400 mb-3 flex items-center gap-2">
              Alur Integrasi Wajib:
            </p>
            <ol className="list-decimal pl-5 space-y-2 text-[14px] text-amber-800 dark:text-amber-200/90 font-medium">
              <li>Tukarkan <strong className="text-amber-900 dark:text-amber-300">ID Klien</strong> & <strong className="text-amber-900 dark:text-amber-300">Secret Key</strong> untuk mendapatkan tiket akses berupa <strong>Access Token (JWT)</strong>.</li>
              <li>Gunakan <strong>Access Token</strong> tersebut sebagai kredensial <em>Bearer</em> utama untuk semua request ke endpoint AI.</li>
            </ol>
          </div>
        </div>

        {/* Section 2: Mendapatkan Token */}
        <div className="p-6 md:p-8 bg-white dark:bg-[#11141A] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-5">
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <Server className="w-5 h-5" />
            </div>
            2. Mendapatkan Access Token (JWT)
          </h3>
          <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed mb-4">
            Lakukan HTTP POST ke endpoint <code>/api/auth/token</code> menggunakan kredensial yang didapatkan dari menu <strong>Clients</strong> di Dashboard. Proses ini cukup dilakukan satu kali jika token diatur menjadi <em>never expire</em>.
          </p>
          
          <CodeSnippet code={tokenRequestCode} language="bash" />
          
          <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed mt-6 mb-2 font-medium">
            Contoh Response Sukses:
          </p>
          <CodeSnippet code={tokenResponseCode} language="json" />
        </div>

        {/* Section 3: Menggunakan AI */}
        <div className="p-6 md:p-8 bg-white dark:bg-[#11141A] rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all hover:shadow-md">
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-5">
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <Terminal className="w-5 h-5" />
            </div>
            3. Contoh Integrasi (cURL & Python)
          </h3>
          <p className="text-slate-600 dark:text-slate-300 text-[15px] leading-relaxed mb-4">
            Gunakan <code>accessToken</code> dari langkah 2 untuk berinteraksi dengan AI. Struktur request dan respons KroomBridge dirancang <strong>100% kompatibel</strong> dengan API OpenAI, sehingga Anda bisa menggunakan pustaka bawaan <em>OpenAI SDK</em>.
          </p>

          <p className="font-semibold text-slate-700 dark:text-slate-300 mt-6 mb-2">Menggunakan cURL (Terminal / Postman):</p>
          <CodeSnippet code={chatRequestCode} language="bash" />

          <p className="font-semibold text-slate-700 dark:text-slate-300 mt-8 mb-2">Menggunakan Python (OpenAI SDK):</p>
          <CodeSnippet code={pythonSdkCode} language="python" />
        </div>

        {/* Section 4: Integrasi di Aplikasi Pihak Ketiga */}
        <div className="p-6 md:p-8 bg-gradient-to-br from-sky-50 to-blue-50 dark:from-[#11141A] dark:to-sky-950/10 rounded-2xl border border-sky-100 dark:border-sky-900/30 shadow-sm relative overflow-hidden">
          
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none -mr-10 -mt-10">
            <Blocks className="w-64 h-64 text-sky-500" />
          </div>

          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3 mb-5 relative z-10">
            <div className="p-2 bg-sky-500 text-white rounded-lg shadow-md shadow-sky-500/20">
              <Code className="w-5 h-5" />
            </div>
            4. Pemakaian di Aplikasi UI Pihak Ketiga
          </h3>
          <p className="text-slate-700 dark:text-slate-300 text-[15px] leading-relaxed mb-6 relative z-10">
            Jika Klien Anda tidak memprogram aplikasinya sendiri, melainkan menggunakan antarmuka AI (Chat UI) yang sudah jadi, KroomBridge <strong>sangat mendukung</strong> integrasi tersebut secara *plug-and-play*.
          </p>
          
          <div className="bg-white/60 dark:bg-black/20 backdrop-blur-sm rounded-xl p-5 border border-sky-200/50 dark:border-sky-800/30 mb-6 relative z-10">
            <p className="font-semibold text-sky-900 dark:text-sky-300 mb-3 text-sm uppercase tracking-wider">Aplikasi yang Kompatibel (Diuji & Didukung):</p>
            <div className="flex flex-wrap gap-2">
              {['SillyTavern', 'Jan', 'LMStudio', 'Open WebUI', 'AnythingLLM', 'Dify', 'Chatbox', 'NextChat'].map(tool => (
                <span key={tool} className="px-3 py-1 bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 rounded-full text-[13px] font-medium border border-sky-200 dark:border-sky-800/50">
                  {tool}
                </span>
              ))}
            </div>
          </div>

          <p className="font-semibold text-slate-800 dark:text-slate-200 mb-4 relative z-10">Langkah Konfigurasi Aplikasi:</p>
          <ul className="space-y-5 relative z-10">
            <li className="flex gap-4 items-start">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-200 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 font-bold text-sm shrink-0 shadow-sm border border-sky-300/50 dark:border-sky-700/50">1</span>
              <div>
                <p className="text-slate-700 dark:text-slate-300 text-[14.5px] font-medium">Dapatkan JWT Access Token</p>
                <p className="text-slate-600 dark:text-slate-400 text-[13.5px] mt-1">Gunakan cURL/Postman di Langkah 2 untuk mendapatkan token secara manual satu kali saja.</p>
              </div>
            </li>
            <li className="flex gap-4 items-start">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-200 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 font-bold text-sm shrink-0 shadow-sm border border-sky-300/50 dark:border-sky-700/50">2</span>
              <div className="w-full">
                <p className="text-slate-700 dark:text-slate-300 text-[14.5px] font-medium">Ubah Pengaturan OpenAI Base URL</p>
                <p className="text-slate-600 dark:text-slate-400 text-[13.5px] mt-1">Di dalam setting aplikasi pihak ketiga, ubah URL bawaan OpenAI (Custom Endpoint) menjadi:</p>
                <div className="mt-2.5 bg-white dark:bg-[#0B0E14] px-4 py-2.5 rounded-lg border border-sky-200 dark:border-sky-800/60 shadow-inner flex items-center justify-between group">
                  <code className="text-sky-600 dark:text-sky-400 font-mono text-[14px] select-all break-all">
                    {baseUrl}/gateway/v1
                  </code>
                </div>
              </div>
            </li>
            <li className="flex gap-4 items-start">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-sky-200 dark:bg-sky-500/20 text-sky-700 dark:text-sky-400 font-bold text-sm shrink-0 shadow-sm border border-sky-300/50 dark:border-sky-700/50">3</span>
              <div>
                <p className="text-slate-700 dark:text-slate-300 text-[14.5px] font-medium">Masukkan API Key</p>
                <p className="text-slate-600 dark:text-slate-400 text-[13.5px] mt-1">Tempelkan <strong>JWT Access Token</strong> dari langkah pertama ke dalam kolom pengisian OpenAI API Key.</p>
              </div>
            </li>
            <li className="flex gap-4 items-center">
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
