import React from "react";
import {
  Server,
  Shield,
  Key,
  Activity,
  Layers,
  Terminal,
  Globe,
  AlertTriangle,
  ArrowRight,
  Lock,
  Package,
  Zap,
  GitBranch,
  Database,
  ShieldCheck,
  Cpu,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { motion } from "motion/react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
} as const;

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
} as const;

const drawLineVariants = {
  hidden: { width: 0, opacity: 0 },
  visible: {
    width: "100%",
    opacity: 1,
    transition: { duration: 1, ease: "easeOut", delay: 0.5 },
  },
} as const;

export default function ArchitectureView() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-16 pb-16 max-w-7xl mx-auto"
    >
      {/* Hero Section */}
      <motion.div
        variants={itemVariants}
        className="text-center space-y-6 relative"
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-blue-100/50 dark:bg-blue-900/20 rounded-full blur-[100px] -z-10"></div>
        <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-50 dark:from-blue-900/40 to-indigo-50 dark:to-indigo-900/40 border border-blue-100 dark:border-blue-800/50 text-blue-700 dark:text-blue-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow-sm">
          <Layers className="w-4 h-4" />
          <span>System Blueprint</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-slate-900 dark:from-white via-slate-800 dark:via-slate-200 to-slate-900 dark:to-slate-300 bg-clip-text text-transparent tracking-tight leading-tight">
          Arsitektur KroomBridge API Gateway
        </h1>
        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-3xl mx-auto font-medium leading-relaxed">
          Representasi komprehensif dari ekosistem API Gateway terpusat yang
          menggabungkan seluruh layanan hulu (upstream) ke dalam satu titik
          akses yang aman, cepat, dan terukur.
        </p>
      </motion.div>

      {/* Visual Flow Diagram */}
      <motion.div
        variants={cardVariants}
        className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 relative overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-800"
      >
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none"></div>

        <h2 className="text-2xl font-black text-white mb-12 text-center flex items-center justify-center tracking-tight">
          <RefreshCw className="w-6 h-6 mr-3 text-blue-400" />
          Alur Permintaan Integrasi (Request Workflow)
        </h2>

        <div className="flex flex-col lg:flex-row items-center justify-between gap-6 relative z-10 w-full max-w-5xl mx-auto">
          {/* Connecting Lines for Desktop */}
          <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-800 -translate-y-1/2 hidden lg:block -z-10">
            <motion.div
              variants={drawLineVariants}
              className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500"
            ></motion.div>
          </div>

          {/* 1. Client Layer */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-slate-800/80 backdrop-blur-md border border-slate-700 p-6 rounded-3xl w-full lg:w-64 text-center shadow-xl relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-16 h-16 bg-slate-900/50 rounded-2xl mx-auto mb-4 flex items-center justify-center border border-slate-700 shadow-inner">
              <Terminal className="w-8 h-8 text-indigo-400" />
            </div>
            <h3 className="font-black text-slate-100 text-lg mb-1 tracking-tight">
              Client Apps
            </h3>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">
              Web, Mobile, Server, IoT
            </p>
          </motion.div>

          <ArrowRight className="w-6 h-6 text-slate-600 rotate-90 lg:rotate-0 hidden lg:block bg-slate-900 rounded-full" />

          {/* 2. Edge Security */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-slate-800/80 backdrop-blur-md border border-slate-700 p-6 rounded-3xl w-full lg:w-64 text-center shadow-xl relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-rose-500/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-16 h-16 bg-slate-900/50 rounded-2xl mx-auto mb-4 flex items-center justify-center border border-slate-700 shadow-inner">
              <ShieldAlert className="w-8 h-8 text-rose-400" />
            </div>
            <h3 className="font-black text-slate-100 text-lg mb-4 tracking-tight">
              Edge Security
            </h3>
            <div className="text-[11px] font-medium text-slate-400 space-y-2 mt-2 text-left bg-slate-900/50 p-3 rounded-xl border border-slate-800/50 shadow-inner">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500/50"></span>{" "}
                DDoS Mitigation
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500/50"></span>{" "}
                IP Allow/Denylist
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500/50"></span>{" "}
                SSL Termination
              </div>
            </div>
          </motion.div>

          <ArrowRight className="w-6 h-6 text-slate-600 rotate-90 lg:rotate-0 hidden lg:block bg-slate-900 rounded-full" />

          {/* 3. API Gateway Core */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-blue-900/40 backdrop-blur-md border border-blue-500/30 p-6 rounded-3xl w-full lg:w-72 text-center shadow-[0_0_40px_rgba(59,130,246,0.15)] relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/20 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-20 h-20 bg-blue-950/50 rounded-2xl mx-auto mb-4 flex items-center justify-center border border-blue-500/30 shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-blue-400/20 animate-pulse"></div>
              <Cpu className="w-10 h-10 text-blue-400 relative z-10" />
            </div>
            <h3 className="font-black text-white text-xl mb-4 tracking-tight">
              Gateway Core
            </h3>
            <div className="text-xs font-bold text-blue-200/90 mt-2 space-y-2 text-left bg-blue-950/60 p-4 rounded-2xl border border-blue-900/50 shadow-inner">
              <div className="flex items-center gap-2">
                <span className="text-blue-400">•</span>{" "}
                <span className="text-blue-300 w-16">Auth:</span> JWT Validasi
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">•</span>{" "}
                <span className="text-blue-300 w-16">Quota:</span> Redis Limits
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">•</span>{" "}
                <span className="text-blue-300 w-16">Route:</span> Load Balancer
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">•</span>{" "}
                <span className="text-blue-300 w-16">Cache:</span> Optimasasi
              </div>
            </div>
          </motion.div>

          <ArrowRight className="w-6 h-6 text-slate-600 rotate-90 lg:rotate-0 hidden lg:block bg-slate-900 rounded-full" />

          {/* 4. Upstream Services */}
          <div className="flex flex-col gap-3 w-full lg:w-64">
            <motion.div
              whileHover={{ scale: 1.02, x: 5 }}
              className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 px-5 py-4 rounded-2xl flex items-center justify-between shadow-lg group hover:border-emerald-500/50 transition-colors"
            >
              <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                WA API
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02, x: 5 }}
              className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 px-5 py-4 rounded-2xl flex items-center justify-between shadow-lg group hover:border-emerald-500/50 transition-colors"
            >
              <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                AI Chat API
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.02, x: 5 }}
              className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 px-5 py-4 rounded-2xl flex items-center justify-between shadow-lg group hover:border-emerald-500/50 transition-colors"
            >
              <span className="text-sm font-bold text-slate-200 group-hover:text-white transition-colors">
                AI Image API
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></span>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Feature Bento Grid */}
      <motion.div
        variants={containerVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8"
      >
        {/* Auth & RBAC */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group cursor-default"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/20 rounded-full blur-3xl -mr-10 -mt-10 opacity-70 group-hover:scale-125 transition-transform duration-700"></div>
          <div className="bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-100/50 dark:border-indigo-800/50 w-14 h-14 flex items-center justify-center rounded-2xl mb-6 shadow-inner">
            <Lock className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
            Autentikasi & Otorisasi
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Penerapan JWT Access Token dengan verifikasi kunci rahasia.
            Mendukung akses kontrol berbasis paket langganan (RBAC) untuk 
            membatasi klien hanya pada endpoint hulu tertentu saja.
          </p>
        </motion.div>

        {/* Quota & Packages */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group cursor-default"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 dark:bg-amber-900/20 rounded-full blur-3xl -mr-10 -mt-10 opacity-70 group-hover:scale-125 transition-transform duration-700"></div>
          <div className="bg-amber-50 dark:bg-amber-900/40 border border-amber-100/50 dark:border-amber-800/50 w-14 h-14 flex items-center justify-center rounded-2xl mb-6 shadow-inner">
            <Package className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
            Manajemen Paket & Kuota
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Sistem Rate Limiter in-memory untuk membatasi request per menit.
            Dilengkapi pelacakan kuota bulanan, penghitungan token (khusus AI), 
            dan opsi Custom Quota individual untuk klien tertentu.
          </p>
        </motion.div>

        {/* Advanced Security */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group cursor-default"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 dark:bg-rose-900/20 rounded-full blur-3xl -mr-10 -mt-10 opacity-70 group-hover:scale-125 transition-transform duration-700"></div>
          <div className="bg-rose-50 dark:bg-rose-900/40 border border-rose-100/50 dark:border-rose-800/50 w-14 h-14 flex items-center justify-center rounded-2xl mb-6 shadow-inner">
            <ShieldCheck className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
            Keamanan Lanjutan
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Dibentengi fitur IP Allowlist/Denylist, Anomaly Detection untuk mencegah 
            brute-force (&gt;20 req/detik), serta Perisai Validasi Upstream yang menolak 
            payload raksasa secara otomatis.
          </p>
        </motion.div>

        {/* Dynamic Proxying */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group cursor-default"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50 dark:bg-cyan-900/20 rounded-full blur-3xl -mr-10 -mt-10 opacity-70 group-hover:scale-125 transition-transform duration-700"></div>
          <div className="bg-cyan-50 dark:bg-cyan-900/40 border border-cyan-100/50 dark:border-cyan-800/50 w-14 h-14 flex items-center justify-center rounded-2xl mb-6 shadow-inner">
            <Globe className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
          </div>
          <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
            Dynamic Route Proxying
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Konfigurasi rute secara dinamis dengan pencocokan jalur paling spesifik.
            Mendukung injeksi custom header dan transformasi pemetaan field Body 
            (Request & Response) secara on-the-fly.
          </p>
        </motion.div>

        {/* Monitoring & Logging */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group cursor-default"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-900/20 rounded-full blur-3xl -mr-10 -mt-10 opacity-70 group-hover:scale-125 transition-transform duration-700"></div>
          <div className="bg-blue-50 dark:bg-blue-900/40 border border-blue-100/50 dark:border-blue-800/50 w-14 h-14 flex items-center justify-center rounded-2xl mb-6 shadow-inner">
            <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
            Observabilitas Real-time
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Pencatatan log API komprehensif (durasi, error, IP, Endpoint). Dashboard 
            dilengkapi dengan teknologi Server-Sent Events (SSE) yang memunculkan log 
            baru seketika tanpa perlu me-refresh halaman.
          </p>
        </motion.div>

        {/* Developer Experience */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group cursor-default"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-50 dark:bg-purple-900/20 rounded-full blur-3xl -mr-10 -mt-10 opacity-70 group-hover:scale-125 transition-transform duration-700"></div>
          <div className="bg-purple-50 dark:bg-purple-900/40 border border-purple-100/50 dark:border-purple-800/50 w-14 h-14 flex items-center justify-center rounded-2xl mb-6 shadow-inner">
            <Terminal className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
            Developer API Tester
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Bawaan Postman-like sandbox langsung di dalam Dashboard. Admin dapat 
            menguji API dengan mudah, mengelola Header, melihat output JSON 
            ter-highlight, dan riwayat request dengan bypass CORS.
          </p>
        </motion.div>

        {/* Server Poller */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group cursor-default"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 dark:bg-emerald-900/20 rounded-full blur-3xl -mr-10 -mt-10 opacity-70 group-hover:scale-125 transition-transform duration-700"></div>
          <div className="bg-emerald-50 dark:bg-emerald-900/40 border border-emerald-100/50 dark:border-emerald-800/50 w-14 h-14 flex items-center justify-center rounded-2xl mb-6 shadow-inner">
            <Server className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
            Hardware & SSH Monitoring
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Daemon pemantau berjalan otomatis di background untuk mengecek ketersediaan 
            server lokal ber-GPU (pc-hitam & pc-putih) via koneksi SSH secara real-time, 
            menampilkan status online/offline di Dashboard.
          </p>
        </motion.div>

        {/* Auto Reset Schedules */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group cursor-default"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-50 dark:bg-teal-900/20 rounded-full blur-3xl -mr-10 -mt-10 opacity-70 group-hover:scale-125 transition-transform duration-700"></div>
          <div className="bg-teal-50 dark:bg-teal-900/40 border border-teal-100/50 dark:border-teal-800/50 w-14 h-14 flex items-center justify-center rounded-2xl mb-6 shadow-inner">
            <RefreshCw className="w-6 h-6 text-teal-600 dark:text-teal-400" />
          </div>
          <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
            Automasi Penjadwalan Kuota
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Sistem reset kuota tangguh (Catch-up mechanism) yang mendukung 3 mode:
            Awal Bulan serentak, Tahunan spesifik, dan mode "Tanggal Pembelian" 
            individual yang sangat presisi untuk penagihan klien.
          </p>
        </motion.div>

        {/* Data Persistence */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -5 }}
          className="bg-white dark:bg-slate-900/50 rounded-3xl p-8 border border-slate-100 dark:border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] relative overflow-hidden group cursor-default"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 dark:bg-orange-900/20 rounded-full blur-3xl -mr-10 -mt-10 opacity-70 group-hover:scale-125 transition-transform duration-700"></div>
          <div className="bg-orange-50 dark:bg-orange-900/40 border border-orange-100/50 dark:border-orange-800/50 w-14 h-14 flex items-center justify-center rounded-2xl mb-6 shadow-inner">
            <Database className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="font-black text-xl text-slate-800 dark:text-slate-100 mb-3 tracking-tight">
            MySQL Database
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
            Operasional super cepat menggunakan caching in-memory penuh untuk setiap 
            request, yang disinkronkan secara asinkron ke database MySQL. Data aman, 
            konsisten, dan siap untuk skalabilitas tinggi.
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
