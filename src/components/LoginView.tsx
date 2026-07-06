import { adminFetch } from "../lib/api";
import React, { useState } from "react";
import { motion } from "motion/react";
import { Lock, Mail, ArrowRight } from "lucide-react";

interface LoginViewProps {
  onLogin: (user: any) => void;
}

export default function LoginView({ onLogin }: LoginViewProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await adminFetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem("kroombridge_admin_token", data.token);
        sessionStorage.setItem(
          "kroombridge_admin_user",
          JSON.stringify(data.user),
        );
        onLogin({ ...data.user, type: "admin" });
      } else {
        setError(data.error || "Login gagal.");
      }
    } catch (err) {
      setError("Terjadi kesalahan sambungan.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] flex items-center justify-center p-4 transition-colors duration-700 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-violet-200/30 dark:bg-violet-900/10 rounded-full blur-[128px]"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-[128px]"></div>
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-rose-100/20 dark:bg-rose-900/5 rounded-full blur-[100px]"></div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[400px] relative z-10"
      >
        <div className="bg-white dark:bg-zinc-900/80 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl shadow-xl shadow-black/[0.03] dark:shadow-black/[0.3] p-8 backdrop-blur-xl">
          {/* Header */}
          <div className="text-center mb-8">
            <img src="/logo.png" alt="KroomBridge" className="w-40 h-40 object-contain mx-auto mb-2" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Sign in to your admin console
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3.5 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900/50 text-center"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 ml-0.5">
                  Email
                </label>
                <div className="relative group">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-violet-500 transition-colors" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 dark:focus:border-violet-500 transition-all outline-none text-sm text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                    placeholder="admin@kroombridge.io"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 ml-0.5">
                  Password
                </label>
                <div className="relative group">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 group-focus-within:text-violet-500 transition-colors" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50 rounded-xl focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 dark:focus:border-violet-500 transition-all outline-none text-sm text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg shadow-violet-500/20 active:scale-[0.98] group outline-none focus:ring-2 focus:ring-violet-500/30 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
            >
              <span>{isLoading ? "Authenticating..." : "Sign In"}</span>
              {!isLoading && (
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              )}
            </button>
          </form>

          <p className="text-center text-[11px] text-zinc-400 dark:text-zinc-600 mt-6">
            KroomBridge Gateway Console v2.0
          </p>
        </div>
      </motion.div>
    </div>
  );
}
