import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  LayoutDashboard,
  Users,
  Package as PackageIcon,
  Combine,
  ShieldCheck,
  TerminalSquare,
  Layers,
  Settings,
  ArrowRight,
  Command,
  CornerDownLeft,
  X,
  User,
  Globe,
  Box,
} from "lucide-react";
import { adminFetch } from "../lib/api";
import { cn } from "../lib/utils";

interface SearchPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tabId: string) => void;
}

interface SearchResult {
  id: string;
  type: "navigation" | "client" | "package" | "route";
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Overview & statistics" },
  { id: "clients", label: "Clients & Access", icon: Users, description: "Manage API clients" },
  { id: "packages", label: "API Packages", icon: PackageIcon, description: "Manage packages & rate limits" },
  { id: "routes", label: "Upstream Routes", icon: Combine, description: "Configure route proxying" },
  { id: "security", label: "Security", icon: ShieldCheck, description: "IP filtering & security rules" },
  { id: "tester", label: "API Tester", icon: TerminalSquare, description: "Test API endpoints" },
  { id: "architecture", label: "Architecture", icon: Layers, description: "System architecture overview" },
  { id: "settings", label: "Settings", icon: Settings, description: "System configuration" },
];

export default function SearchPalette({ isOpen, onClose, onNavigate }: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [cachedData, setCachedData] = useState<{
    clients: any[];
    packages: any[];
    routes: any[];
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch data once when palette opens
  useEffect(() => {
    if (isOpen && !cachedData) {
      setIsLoading(true);
      Promise.all([
        adminFetch("/api/admin/clients").then((r) => r.json()).catch(() => ({ clients: [] })),
        adminFetch("/api/admin/packages").then((r) => r.json()).catch(() => ({ packages: [] })),
        adminFetch("/api/admin/routes").then((r) => r.json()).catch(() => ({ routes: [] })),
      ]).then(([clientsRes, packagesRes, routesRes]) => {
        setCachedData({
          clients: clientsRes.clients || [],
          packages: packagesRes.packages || [],
          routes: routesRes.routes || [],
        });
        setIsLoading(false);
      });
    }
  }, [isOpen, cachedData]);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build search results
  useEffect(() => {
    const q = query.toLowerCase().trim();
    const items: SearchResult[] = [];

    // Navigation results
    NAV_ITEMS.forEach((nav) => {
      if (!q || nav.label.toLowerCase().includes(q) || nav.description?.toLowerCase().includes(q)) {
        items.push({
          id: `nav-${nav.id}`,
          type: "navigation",
          label: nav.label,
          description: nav.description,
          icon: nav.icon,
          action: () => {
            onNavigate(nav.id);
            onClose();
          },
        });
      }
    });

    // Data results (only when there's a query)
    if (q && cachedData) {
      cachedData.clients.forEach((client: any) => {
        const name = client.name || client.clientName || "";
        const id = client.id || client.clientId || "";
        if (name.toLowerCase().includes(q) || id.toLowerCase().includes(q)) {
          items.push({
            id: `client-${id}`,
            type: "client",
            label: name,
            description: `Client · ${id}`,
            icon: User,
            action: () => {
              onNavigate("clients");
              onClose();
            },
          });
        }
      });

      cachedData.packages.forEach((pkg: any) => {
        const name = pkg.name || pkg.packageName || "";
        const id = pkg.id || "";
        if (name.toLowerCase().includes(q) || id.toLowerCase().includes(q)) {
          items.push({
            id: `pkg-${id}`,
            type: "package",
            label: name,
            description: `Package · ${pkg.rateLimit || "–"} req/min`,
            icon: Box,
            action: () => {
              onNavigate("packages");
              onClose();
            },
          });
        }
      });

      cachedData.routes.forEach((route: any) => {
        const path = route.path || route.prefix || "";
        const target = route.target || route.upstream || "";
        if (path.toLowerCase().includes(q) || target.toLowerCase().includes(q)) {
          items.push({
            id: `route-${route.id || path}`,
            type: "route",
            label: path,
            description: `Route → ${target}`,
            icon: Globe,
            action: () => {
              onNavigate("routes");
              onClose();
            },
          });
        }
      });
    }

    setResults(items);
    setSelectedIndex(0);
  }, [query, cachedData, onNavigate, onClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        results[selectedIndex].action();
      } else if (e.key === "Escape") {
        onClose();
      }
    },
    [results, selectedIndex, onClose],
  );

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Close on backdrop click
  if (!isOpen) return null;

  const typeLabel = (type: string) => {
    switch (type) {
      case "navigation": return "Navigate";
      case "client": return "Client";
      case "package": return "Package";
      case "route": return "Route";
      default: return "";
    }
  };

  const typeColor = (type: string) => {
    switch (type) {
      case "navigation": return "text-sky-500 bg-sky-500/10 border-sky-500/20";
      case "client": return "text-violet-500 bg-violet-500/10 border-violet-500/20";
      case "package": return "text-amber-500 bg-amber-500/10 border-amber-500/20";
      case "route": return "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
      default: return "text-zinc-500 bg-zinc-500/10 border-zinc-500/20";
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[560px] bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl shadow-black/20 overflow-hidden"
          >
            {/* Search Input */}
            <div className="flex items-center px-5 border-b border-zinc-100 dark:border-zinc-800">
              <Search className="w-5 h-5 text-zinc-400 dark:text-zinc-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search menu, clients, packages, routes..."
                className="flex-1 px-4 py-4 bg-transparent text-sm text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2 px-2">
              {isLoading && !cachedData ? (
                <div className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                  <div className="w-5 h-5 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin mx-auto mb-3" />
                  Loading data...
                </div>
              ) : results.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                  No results found for "{query}"
                </div>
              ) : (
                results.map((result, index) => {
                  const Icon = result.icon;
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={result.id}
                      onClick={result.action}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl text-left transition-all duration-150 group",
                        isSelected
                          ? "bg-sky-50 dark:bg-sky-500/10"
                          : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                      )}
                    >
                      <div
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-colors",
                          isSelected
                            ? "bg-sky-100 dark:bg-sky-500/20 border-sky-200 dark:border-sky-500/30 text-sky-600 dark:text-sky-400"
                            : "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400",
                        )}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                          {result.label}
                        </div>
                        {result.description && (
                          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                            {result.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wide",
                            typeColor(result.type),
                          )}
                        >
                          {typeLabel(result.type)}
                        </span>
                        {isSelected && (
                          <ArrowRight className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer hints */}
            <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center space-x-4 text-[11px] text-zinc-400 dark:text-zinc-500">
              <div className="flex items-center space-x-1.5">
                <kbd className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono font-bold">↑↓</kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <kbd className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono font-bold">↵</kbd>
                <span>Select</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <kbd className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono font-bold">Esc</kbd>
                <span>Close</span>
              </div>
              <div className="ml-auto flex items-center space-x-1.5">
                <kbd className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono font-bold">Ctrl</kbd>
                <span>+</span>
                <kbd className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-[10px] font-mono font-bold">K</kbd>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
