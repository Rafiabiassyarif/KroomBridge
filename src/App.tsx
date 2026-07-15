/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Network,
  Users,
  Package as PackageIcon,
  Settings,
  LayoutDashboard,
  ShieldCheck,
  TerminalSquare,
  Layers,
  Search,
  Command,
  Activity as APIStatusIcon,
  Moon,
  Sun,
  Combine,
  Cpu,
  Sparkles,
  LogOut,
  Menu,
  X,
  Key,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import ClientsView from "./components/ClientsView";
import PackagesView from "./components/PackagesView";
import RoutesView from "./components/RoutesView";
import DashboardView from "./components/DashboardView";
import SecurityView from "./components/SecurityView";
import SettingsView from "./components/SettingsView";
import ApiKeyView from "./components/ApiKeyView";
import ArchitectureView from "./components/ArchitectureView";
import LoginView from "./components/LoginView";
import ApiTester from "./components/ApiTester";
import SearchPalette from "./components/SearchPalette";
import ModelsView from "./components/ModelsView";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Global Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      // Escape tutup sidebar mobile
      if (e.key === "Escape") {
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem("kroombridge_admin_token");
    const userData = sessionStorage.getItem("kroombridge_admin_user");

    const handleUnauthorized = () => {
      sessionStorage.removeItem("kroombridge_admin_token");
      sessionStorage.removeItem("kroombridge_admin_user");
      setUser(null);
      setIsLoggedIn(false);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);

    if (token && userData) {
      fetch("/api/admin/validate-token", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) {
            try {
              setUser(JSON.parse(userData));
              setIsLoggedIn(true);
            } catch (e) {
              handleUnauthorized();
            }
          } else {
            handleUnauthorized();
          }
        })
        .catch(() => {
          handleUnauthorized();
        });
    }

    return () =>
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  // Tutup sidebar mobile saat tab berubah
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileSidebarOpen(false);
  };

  if (!isLoggedIn) {
    return (
      <LoginView
        onLogin={(userData) => {
          setUser(userData);
          setIsLoggedIn(true);
          setActiveTab("dashboard");
        }}
      />
    );
  }

  const handleLogout = () => {
    sessionStorage.removeItem("kroombridge_admin_token");
    sessionStorage.removeItem("kroombridge_admin_user");
    setUser(null);
    setIsLoggedIn(false);
  };

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "clients", label: "Clients & Access", icon: Users },
    { id: "packages", label: "API Packages", icon: PackageIcon },
    { id: "routes", label: "Model API", icon: Cpu },
    { id: "models", label: "Model AI", icon: Sparkles },
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "tester", label: "API Tester", icon: TerminalSquare },
    { id: "architecture", label: "Architecture", icon: Layers },
    { id: "apikeys", label: "API Keys", icon: Key },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  // ─── Shared Sidebar Content ────────────────────────────
  const SidebarContent = () => (
    <>
      {/* Animated background highlights */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.15, 0.1],
          }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute -top-24 -left-24 w-64 h-64 bg-sky-500/20 rounded-full blur-[80px]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-sky-50/20 dark:from-sky-500/[0.03] via-transparent to-transparent"></div>
      </div>

      {/* Logo */}
      <div className="px-7 py-7 flex items-center space-x-3.5 border-b border-zinc-100 dark:border-zinc-800/50 relative z-10">
        <img src="/logo.png" alt="KroomBridge" className="h-10 object-contain" />
        <div className="flex flex-col">
          <span className="font-bold text-[15px] tracking-tight text-zinc-900 dark:text-white leading-none">
            KroomBridge
          </span>
          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 tracking-wide mt-0.5">
            API Gateway Console
          </span>
        </div>
        {/* Close button — hanya di mobile */}
        <button
          onClick={() => setIsMobileSidebarOpen(false)}
          className="lg:hidden ml-auto w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <div className="px-4 py-4 relative z-10 flex-1 overflow-y-auto hidden-scrollbar">
        <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.2em] mb-4 px-4 opacity-60">
          Navigation
        </p>
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={cn(
                  "w-full flex items-center space-x-3.5 px-4 py-3 rounded-2xl text-[13.5px] font-semibold transition-all duration-300 relative group outline-none",
                  isActive
                    ? "bg-sky-500/10 text-sky-600 dark:text-sky-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-sky-500/20"
                    : "text-zinc-500 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-200 hover:bg-sky-500/[0.04] dark:hover:bg-white/[0.03]",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeGlow"
                    className="absolute inset-0 bg-sky-500/[0.08] dark:bg-sky-500/[0.12] rounded-2xl blur-md -z-10"
                  />
                )}
                <Icon
                  className={cn(
                    "w-[19px] h-[19px] transition-all duration-300 shrink-0",
                    isActive
                      ? "text-sky-500 dark:text-sky-400 scale-110 drop-shadow-[0_0_8px_rgba(14,165,233,0.5)]"
                      : "text-zinc-400 dark:text-zinc-500 group-hover:text-sky-500 dark:group-hover:text-sky-300 group-hover:scale-110",
                  )}
                />
                <span className="tracking-tight">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute right-4 w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-400 shadow-[0_0_8px_#0ea5e9]"
                    transition={{
                      type: "spring",
                      stiffness: 380,
                      damping: 30,
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="p-5 relative z-10 mt-auto space-y-4">
        <div className="rounded-2xl p-4 border border-zinc-100 dark:border-white/[0.05] bg-zinc-50/50 dark:bg-white/[0.02] cursor-default group/status">
          <div className="flex items-center space-x-3">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_#10b981]"></span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-zinc-700 dark:text-zinc-200 font-bold tracking-tight">
                Gateway Operational
              </span>
              <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
                v1.0.0 · Stable Cloud
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center space-x-2.5 text-[13px] font-bold w-full py-3 rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-950/10 transition-all duration-300"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out Account</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] flex font-sans transition-colors duration-700 text-zinc-800 dark:text-zinc-200">

      {/* ── MOBILE: Overlay backdrop ── */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setIsMobileSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ── MOBILE: Drawer Sidebar ── */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.aside
            key="mobile-sidebar"
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed left-0 top-0 h-full w-[280px] bg-white dark:bg-[#0B0E14] border-r border-zinc-100 dark:border-white/[0.04] flex flex-col z-40 overflow-hidden shadow-2xl lg:hidden"
          >
            <SidebarContent />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── DESKTOP: Static Sidebar ── */}
      <aside className="hidden lg:flex w-[280px] bg-white dark:bg-[#0B0E14] border-r border-zinc-100 dark:border-white/[0.04] flex-col z-20 relative overflow-hidden transition-colors duration-700 shadow-[20px_0_40px_-20px_rgba(0,0,0,0.1)] dark:shadow-none shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative min-w-0">
        {/* Top bar */}
        <header className="h-[60px] lg:h-[64px] border-b border-zinc-100 dark:border-zinc-800/50 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl flex items-center justify-between px-4 lg:px-8 z-10 shrink-0 sticky top-0 transition-colors duration-700 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — hanya mobile */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 transition-all shrink-0"
            >
              <Menu className="w-4.5 h-4.5" />
            </button>
            <h1 className="text-sm lg:text-lg font-semibold text-zinc-800 dark:text-zinc-100 tracking-tight truncate">
              {navItems.find((i) => i.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-2 lg:gap-3 shrink-0">
            {/* Search bar — hanya tablet ke atas */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="relative group hidden md:flex items-center pl-9 pr-3 py-2 border border-zinc-200 dark:border-white/[0.06] rounded-xl text-sm w-40 lg:w-64 bg-zinc-50 dark:bg-white/[0.03] hover:border-sky-400/50 dark:hover:border-sky-500/30 transition-all cursor-pointer"
            >
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 group-hover:text-sky-500 transition-colors" />
              <span className="text-zinc-400 dark:text-zinc-600 flex-1 text-left text-xs lg:text-sm">Search...</span>
              <kbd className="hidden lg:inline ml-2 px-1.5 py-0.5 rounded-md bg-zinc-200/60 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-[10px] font-mono font-bold text-zinc-500 dark:text-zinc-400">⌘K</kbd>
            </button>

            {/* Search icon — hanya mobile */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.06] text-zinc-500 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 transition-all"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] flex items-center justify-center text-zinc-500 dark:text-zinc-400 hover:text-sky-600 dark:hover:text-sky-400 hover:border-sky-500/30 transition-all shadow-sm"
              title={isDarkMode ? "Light Mode" : "Dark Mode"}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Live badge */}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[11px] font-semibold">Live</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8 bg-[#fafafa] dark:bg-[#09090b]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {activeTab === "dashboard" && <DashboardView onNavigate={setActiveTab} />}
              {activeTab === "clients" && <ClientsView />}
              {activeTab === "packages" && <PackagesView />}
              {activeTab === "routes" && <RoutesView />}
              {activeTab === "models" && <ModelsView />}
              { activeTab === "security" && <SecurityView /> }
              { activeTab === "architecture" && <ArchitectureView /> }
              { activeTab === "apikeys" && <ApiKeyView /> }
              { activeTab === "settings" && <SettingsView /> }
            </motion.div>
          </AnimatePresence>

          {/* API Tester selalu di-mount agar state tidak hilang saat pindah menu */}
          <div className={activeTab === "tester" ? "block" : "hidden"}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: activeTab === "tester" ? 1 : 0, y: activeTab === "tester" ? 0 : 8 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <ApiTester />
            </motion.div>
          </div>
        </div>

        {/* ── MOBILE: Bottom Navigation Bar ── */}
        <nav className="lg:hidden shrink-0 border-t border-zinc-100 dark:border-zinc-800/50 bg-white/90 dark:bg-[#0B0E14]/90 backdrop-blur-xl px-2 py-2 flex items-center justify-around safe-area-bottom">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabChange(item.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-0 flex-1",
                  isActive
                    ? "text-sky-500 dark:text-sky-400"
                    : "text-zinc-400 dark:text-zinc-500"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5 transition-all duration-200",
                  isActive && "scale-110 drop-shadow-[0_0_6px_rgba(14,165,233,0.6)]"
                )} />
                <span className="text-[9px] font-semibold truncate w-full text-center leading-none">
                  {item.label.split(" ")[0]}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="bottomActiveTab"
                    className="w-1 h-1 rounded-full bg-sky-500"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
          {/* More button untuk buka sidebar di mobile */}
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-0 flex-1 text-zinc-400 dark:text-zinc-500"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[9px] font-semibold leading-none">More</span>
          </button>
        </nav>
      </main>

      {/* Search Command Palette */}
      <SearchPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onNavigate={(tabId) => {
          setActiveTab(tabId);
          setIsSearchOpen(false);
        }}
      />
    </div>
  );
}
