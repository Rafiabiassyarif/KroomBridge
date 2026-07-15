import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion } from "motion/react";
import {
  AlignLeft,
  Check,
  Clock,
  Code,
  Copy,
  History,
  Key,
  Play,
  Shield,
  Trash2,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Settings2,
  Bookmark,
  TerminalSquare
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAutoRefresh } from "../lib/useAutoRefresh";
import { useSSE } from "../lib/useSSE";
import { adminFetch } from "../lib/api";

import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import EnvironmentsModal, { Environment } from "./ApiTester/EnvironmentsModal";
import CodeSnippetsModal from "./ApiTester/CodeSnippetsModal";
import JsonTreeViewer from "./ApiTester/JsonTreeViewer";

type KeyValue = { key: string; value: string; active: boolean };

type ProxyResponse = {
  status: number;
  time?: string;
  timeMs?: number;
  size: string;
  headers?: Record<string, string>;
  cookies?: string[];
  data: any;
};

type ProxyHistoryEntry = {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  status: number;
  timeMs: number;
  size: string;
  requestHeaders: Record<string, string>;
};

function highlightJson(data: any): string {
  if (data === null || data === undefined) return "";

  let isJson = false;
  let jsonStr = "";

  if (typeof data === "object") {
    jsonStr = JSON.stringify(data, null, 2);
    isJson = true;
  } else if (typeof data === "string") {
    const trimmed = data.trim();
    if (
      (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
      (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
      try {
        const parsed = JSON.parse(data);
        jsonStr = JSON.stringify(parsed, null, 2);
        isJson = true;
      } catch (e) {
        jsonStr = data;
      }
    } else {
      jsonStr = data;
    }
  } else {
    jsonStr = String(data);
  }

  // Escape HTML tags to prevent XSS
  const escaped = jsonStr
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (!isJson) {
    // Jika bukan JSON, bungkus teks biasa agar melipat rapi
    return `<span class="text-emerald-400 whitespace-pre-wrap break-words">${escaped}</span>`;
  }

  // Syntax highlighting untuk struktur JSON
  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match: string) => {
      let cls = "text-amber-400 dark:text-amber-300"; // default number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = "text-sky-400 dark:text-sky-400 font-semibold"; // key
        } else {
          cls =
            "text-emerald-400 dark:text-emerald-400 whitespace-pre-wrap break-words"; // string value
        }
      } else if (/true|false/.test(match)) {
        cls = "text-purple-400 dark:text-purple-400 font-bold"; // boolean
      } else if (/null/.test(match)) {
        cls = "text-slate-500 dark:text-slate-500 italic"; // null
      }
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

export default function ApiTester() {
  const [method, setMethod] = useState(
    () => localStorage.getItem("kroombridge_tester_method") || "POST",
  );
  const [url, setUrl] = useState(
    () =>
      localStorage.getItem("kroombridge_tester_url") ||
      `${window.location.origin}/gateway/ai/chat/completions`,
  );
  const [activeTab, setActiveTab] = useState(
    () =>
      localStorage.getItem("kroombridge_tester_activeTab") || "authorization",
  );
  const [responseTab, setResponseTab] = useState(
    () => localStorage.getItem("kroombridge_tester_responseTab") || "body",
  );
  const [isPrettyPrint, setIsPrettyPrint] = useState(true);

  const [params, setParams] = useState<KeyValue[]>(() => {
    const saved = localStorage.getItem("kroombridge_tester_params");
    return saved ? JSON.parse(saved) : [{ key: "", value: "", active: false }];
  });

  const [headers, setHeaders] = useState<KeyValue[]>(() => {
    const saved = localStorage.getItem("kroombridge_tester_headers");
    return saved
      ? JSON.parse(saved)
      : [
          { key: "Content-Type", value: "application/json", active: true },
          { key: "", value: "", active: false },
        ];
  });

  const [authType, setAuthType] = useState<
    | "none"
    | "basic"
    | "bearer"
    | "jwt"
    | "digest"
    | "oauth1"
    | "oauth2"
    | "hawk"
    | "aws"
    | "ntlm"
    | "apiKey"
    | "akamai"
    | "asap"
  >(
    () =>
      (localStorage.getItem("kroombridge_tester_authType") as any) || "bearer",
  );
  const [basicUser, setBasicUser] = useState(
    () => localStorage.getItem("kroombridge_tester_basicUser") || "",
  );
  const [basicPass, setBasicPass] = useState(
    () => localStorage.getItem("kroombridge_tester_basicPass") || "",
  );
  const [apiKeyName, setApiKeyName] = useState(
    () => localStorage.getItem("kroombridge_tester_apiKeyName") || "x-api-key",
  );
  const [apiKeyValue, setApiKeyValue] = useState(
    () => localStorage.getItem("kroombridge_tester_apiKeyValue") || "",
  );
  const [jwtToken, setJwtToken] = useState(
    () => localStorage.getItem("kroombridge_tester_jwtToken") || "",
  );
  const [bearerToken, setBearerToken] = useState(
    () => localStorage.getItem("kroombridge_tester_bearerToken") || "",
  );
  const [customUpstreamKey, setCustomUpstreamKey] = useState(
    () => localStorage.getItem("kroombridge_tester_customUpstreamKey") || "",
  );
  const [showRawError, setShowRawError] = useState(false);

  const [bodyType, setBodyType] = useState<
    "none" | "form-data" | "urlencoded" | "raw" | "binary" | "graphql"
  >(
    () => (localStorage.getItem("kroombridge_tester_bodyType") as any) || "raw",
  );
  const [rawFormat, setRawFormat] = useState<"json" | "text" | "xml" | "html">(
    () =>
      (localStorage.getItem("kroombridge_tester_rawFormat") as any) || "json",
  );
  const [bodyContent, setBodyContent] = useState(
    () =>
      localStorage.getItem("kroombridge_tester_bodyContent") ||
      '{\n  "messages": [\n    {\n      "role": "user",\n      "content": "Halo! Siapa namamu?"\n    }\n  ],\n  "stream": false\n}',
  );
  const [formDataRows, setFormDataRows] = useState<KeyValue[]>(() => {
    const saved = localStorage.getItem("kroombridge_tester_formDataRows");
    return saved ? JSON.parse(saved) : [{ key: "", value: "", active: false }];
  });
  const [urlEncodedRows, setUrlEncodedRows] = useState<KeyValue[]>(() => {
    const saved = localStorage.getItem("kroombridge_tester_urlEncodedRows");
    return saved ? JSON.parse(saved) : [{ key: "", value: "", active: false }];
  });
  const [binaryContent, setBinaryContent] = useState(
    () => localStorage.getItem("kroombridge_tester_binaryContent") || "",
  );
  const [graphqlQuery, setGraphqlQuery] = useState(
    () =>
      localStorage.getItem("kroombridge_tester_graphqlQuery") ||
      "query MyQuery {\n  __typename\n}",
  );
  const [graphqlVariables, setGraphqlVariables] = useState(
    () =>
      localStorage.getItem("kroombridge_tester_graphqlVariables") || "{\n  \n}",
  );

  const [timeoutMs, setTimeoutMs] = useState(() => {
    const saved = localStorage.getItem("kroombridge_tester_timeoutMs");
    return saved ? Number(saved) : 300000;
  });
  const [followRedirects, setFollowRedirects] = useState(() => {
    const saved = localStorage.getItem("kroombridge_tester_followRedirects");
    return saved ? saved === "true" : true;
  });

  const [response, setResponse] = useState<ProxyResponse | null>(() => {
    const saved = localStorage.getItem("kroombridge_tester_response");
    return saved ? JSON.parse(saved) : null;
  });
  const [history, setHistory] = useState<ProxyHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // New States for Advanced Features
  const [isStreaming, setIsStreaming] = useState(() => {
    const saved = localStorage.getItem("kroombridge_tester_isStreaming");
    return saved ? saved === "true" : false;
  });
  const [environments, setEnvironments] = useState<Environment[]>(() => {
    const saved = localStorage.getItem("kroombridge_tester_environments");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeEnvId, setActiveEnvId] = useState(() => {
    return localStorage.getItem("kroombridge_tester_activeEnvId") || "";
  });
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [isSnippetModalOpen, setIsSnippetModalOpen] = useState(false);
  
  // Scripts state
  const [preRequestScript, setPreRequestScript] = useState(() => {
    return localStorage.getItem("kroombridge_tester_preReqScript") || "// Pre-request script (JavaScript)\n// Use `request` object to read/modify.\n// e.g. request.headers['X-Timestamp'] = Date.now();\n";
  });
  const [testsScript, setTestsScript] = useState(() => {
    return localStorage.getItem("kroombridge_tester_testsScript") || "// Tests script (JavaScript)\n// Use `response` object to assert.\n// e.g. if (response.status !== 200) throw new Error('Bad status');\n";
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    localStorage.setItem("kroombridge_tester_method", method);
    localStorage.setItem("kroombridge_tester_url", url);
    localStorage.setItem("kroombridge_tester_activeTab", activeTab);
    localStorage.setItem("kroombridge_tester_responseTab", responseTab);
    localStorage.setItem("kroombridge_tester_params", JSON.stringify(params));
    localStorage.setItem("kroombridge_tester_headers", JSON.stringify(headers));
    localStorage.setItem("kroombridge_tester_authType", authType);
    localStorage.setItem("kroombridge_tester_basicUser", basicUser);
    localStorage.setItem("kroombridge_tester_basicPass", basicPass);
    localStorage.setItem("kroombridge_tester_apiKeyName", apiKeyName);
    localStorage.setItem("kroombridge_tester_apiKeyValue", apiKeyValue);
    localStorage.setItem("kroombridge_tester_jwtToken", jwtToken);
    localStorage.setItem("kroombridge_tester_bearerToken", bearerToken);
    localStorage.setItem("kroombridge_tester_customUpstreamKey", customUpstreamKey);
    localStorage.setItem("kroombridge_tester_bodyType", bodyType);
    localStorage.setItem("kroombridge_tester_rawFormat", rawFormat);
    localStorage.setItem("kroombridge_tester_bodyContent", bodyContent);
    localStorage.setItem(
      "kroombridge_tester_formDataRows",
      JSON.stringify(formDataRows),
    );
    localStorage.setItem(
      "kroombridge_tester_urlEncodedRows",
      JSON.stringify(urlEncodedRows),
    );
    localStorage.setItem("kroombridge_tester_binaryContent", binaryContent);
    localStorage.setItem("kroombridge_tester_graphqlQuery", graphqlQuery);
    localStorage.setItem(
      "kroombridge_tester_graphqlVariables",
      graphqlVariables,
    );
    localStorage.setItem("kroombridge_tester_timeoutMs", String(timeoutMs));
    localStorage.setItem(
      "kroombridge_tester_followRedirects",
      String(followRedirects),
    );
    localStorage.setItem(
      "kroombridge_tester_response",
      response ? JSON.stringify(response) : "",
    );
    // Advanced features
    localStorage.setItem("kroombridge_tester_isStreaming", String(isStreaming));
    localStorage.setItem("kroombridge_tester_environments", JSON.stringify(environments));
    localStorage.setItem("kroombridge_tester_activeEnvId", activeEnvId);
    localStorage.setItem("kroombridge_tester_preReqScript", preRequestScript);
    localStorage.setItem("kroombridge_tester_testsScript", testsScript);
  }, [
    method,
    url,
    activeTab,
    responseTab,
    params,
    headers,
    authType,
    basicUser,
    basicPass,
    apiKeyName,
    apiKeyValue,
    jwtToken,
    bearerToken,
    customUpstreamKey,
    bodyType,
    rawFormat,
    bodyContent,
    formDataRows,
    urlEncodedRows,
    binaryContent,
    graphqlQuery,
    graphqlVariables,
    timeoutMs,
    followRedirects,
    response,
    isStreaming,
    environments,
    activeEnvId,
    preRequestScript,
    testsScript,
  ]);

  const tabs = [
    { id: "docs", label: "Docs" },
    { id: "params", label: "Params" },
    { id: "authorization", label: "Authorization" },
    { id: "headers", label: "Headers" },
    { id: "body", label: "Body" },
    { id: "scripts", label: "Scripts" },
    { id: "settings", label: "Settings" },
  ];

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/proxy/history");
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      setHistory([]);
    }
  };

  const loadClients = async () => {
    try {
      const res = await adminFetch("/api/admin/clients");
      if (res.ok) {
        const data = await res.json();
        const activeOnly = data.filter((c: any) => c.isActive);
        setClients(activeOnly);
        if (activeOnly.length > 0) {
          setSelectedClientId((prev) => prev || activeOnly[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadHistory();
    loadClients();
  }, []);

  // Auto-refresh history tiap 15 detik supaya kalau ada request baru dari
  // tab/user lain di server yang sama, history terupdate sendirinya.
  useAutoRefresh(loadHistory, true, 15);
  useAutoRefresh(loadClients, true, 30);

  // Realtime updates via Server-Sent Events (SSE) saat klien berubah
  useSSE(
    ["client:change"],
    (type) => {
      if (type === "client:change") {
        loadClients();
      }
    },
    true
  );

  const requestUrl = useMemo(() => {
    const raw = url.trim();
    if (!raw) return "";

    let base = raw;
    if (base.startsWith("/")) {
      base = window.location.origin + base;
    } else if (!/^https?:\/\//i.test(base)) {
      base = `http://${base}`;
    }

    try {
      const urlObj = new URL(base);
      params
        .filter((p) => p.active && p.key.trim() !== "")
        .forEach((p) => urlObj.searchParams.append(p.key, p.value));
      return urlObj.toString();
    } catch (e) {
      return base;
    }
  }, [url, params]);

  const computedHeaders = (contentTypeOverride?: string) => {
    const activeHeaders = headers.filter(
      (h) => h.active && h.key.trim() !== "",
    );
    const headerObj: Record<string, string> = {};
    activeHeaders.forEach((h) => {
      headerObj[h.key] = h.value;
    });

    if (authType === "basic" && (basicUser || basicPass)) {
      const encoded = window.btoa(`${basicUser}:${basicPass}`);
      headerObj["Authorization"] = `Basic ${encoded}`;
    }

    if (authType === "bearer" && bearerToken.trim()) {
      headerObj["Authorization"] = `Bearer ${bearerToken.trim()}`;
    }

    if (customUpstreamKey.trim()) {
      headerObj["x-custom-upstream-key"] = customUpstreamKey.trim();
    }

    if (authType === "jwt" && jwtToken.trim()) {
      headerObj["Authorization"] = `Bearer ${jwtToken.trim()}`;
    }

    if (authType === "apiKey" && apiKeyName.trim() && apiKeyValue.trim()) {
      headerObj[apiKeyName.trim()] = apiKeyValue.trim();
    }

    if (contentTypeOverride && !headerObj["Content-Type"]) {
      headerObj["Content-Type"] = contentTypeOverride;
    }

    return headerObj;
  };

  const buildBodyPayload = () => {
    if (bodyType === "none")
      return { bodyPayload: undefined, contentType: undefined };

    if (bodyType === "raw") {
      const contentTypeMap: Record<string, string> = {
        json: "application/json",
        text: "text/plain",
        xml: "application/xml",
        html: "text/html",
      };
      return {
        bodyPayload: bodyContent,
        contentType: contentTypeMap[rawFormat],
      };
    }

    if (bodyType === "urlencoded") {
      const params = new URLSearchParams();
      urlEncodedRows
        .filter((row) => row.active && row.key.trim() !== "")
        .forEach((row) => params.append(row.key, row.value));
      return {
        bodyPayload: params.toString(),
        contentType: "application/x-www-form-urlencoded",
      };
    }

    if (bodyType === "form-data") {
      const boundary = `----KroomboxBoundary${Math.random().toString(36).slice(2, 9)}`;
      const lines: string[] = [];
      formDataRows
        .filter((row) => row.active && row.key.trim() !== "")
        .forEach((row) => {
          lines.push(`--${boundary}`);
          lines.push(`Content-Disposition: form-data; name="${row.key}"`);
          lines.push("");
          lines.push(row.value);
        });
      lines.push(`--${boundary}--`);
      lines.push("");
      return {
        bodyPayload: lines.join("\r\n"),
        contentType: `multipart/form-data; boundary=${boundary}`,
      };
    }

    if (bodyType === "binary") {
      return {
        bodyPayload: binaryContent,
        contentType: "application/octet-stream",
      };
    }

    if (bodyType === "graphql") {
      let variables: any = undefined;
      const trimmed = graphqlVariables.trim();
      if (trimmed) {
        try {
          variables = JSON.parse(trimmed);
        } catch (e) {
          variables = trimmed;
        }
      }
      return {
        bodyPayload: JSON.stringify({ query: graphqlQuery, variables }),
        contentType: "application/json",
      };
    }

    return { bodyPayload: undefined, contentType: undefined };
  };

  const handleGenerateTokenForClient = async (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;

    setIsGeneratingToken(true);
    try {
      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: client.id,
          clientSecret: client.secretKey,
        }),
      });
      const data = await res.json();

      if (res.ok && data.access_token) {
        setBearerToken(data.access_token);
        setJwtToken(data.access_token);
        setAuthType("bearer");
        setResponse({
          status: res.status,
          time: "0 ms",
          size: JSON.stringify(data).length + " B",
          headers: {},
          cookies: [],
          data: {
            ok: true,
            message: `Token berhasil dibuat untuk klien '${client.name}' (${client.id}).`,
            ...data,
          },
        });
      } else {
        setResponse({
          status: res.status,
          time: "0 ms",
          size: "0 B",
          headers: {},
          cookies: [],
          data: {
            error: "Gagal generate token.",
            details: data,
          },
        });
      }
    } catch (e: any) {
      setResponse({
        status: 500,
        time: "0 ms",
        size: "0 B",
        headers: {},
        cookies: [],
        data: {
          error: "Network error saat generate token.",
          details: e?.message || String(e),
        },
      });
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleGenerateToken = async () => {
    setIsGeneratingToken(true);
    try {
      // Ambil daftar klien aktif dari admin API. Pakai klien pertama yang
      // aktif untuk demo. Kalau gak ada, jelaskan ke user.
      const listRes = await adminFetch("/api/admin/clients");
      if (!listRes.ok) {
        const errBody = await listRes.json().catch(() => ({}));
        setResponse({
          status: listRes.status,
          time: "0 ms",
          size: "0 B",
          headers: {},
          cookies: [],
          data: {
            error: "Gagal ambil daftar klien.",
            hint:
              listRes.status === 401
                ? "Sesi admin habis — login ulang ke dashboard."
                : "Cek koneksi backend.",
            details: errBody,
          },
        });
        setActiveTab("authorization");
        return;
      }
      const clients = await listRes.json();
      if (!Array.isArray(clients) || clients.length === 0) {
        setResponse({
          status: 404,
          time: "0 ms",
          size: "0 B",
          headers: {},
          cookies: [],
          data: {
            error: "Belum ada klien terdaftar.",
            hint: "Buka tab Clients di dashboard, klik 'Tambah Klien' untuk bikin klien baru.",
          },
        });
        setActiveTab("authorization");
        return;
      }
      const activeClient = clients.find((c: any) => c.isActive) || clients[0];

      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: activeClient.id,
          clientSecret: activeClient.secretKey,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.access_token) {
        setResponse({
          status: res.status,
          time: "0 ms",
          size: "0 B",
          headers: {},
          cookies: [],
          data: {
            error: "Gagal generate token.",
            usedClientId: activeClient.id,
            details: data,
          },
        });
        setActiveTab("authorization");
        return;
      }

      setBearerToken(data.access_token);
      setAuthType("bearer");
      setActiveTab("authorization");
      setResponse({
        status: res.status,
        time: "0 ms",
        size: JSON.stringify(data).length + " B",
        headers: {},
        cookies: [],
        data: {
          ok: true,
          message: `Token berhasil dibuat untuk klien '${activeClient.name}' (${activeClient.id}).`,
          ...data,
        },
      });
    } catch (e: any) {
      console.error(e);
      setResponse({
        status: 500,
        time: "0 ms",
        size: "0 B",
        headers: {},
        cookies: [],
        data: {
          error: "Network error saat generate token.",
          details: e?.message || String(e),
        },
      });
      setActiveTab("authorization");
    } finally {
      setIsGeneratingToken(false);
    }
  };

  // Helper: decode JWT exp claim. Return true kalau token akan expired
  // dalam <60 detik (atau invalid/empty).
  const isTokenExpiredOrEmpty = (token: string): boolean => {
    if (!token || !token.trim()) return true;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return true;
      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (typeof payload.exp !== "number") return false;
      // Buffer 60 detik supaya gak race-condition di network latency
      return payload.exp * 1000 < Date.now() + 60_000;
    } catch {
      return true;
    }
  };

  const ensureValidBearerToken = async (): Promise<string> => {
    if (authType !== "bearer") return bearerToken;
    if (!isTokenExpiredOrEmpty(bearerToken)) return bearerToken;
    // Token kosong / expired → auto-generate
    try {
      const listRes = await adminFetch("/api/admin/clients");
      if (!listRes.ok) return "";
      const clients = await listRes.json();
      if (!Array.isArray(clients) || clients.length === 0) return "";
      const activeClient = clients.find((c: any) => c.isActive) || clients[0];

      const tokenRes = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: activeClient.id,
          clientSecret: activeClient.secretKey,
        }),
      });
      const data = await tokenRes.json();
      if (!tokenRes.ok || !data.access_token) return "";
      setBearerToken(data.access_token);
      return data.access_token;
    } catch {
      return "";
    }
  };

  const replaceEnvVars = (text: string) => {
    if (!activeEnvId || !text || typeof text !== "string") return text;
    const env = environments.find((e) => e.id === activeEnvId);
    if (!env) return text;
    let res = text;
    env.variables.forEach((v) => {
      if (v.key) res = res.replace(new RegExp(`{{${v.key}}}`, "g"), v.value);
    });
    return res;
  };

  const handleSend = async () => {
    if (!requestUrl) return;
    setIsLoading(true);
    setResponse(null);
    setShowRawError(false);

    if (isStreaming) {
      setResponse({
        status: 0,
        time: "...",
        size: "0 B",
        data: "",
        headers: {},
        cookies: [],
      });
    }

    try {
      const usableToken = await ensureValidBearerToken();

      const { bodyPayload, contentType } = buildBodyPayload();
      const headersObj = computedHeaders(contentType);

      if (authType === "bearer" && usableToken) {
        headersObj["Authorization"] = `Bearer ${usableToken}`;
      }

      // 1. Replace ENV variables
      const finalUrl = replaceEnvVars(requestUrl);
      const finalHeaders: Record<string, string> = {};
      Object.entries(headersObj).forEach(([k, v]) => {
        finalHeaders[replaceEnvVars(k)] = replaceEnvVars(v);
      });
      const finalBody = bodyPayload ? replaceEnvVars(bodyPayload) : undefined;

      const safeBodyPayload =
        method !== "GET" && method !== "HEAD" && bodyType !== "none"
          ? finalBody
          : undefined;

      // 2. Pre-request Script
      const currentReq = {
        url: finalUrl,
        method,
        headers: finalHeaders,
        body: safeBodyPayload,
      };
      try {
        if (preRequestScript.trim()) {
          const sandbox = new Function("request", preRequestScript);
          sandbox(currentReq);
        }
      } catch (err: any) {
        console.error("Pre-request script error:", err);
      }

      const postHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (isStreaming) {
        postHeaders["x-proxy-stream"] = "true";
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const startTime = Date.now();
      const res = await fetch("/api/proxy", {
        method: "POST",
        headers: postHeaders,
        body: JSON.stringify({
          method: currentReq.method,
          url: currentReq.url,
          headers: currentReq.headers,
          body: currentReq.body,
          timeoutMs,
          followRedirects,
        }),
        signal: abortControllerRef.current.signal,
      });

      // 3. Handle Streaming
      if (isStreaming) {
        let streamData = "";
        const resHeaders = Object.fromEntries(res.headers.entries());
        setResponse((prev: any) => ({
          ...prev,
          status: res.status,
          headers: resHeaders,
        }));

        if (res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            streamData += chunk;
            setResponse((prev: any) => ({
              ...prev,
              data: streamData,
              size: new Blob([streamData]).size + " B",
            }));
          }
        }
        const endTime = Date.now();
        setResponse((prev: any) => ({
          ...prev,
          timeMs: endTime - startTime,
          time: endTime - startTime + " ms",
        }));

        // Post-response Script
        try {
          if (testsScript.trim()) {
            const sandbox = new Function("response", testsScript);
            sandbox({ status: res.status, data: streamData, headers: resHeaders });
          }
        } catch (err) {
          console.error("Tests script error", err);
        }
        
        await loadHistory();
        return;
      }

      // Standard non-streaming logic
      const proxyRes = await res.json();

      try {
        if (testsScript.trim()) {
          const sandbox = new Function("response", testsScript);
          sandbox(proxyRes);
        }
      } catch (err) {
        console.error("Tests script error", err);
      }

      setResponse({
        status: proxyRes.status || 0,
        time: proxyRes.time || "0 ms",
        timeMs: proxyRes.timeMs,
        size: proxyRes.size || "0 B",
        headers: proxyRes.headers || {},
        cookies: proxyRes.cookies || [],
        data: proxyRes.data,
      });
      await loadHistory();
    } catch (e: any) {
      if (e.name === "AbortError") return;
      setResponse({
        status: 0,
        time: "0 ms",
        size: "0 B",
        headers: {},
        cookies: [],
        data: {
          error: e.message || "Failed to fetch",
          hint: "Check network or proxy settings.",
        },
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSend]);

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response.data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getMethodColor = (m: string) => {
    switch (m) {
      case "GET":
        return "text-blue-600 dark:text-blue-400";
      case "POST":
        return "text-emerald-600 dark:text-emerald-400";
      case "PUT":
        return "text-amber-600 dark:text-amber-400";
      case "PATCH":
        return "text-cyan-600 dark:text-cyan-400";
      case "DELETE":
        return "text-rose-600 dark:text-rose-400";
      default:
        return "text-slate-600 dark:text-slate-400";
    }
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-emerald-400";
    if (status >= 300 && status < 400) return "text-blue-400";
    if (status >= 400) return "text-rose-400";
    return "text-slate-400";
  };

  const applyHistoryEntry = (entry: ProxyHistoryEntry) => {
    setMethod(entry.method);
    setUrl(entry.url);
    const headerRows = Object.entries(entry.requestHeaders || {}).map(
      ([key, value]) => ({
        key,
        value,
        active: true,
      }),
    );
    setHeaders(
      headerRows.length
        ? [...headerRows, { key: "", value: "", active: false }]
        : [{ key: "", value: "", active: false }],
    );
  };

  const authUnsupported = ![
    "none",
    "bearer",
    "basic",
    "apiKey",
    "jwt",
  ].includes(authType);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative max-w-7xl mx-auto pb-10 flex flex-col h-[calc(100vh-120px)] space-y-5"
    >
      <div className="pointer-events-none absolute -top-10 -right-10 h-56 w-56 rounded-full bg-linear-to-br from-emerald-400/30 via-blue-400/10 to-transparent blur-3xl"></div>
      <div className="pointer-events-none absolute -bottom-10 -left-10 h-64 w-64 rounded-full bg-linear-to-br from-blue-500/20 via-indigo-500/10 to-transparent blur-3xl"></div>

      <div className="relative overflow-hidden flex items-center justify-between bg-white/90 dark:bg-slate-950/70 p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 shadow-[0_12px_40px_-30px_rgba(15,23,42,0.6)]">
        <div className="absolute inset-0 bg-linear-to-r from-emerald-500/10 via-transparent to-blue-500/10 opacity-80"></div>
        <div className="flex items-center space-x-4">
          <div className="relative z-10 w-11 h-11 rounded-xl bg-linear-to-br from-emerald-500/30 via-slate-900 to-slate-800 flex items-center justify-center shadow-[0_10px_30px_-16px_rgba(16,185,129,0.9)] border border-emerald-400/30">
            <Shield className="w-5 h-5 text-emerald-300" />
          </div>
          <div className="relative z-10">
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              API Tester
            </h2>
            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">
              Realtime request/response seperti Postman
            </p>
          </div>
        </div>
        <div className="relative z-10 flex items-center gap-2">
          <button
            onClick={() => setIsEnvModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>{activeEnvId ? environments.find((e) => e.id === activeEnvId)?.name || "Environments" : "Environments"}</span>
          </button>
          
          <button
            onClick={() => setIsSnippetModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800/40 hover:bg-slate-700/60 border border-slate-700/50 text-slate-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
          >
            <Code className="w-3.5 h-3.5" />
            <span>Code Snippet</span>
          </button>

          <button
            onClick={() => {
              setMethod("POST");
              setUrl(`${window.location.origin}/gateway/kroma/v1/chat/completions`);
              setAuthType("bearer");
              setActiveTab("body");
              setBodyType("raw");
              setRawFormat("json");
              setIsStreaming(false);
              setBodyContent(JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: [
                  {
                    role: "user",
                    content: "Halo, jawab singkat."
                  }
                ],
                stream: false
              }, null, 2));
            }}
            className="px-3.5 py-2 bg-gradient-to-r from-blue-500/20 to-indigo-500/20 hover:from-blue-500/35 hover:to-indigo-500/35 text-blue-700 dark:text-blue-300 border border-blue-200/40 dark:border-blue-800/40 text-xs font-black rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
            <span>Preset: AI Chat</span>
          </button>
        </div>
      </div>

      <PanelGroup id="api-tester-panels" autoSave="api-tester-panels" orientation="horizontal" className="flex-1 min-h-0 gap-6">
        <Panel defaultSize={50} minSize={30} className="flex flex-col space-y-4">
          <div className="flex space-x-2">
            <div className="flex-1 flex bg-white/95 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-[0_12px_40px_-28px_rgba(15,23,42,0.8)] focus-within:ring-2 ring-emerald-400/30 focus-within:border-emerald-400/60 transition-all">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className={cn(
                  "bg-slate-50 dark:bg-slate-900 px-4 py-3 outline-none border-r border-slate-200 dark:border-slate-800 font-black cursor-pointer text-sm",
                  getMethodColor(method),
                )}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
                <option value="OPTIONS">OPTIONS</option>
              </select>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://api.example.com/v1/resource"
                className="flex-1 bg-transparent px-4 py-3 outline-none font-mono text-sm text-slate-700 dark:text-slate-200 w-full"
              />
            </div>
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="px-6 py-3 bg-linear-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-black rounded-xl shadow-[0_16px_32px_-20px_rgba(16,185,129,0.8)] transition-colors flex items-center space-x-2 outline-none disabled:opacity-70 shrink-0"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
              <span>Send</span>
            </button>
          </div>

          <div className="flex-1 bg-white/95 dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 rounded-2xl shadow-[0_20px_50px_-35px_rgba(15,23,42,0.9)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-linear-to-r from-slate-50/80 via-white/60 to-slate-50/80 dark:from-slate-900/80 dark:via-slate-950/60 dark:to-slate-900/80 pr-2">
              <div className="flex flex-wrap">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "px-4 py-3 text-sm font-bold border-b-2 transition-colors outline-none",
                      activeTab === tab.id
                        ? "border-blue-500 text-blue-600 dark:text-blue-400"
                        : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 bg-white/90 dark:bg-slate-950 p-4 overflow-y-auto hidden-scrollbar">
              {activeTab === "docs" && (
                <div className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Masukkan endpoint yang ingin diuji, pilih method, lalu kirim.
                  Tab ini siap diisi dokumentasi internal jika dibutuhkan.
                </div>
              )}

              {activeTab === "params" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 px-2">
                    <div className="col-span-1"></div>
                    <div className="col-span-4">Key</div>
                    <div className="col-span-7">Value</div>
                  </div>
                  {params.map((p, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-2 items-center group"
                    >
                      <div className="col-span-1 flex justify-center">
                        <input
                          type="checkbox"
                          checked={p.active}
                          onChange={(e) => {
                            const next = [...params];
                            next[i].active = e.target.checked;
                            setParams(next);
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-300 cursor-pointer text-blue-600"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={p.key}
                          onChange={(e) => {
                            const next = [...params];
                            next[i].key = e.target.value;
                            if (i === params.length - 1 && e.target.value)
                              next.push({ key: "", value: "", active: false });
                            setParams(next);
                          }}
                          placeholder="Key"
                          className="w-full px-3 py-1.5 text-sm border font-mono border-slate-200 dark:border-slate-700 rounded-md bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="col-span-7">
                        <input
                          type="text"
                          value={p.value}
                          onChange={(e) => {
                            const next = [...params];
                            next[i].value = e.target.value;
                            if (i === params.length - 1 && e.target.value)
                              next.push({ key: "", value: "", active: false });
                            setParams(next);
                          }}
                          placeholder="Value"
                          className="w-full px-3 py-1.5 text-sm border font-mono border-slate-200 dark:border-slate-700 rounded-md bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "authorization" && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[13px] font-black text-slate-600 dark:text-slate-300">
                        Auth Type
                      </div>
                      <div className="text-xs text-slate-400">
                        Pilih mekanisme otentikasi request
                      </div>
                    </div>
                    <select
                      value={authType}
                      onChange={(e) =>
                        setAuthType(e.target.value as typeof authType)
                      }
                      className="px-4 py-2.5 rounded-xl text-sm font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 min-w-55"
                    >
                      <option value="none">No Auth</option>
                      <option value="basic">Basic Auth</option>
                      <option value="bearer">Bearer Token</option>
                      <option value="jwt">JWT Bearer</option>
                      <option value="digest">Digest Auth</option>
                      <option value="oauth1">OAuth 1.0</option>
                      <option value="oauth2">OAuth 2.0</option>
                      <option value="hawk">Hawk Authentication</option>
                      <option value="aws">AWS Signature</option>
                      <option value="ntlm">NTLM Authentication</option>
                      <option value="apiKey">API Key</option>
                      <option value="akamai">Akamai EdgeGrid</option>
                      <option value="asap">ASAP (Atlassian)</option>
                    </select>
                  </div>

                  {authUnsupported && (
                    <div className="text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                      Tipe auth ini belum diaktifkan. Saat ini hanya Basic,
                      Bearer, JWT, dan API Key yang terhubung ke request.
                    </div>
                  )}

                  {authType === "basic" && (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Username
                          </label>
                          <input
                            type="text"
                            value={basicUser}
                            onChange={(e) => setBasicUser(e.target.value)}
                            placeholder="username"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            Password
                          </label>
                          <input
                            type="password"
                            value={basicPass}
                            onChange={(e) => setBasicPass(e.target.value)}
                            placeholder="password"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-mono text-sm"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">
                        Authorization: Basic base64(user:pass)
                      </p>
                    </div>
                  )}

                  {authType === "bearer" && (
                    <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-900/10 p-4 space-y-3">
                      {clients.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-emerald-100/30">
                          <div>
                            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block">Pilih Klien untuk Generate Token:</span>
                            <span className="text-[10px] text-emerald-600/70 block">Otomatis buat JWT token untuk klien terpilih</span>
                          </div>
                          <div className="flex gap-2 items-center">
                            <select
                              value={selectedClientId}
                              onChange={(e) => setSelectedClientId(e.target.value)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 min-w-40 focus:outline-none"
                            >
                              {clients.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.id})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleGenerateTokenForClient(selectedClientId)}
                              disabled={isGeneratingToken}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>Buat Token</span>
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                          Token
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={bearerToken}
                            onChange={(e) => setBearerToken(e.target.value)}
                            placeholder="Masukkan Bearer Token"
                            className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-mono text-sm focus:outline-none focus:ring-2 ring-emerald-300/40 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(bearerToken);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 hover:text-emerald-600 transition-colors cursor-pointer"
                            title="Copy Token"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-emerald-600/80">
                        Header Authorization dibuat otomatis.
                      </p>
                      
                      <div className="pt-2 mt-2 border-t border-emerald-100/30 space-y-1">
                        <label className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                          Upstream Kroma API Key (Opsional)
                        </label>
                        <input
                          type="password"
                          value={customUpstreamKey}
                          onChange={(e) => setCustomUpstreamKey(e.target.value)}
                          placeholder="Override API Key Kroma..."
                          className="w-full px-4 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-mono text-sm focus:outline-none focus:ring-2 ring-emerald-300/40"
                        />
                        <p className="text-[10px] text-emerald-600/80">Jika diisi, akan mengabaikan API Key dari Settings dan langsung meneruskannya ke Kroma AI.</p>
                      </div>
                    </div>
                  )}

                  {authType === "jwt" && (
                    <div className="rounded-2xl border border-indigo-200/60 dark:border-indigo-800/40 bg-indigo-50/60 dark:bg-indigo-900/10 p-4 space-y-3">
                      {clients.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-indigo-100/30">
                          <div>
                            <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 block">Pilih Klien untuk Generate Token:</span>
                            <span className="text-[10px] text-indigo-600/70 block">Otomatis buat JWT token untuk klien terpilih</span>
                          </div>
                          <div className="flex gap-2 items-center">
                            <select
                              value={selectedClientId}
                              onChange={(e) => setSelectedClientId(e.target.value)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 min-w-40 focus:outline-none"
                            >
                              {clients.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({c.id})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleGenerateTokenForClient(selectedClientId)}
                              disabled={isGeneratingToken}
                              className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>Buat Token</span>
                            </button>
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        <label className="text-xs font-black text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block">
                          JWT Token
                        </label>
                        <div className="relative">
                          <input
                            type="password"
                            value={jwtToken}
                            onChange={(e) => setJwtToken(e.target.value)}
                            placeholder="Masukkan JWT"
                            className="w-full px-4 py-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800/60 bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-mono text-sm focus:outline-none focus:ring-2 ring-indigo-300/40"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
                            <Key className="w-4 h-4" />
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-indigo-600/80">
                        JWT akan dikirim sebagai Bearer.
                      </p>
                    </div>
                  )}

                  {authType === "apiKey" && (
                    <div className="rounded-2xl border border-blue-200/60 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-900/10 p-4 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                            Key Name
                          </label>
                          <input
                            type="text"
                            value={apiKeyName}
                            onChange={(e) => setApiKeyName(e.target.value)}
                            placeholder="x-api-key"
                            className="w-full px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                            Key Value
                          </label>
                          <input
                            type="password"
                            value={apiKeyValue}
                            onChange={(e) => setApiKeyValue(e.target.value)}
                            placeholder="your-api-key"
                            className="w-full px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-800/60 bg-white/80 dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-mono text-sm"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-blue-600/80">
                        API key akan dikirim sebagai header.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "headers" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 px-2">
                    <div className="col-span-1"></div>
                    <div className="col-span-4">Key</div>
                    <div className="col-span-6">Value</div>
                    <div className="col-span-1"></div>
                  </div>
                  {headers.map((h, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-12 gap-2 items-center group"
                    >
                      <div className="col-span-1 flex justify-center">
                        <input
                          type="checkbox"
                          checked={h.active}
                          onChange={(e) => {
                            const next = [...headers];
                            next[i].active = e.target.checked;
                            setHeaders(next);
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-300 cursor-pointer text-blue-600"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={h.key}
                          onChange={(e) => {
                            const next = [...headers];
                            next[i].key = e.target.value;
                            if (i === headers.length - 1 && e.target.value)
                              next.push({ key: "", value: "", active: false });
                            setHeaders(next);
                          }}
                          placeholder="Key"
                          className="w-full px-3 py-1.5 text-sm border font-mono border-slate-200 dark:border-slate-700 rounded-md bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="col-span-6">
                        <input
                          type="text"
                          value={h.value}
                          onChange={(e) => {
                            const next = [...headers];
                            next[i].value = e.target.value;
                            if (i === headers.length - 1 && e.target.value)
                              next.push({ key: "", value: "", active: false });
                            setHeaders(next);
                          }}
                          placeholder="Value"
                          className="w-full px-3 py-1.5 text-sm border font-mono border-slate-200 dark:border-slate-700 rounded-md bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div className="col-span-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            if (i === headers.length - 1) return;
                            setHeaders(headers.filter((_, idx) => idx !== i));
                          }}
                          className="text-rose-400 hover:text-rose-600 outline-none"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "body" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-4 text-sm font-bold text-slate-500 dark:text-slate-400">
                    {[
                      { id: "none", label: "none" },
                      { id: "form-data", label: "form-data" },
                      { id: "urlencoded", label: "x-www-form-urlencoded" },
                      { id: "raw", label: "raw" },
                      { id: "binary", label: "binary" },
                      { id: "graphql", label: "GraphQL" },
                    ].map((option) => (
                      <label
                        key={option.id}
                        className="flex items-center space-x-2"
                      >
                        <input
                          type="radio"
                          name="bodyType"
                          checked={bodyType === option.id}
                          onChange={() =>
                            setBodyType(option.id as typeof bodyType)
                          }
                        />
                        <span
                          className={
                            bodyType === option.id
                              ? "text-blue-600 dark:text-blue-400"
                              : ""
                          }
                        >
                          {option.label}
                        </span>
                      </label>
                    ))}
                    {bodyType === "raw" && (
                      <select
                        value={rawFormat}
                        onChange={(e) =>
                          setRawFormat(e.target.value as typeof rawFormat)
                        }
                        className="ml-auto px-3 py-2 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                      >
                        <option value="json">JSON</option>
                        <option value="text">Text</option>
                        <option value="xml">XML</option>
                        <option value="html">HTML</option>
                      </select>
                    )}
                  </div>

                  {bodyType === "none" && (
                    <div className="text-sm text-slate-400">
                      Tidak ada body yang dikirim.
                    </div>
                  )}

                  {bodyType === "form-data" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 px-2">
                        <div className="col-span-1"></div>
                        <div className="col-span-4">Key</div>
                        <div className="col-span-6">Value</div>
                        <div className="col-span-1"></div>
                      </div>
                      {formDataRows.map((row, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-12 gap-2 items-center group"
                        >
                          <div className="col-span-1 flex justify-center">
                            <input
                              type="checkbox"
                              checked={row.active}
                              onChange={(e) => {
                                const next = [...formDataRows];
                                next[i].active = e.target.checked;
                                setFormDataRows(next);
                              }}
                              className="w-3.5 h-3.5 rounded border-slate-300 cursor-pointer text-blue-600"
                            />
                          </div>
                          <div className="col-span-4">
                            <input
                              type="text"
                              value={row.key}
                              onChange={(e) => {
                                const next = [...formDataRows];
                                next[i].key = e.target.value;
                                if (
                                  i === formDataRows.length - 1 &&
                                  e.target.value
                                )
                                  next.push({
                                    key: "",
                                    value: "",
                                    active: false,
                                  });
                                setFormDataRows(next);
                              }}
                              placeholder="Key"
                              className="w-full px-3 py-1.5 text-sm border font-mono border-slate-200 dark:border-slate-700 rounded-md bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="col-span-6">
                            <input
                              type="text"
                              value={row.value}
                              onChange={(e) => {
                                const next = [...formDataRows];
                                next[i].value = e.target.value;
                                if (
                                  i === formDataRows.length - 1 &&
                                  e.target.value
                                )
                                  next.push({
                                    key: "",
                                    value: "",
                                    active: false,
                                  });
                                setFormDataRows(next);
                              }}
                              placeholder="Value"
                              className="w-full px-3 py-1.5 text-sm border font-mono border-slate-200 dark:border-slate-700 rounded-md bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="col-span-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                if (i === formDataRows.length - 1) return;
                                setFormDataRows(
                                  formDataRows.filter((_, idx) => idx !== i),
                                );
                              }}
                              className="text-rose-400 hover:text-rose-600 outline-none"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {bodyType === "urlencoded" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 px-2">
                        <div className="col-span-1"></div>
                        <div className="col-span-4">Key</div>
                        <div className="col-span-6">Value</div>
                        <div className="col-span-1"></div>
                      </div>
                      {urlEncodedRows.map((row, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-12 gap-2 items-center group"
                        >
                          <div className="col-span-1 flex justify-center">
                            <input
                              type="checkbox"
                              checked={row.active}
                              onChange={(e) => {
                                const next = [...urlEncodedRows];
                                next[i].active = e.target.checked;
                                setUrlEncodedRows(next);
                              }}
                              className="w-3.5 h-3.5 rounded border-slate-300 cursor-pointer text-blue-600"
                            />
                          </div>
                          <div className="col-span-4">
                            <input
                              type="text"
                              value={row.key}
                              onChange={(e) => {
                                const next = [...urlEncodedRows];
                                next[i].key = e.target.value;
                                if (
                                  i === urlEncodedRows.length - 1 &&
                                  e.target.value
                                )
                                  next.push({
                                    key: "",
                                    value: "",
                                    active: false,
                                  });
                                setUrlEncodedRows(next);
                              }}
                              placeholder="Key"
                              className="w-full px-3 py-1.5 text-sm border font-mono border-slate-200 dark:border-slate-700 rounded-md bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="col-span-6">
                            <input
                              type="text"
                              value={row.value}
                              onChange={(e) => {
                                const next = [...urlEncodedRows];
                                next[i].value = e.target.value;
                                if (
                                  i === urlEncodedRows.length - 1 &&
                                  e.target.value
                                )
                                  next.push({
                                    key: "",
                                    value: "",
                                    active: false,
                                  });
                                setUrlEncodedRows(next);
                              }}
                              placeholder="Value"
                              className="w-full px-3 py-1.5 text-sm border font-mono border-slate-200 dark:border-slate-700 rounded-md bg-transparent text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="col-span-1 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                if (i === urlEncodedRows.length - 1) return;
                                setUrlEncodedRows(
                                  urlEncodedRows.filter((_, idx) => idx !== i),
                                );
                              }}
                              className="text-rose-400 hover:text-rose-600 outline-none"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {bodyType === "raw" && (
                    <textarea
                      value={bodyContent}
                      onChange={(e) => setBodyContent(e.target.value)}
                      className="w-full h-56 resize-none outline-none font-mono text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 p-4 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 ring-blue-500/20"
                      spellCheck={false}
                    />
                  )}

                  {bodyType === "binary" && (
                    <div className="space-y-2">
                      <textarea
                        value={binaryContent}
                        onChange={(e) => setBinaryContent(e.target.value)}
                        placeholder="Tempel base64 atau raw binary string di sini"
                        className="w-full h-48 resize-none outline-none font-mono text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 p-4 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 ring-blue-500/20"
                        spellCheck={false}
                      />
                      <p className="text-xs text-slate-400">
                        Binary akan dikirim apa adanya sebagai
                        application/octet-stream.
                      </p>
                    </div>
                  )}

                  {bodyType === "graphql" && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-slate-400">
                          Query
                        </label>
                        <textarea
                          value={graphqlQuery}
                          onChange={(e) => setGraphqlQuery(e.target.value)}
                          className="mt-2 w-full h-40 resize-none outline-none font-mono text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 p-4 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 ring-blue-500/20"
                          spellCheck={false}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-400">
                          Variables (JSON)
                        </label>
                        <textarea
                          value={graphqlVariables}
                          onChange={(e) => setGraphqlVariables(e.target.value)}
                          className="mt-2 w-full h-32 resize-none outline-none font-mono text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 p-4 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 ring-blue-500/20"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "scripts" && (
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-slate-400 mb-2 block">
                      Pre-request Script (JavaScript)
                    </label>
                    <textarea
                      value={preRequestScript}
                      onChange={(e) => setPreRequestScript(e.target.value)}
                      className="w-full h-32 resize-y outline-none font-mono text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 p-4 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 ring-blue-500/20"
                      spellCheck={false}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Available variable: <code>request</code></p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 mb-2 block">
                      Tests (JavaScript)
                    </label>
                    <textarea
                      value={testsScript}
                      onChange={(e) => setTestsScript(e.target.value)}
                      className="w-full h-32 resize-y outline-none font-mono text-sm bg-slate-50 dark:bg-slate-900/50 text-slate-800 dark:text-slate-200 p-4 rounded-xl border border-slate-200 dark:border-slate-800 focus:border-blue-500 focus:ring-1 ring-blue-500/20"
                      spellCheck={false}
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Available variable: <code>response</code></p>
                  </div>
                </div>
              )}

              {activeTab === "settings" && (
                <div className="space-y-5">
                  <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 cursor-pointer">
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-300">Stream Response</div>
                      <div className="text-xs text-slate-500">
                        Pipes proxy body response as stream
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isStreaming}
                      onChange={(e) => setIsStreaming(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>

                  <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                        Timeout (ms)
                      </div>
                      <div className="text-xs text-slate-500">
                        Batas waktu request ke proxy
                      </div>
                    </div>
                    <input
                      type="number"
                      min={1000}
                      step={500}
                      value={timeoutMs}
                      onChange={(e) => setTimeoutMs(Number(e.target.value))}
                      className="w-32 px-3 py-2 rounded-lg text-sm font-mono bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 cursor-pointer">
                    <div>
                      <div className="text-sm font-bold text-slate-700 dark:text-slate-300">Follow redirects</div>
                      <div className="text-xs text-slate-500">
                        Ikuti HTTP 3xx otomatis
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={followRedirects}
                      onChange={(e) => setFollowRedirects(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </label>
                </div>
              )}
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-slate-200 dark:bg-slate-800 rounded-full hover:bg-blue-500 transition-colors mx-2 cursor-col-resize hidden lg:block" />

        <Panel defaultSize={50} minSize={30} className="flex flex-col bg-slate-950 rounded-2xl shadow-[0_20px_50px_-35px_rgba(2,6,23,0.9)] border border-slate-800/80 overflow-hidden text-slate-300">
          <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-slate-800 bg-linear-to-r from-slate-950 via-slate-950/80 to-slate-900/80">
            <div className="flex items-center space-x-2">
              <AlignLeft className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-bold text-slate-200 tracking-wide uppercase">
                Response
              </span>
            </div>
            <div className="flex items-center space-x-4 text-[11px] font-mono">
              {response && (
                <>
                  <div className="flex items-center space-x-1">
                    <span className="text-slate-500">Status:</span>
                    <span
                      className={cn(
                        "font-bold",
                        getStatusColor(response.status),
                      )}
                    >
                      {response.status}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span className="text-emerald-400">
                      {response.time || "0 ms"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-slate-500">Size:</span>
                    <span className="text-blue-400">{response.size}</span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="ml-2 hover:text-white transition-colors outline-none flex items-center space-x-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded"
                  >
                    {copied ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 pr-4">
            <div className="flex items-center text-sm font-bold text-slate-400 overflow-x-auto hidden-scrollbar shrink-0">
              {["body", "preview", "headers", "cookies", "history"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setResponseTab(tab)}
                  className={cn(
                    "px-4 py-2.5 border-b-2 transition-colors shrink-0",
                    responseTab === tab
                      ? "border-blue-500 text-blue-300"
                      : "border-transparent hover:text-slate-200",
                  )}
                >
                  {tab === "body" && "Body"}
                  {tab === "preview" && "Preview"}
                  {tab === "headers" && "Headers"}
                  {tab === "cookies" && "Cookies"}
                  {tab === "history" && "History"}
                </button>
              ))}
            </div>
            
            {responseTab === "body" && (
              <label className="flex items-center space-x-2 text-xs font-medium text-slate-400 hover:text-slate-200 cursor-pointer select-none">
                <span>Pretty-print</span>
                <input
                  type="checkbox"
                  checked={isPrettyPrint}
                  onChange={(e) => setIsPrettyPrint(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900/50 text-blue-500 focus:ring-blue-500/30"
                />
              </label>
            )}
          </div>

          <div className="flex-1 p-4 overflow-y-auto font-mono text-[13px] leading-relaxed hidden-scrollbar">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-slate-600 space-x-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                <div
                  className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"
                  style={{ animationDelay: "0.2s" }}
                ></div>
                <div
                  className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"
                  style={{ animationDelay: "0.4s" }}
                ></div>
              </div>
            ) : response ? (
              <>
                {responseTab === "body" && (() => {
                  let parsedData = response.data;
                  if (typeof parsedData === "string") {
                    try {
                      parsedData = JSON.parse(parsedData);
                    } catch (e) {}
                  }

                  // Deteksi payload proxy error (karena fallback dari streaming yang gagal)
                  const isProxyErrorPayload = parsedData && typeof parsedData === "object" && parsedData.status && parsedData.data && parsedData.data.error;
                  const finalStatus = isProxyErrorPayload ? parsedData.status : response.status;
                  const errObj = isProxyErrorPayload ? parsedData.data : parsedData;

                  const hasError = finalStatus >= 400 || (errObj && errObj.error);

                  if (hasError) {
                    const rawErrMsg = typeof errObj === "string" ? errObj : (errObj?.error || errObj?.message || "Unknown Error");
                    const errMsg = typeof rawErrMsg === "object" && rawErrMsg !== null ? JSON.stringify(rawErrMsg) : String(rawErrMsg);
                    
                    const rawProvider = errObj?.provider || errObj?.gateway || (finalStatus >= 500 ? "Server Error" : "Client Error");
                    const provider = typeof rawProvider === "object" && rawProvider !== null ? JSON.stringify(rawProvider) : String(rawProvider);
                    
                    const rawHint = errObj?.hint;
                    const hint = rawHint && typeof rawHint === "object" ? JSON.stringify(rawHint) : rawHint;
                    
                    const rawDetails = errObj?.details || errObj?.upstream || errObj?.route;
                    const details = rawDetails && typeof rawDetails === "object" ? JSON.stringify(rawDetails) : rawDetails;

                    return (
                      <div className="space-y-4 font-sans text-sm">
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-5">
                          <div className="flex items-start space-x-3.5">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-500/5 border border-rose-500/30">
                              <AlertTriangle className="w-5 h-5 animate-pulse" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 px-2 py-0.5 bg-rose-500/20 rounded-md border border-rose-500/30">
                                  {finalStatus > 0 ? `HTTP ${finalStatus}` : "Connection Failure"}
                                </span>
                                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                  via {provider}
                                </span>
                              </div>
                              <h3 className="text-base font-extrabold text-white mt-2 leading-snug">
                                {errMsg}
                              </h3>
                              {details && (
                                <p className="text-xs text-slate-400 font-mono mt-1.5 px-2.5 py-1 bg-slate-900/60 rounded-lg border border-slate-800/80 inline-block max-w-full truncate">
                                  {details}
                                </p>
                              )}
                            </div>
                          </div>

                          {hint && (
                            <div className="mt-4 flex items-start space-x-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-3.5 text-xs leading-relaxed">
                              <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                              <div>
                                <span className="font-extrabold text-amber-400 block mb-0.5">Saran Pemecahan Masalah:</span>
                                {hint}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
                          <button
                            onClick={() => setShowRawError(!showRawError)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/40 hover:bg-slate-900/85 transition-colors text-xs font-bold text-slate-400 hover:text-slate-200 outline-none"
                          >
                            <span>LIHAT DETAIL RAW JSON</span>
                            {showRawError && <ChevronUp className="w-4 h-4" />}
                            {!showRawError && <ChevronDown className="w-4 h-4" />}
                          </button>
                          {showRawError && (
                            <div className="p-4 border-t border-slate-800 bg-slate-950/80 max-h-80 overflow-y-auto hidden-scrollbar">
                              <pre
                                className="font-mono text-[13.5px] leading-relaxed overflow-x-auto select-text text-slate-300"
                                dangerouslySetInnerHTML={{
                                  __html: highlightJson(parsedData),
                                }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return isPrettyPrint ? (
                    <pre
                      className="font-mono text-[13.5px] leading-relaxed overflow-x-auto select-text text-slate-300"
                      dangerouslySetInnerHTML={{
                        __html: highlightJson(parsedData),
                      }}
                    />
                  ) : (
                    <pre className="font-mono text-[13px] leading-relaxed overflow-x-auto select-text text-slate-300 whitespace-pre-wrap break-all">
                      {typeof response.data === "string" ? response.data : JSON.stringify(response.data)}
                    </pre>
                  );
                })()}

                {responseTab === "preview" && (
                  <iframe
                    srcDoc={typeof response.data === "string" ? response.data : JSON.stringify(response.data)}
                    className="w-full h-full bg-white border-0 rounded-lg"
                    sandbox="allow-scripts"
                  />
                )}
                {responseTab === "headers" && (
                  <pre
                    className="font-mono text-[13.5px] leading-relaxed overflow-x-auto select-text"
                    dangerouslySetInnerHTML={{
                      __html: highlightJson(response.headers || {}),
                    }}
                  />
                )}
                {responseTab === "cookies" && (
                  <pre
                    className="font-mono text-[13.5px] leading-relaxed overflow-x-auto select-text"
                    dangerouslySetInnerHTML={{
                      __html: highlightJson(response.cookies || []),
                    }}
                  />
                )}
                {responseTab === "history" && (
                  <div className="space-y-3">
                    {history.length === 0 && (
                      <div className="text-slate-500">Belum ada history.</div>
                    )}
                    {history.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => applyHistoryEntry(item)}
                        className="w-full text-left p-3 rounded-xl border border-slate-800 hover:border-slate-600 bg-slate-950/40 hover:bg-slate-900/60 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <History className="w-4 h-4 text-slate-500" />
                            <span
                              className={cn(
                                "text-xs font-bold",
                                getStatusColor(item.status),
                              )}
                            >
                              {item.status}
                            </span>
                            <span className="text-xs text-slate-400">
                              {item.method}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500">
                            {item.size}
                          </span>
                        </div>
                        <div className="text-xs text-slate-300 mt-1 truncate">
                          {item.url}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-600 space-y-4">
                <Code className="w-12 h-12 opacity-20" />
                <p>Kirim request untuk melihat response</p>
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>

      {isEnvModalOpen && (
        <EnvironmentsModal
          environments={environments}
          setEnvironments={setEnvironments}
          activeEnvId={activeEnvId}
          setActiveEnvId={setActiveEnvId}
          onClose={() => setIsEnvModalOpen(false)}
        />
      )}

      {isSnippetModalOpen && (
        <CodeSnippetsModal
          requestConfig={{
            method,
            url: requestUrl,
            headers: Object.fromEntries(headers.filter(h => h.active && h.key).map(h => [h.key, h.value])),
            body: bodyType === "raw" ? bodyContent : undefined
          }}
          onClose={() => setIsSnippetModalOpen(false)}
        />
      )}
    </motion.div>
  );
}
