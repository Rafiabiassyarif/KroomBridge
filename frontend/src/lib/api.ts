/// <reference types="vite/client" />
const API_URL = import.meta.env.VITE_API_URL || "";

export const getFullApiUrl = (path: string) => {
  if (!API_URL || !path.startsWith("/api/")) return path;
  const base = API_URL.replace(/\/$/, "");
  return `${base}${path.substring(4)}`;
};

export const adminFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  let resource = input;
  let config = init || {};

  if (typeof resource === "string") {
    resource = getFullApiUrl(resource);
  }

  if (
    typeof input === "string" &&
    (input.startsWith("/api/admin") || input.startsWith("/api/proxy")) &&
    input !== "/api/admin/login"
  ) {
    const token = sessionStorage.getItem("kroombridge_admin_token");
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }

  const controller = new AbortController();
  // Hanya pakai timeout internal kalau caller tidak menyediakan signal sendiri.
  // ApiTester mengirim signal sendiri (untuk tombol cancel & request panjang).
  let timeout: ReturnType<typeof setTimeout> | undefined;
  if (!config.signal) {
    timeout = setTimeout(() => controller.abort(), 15000);
  }

  config.signal = config.signal || controller.signal;

  let res: Response;
  try {
    res = await fetch(resource, config);
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  // Jika Unauthorized, mungkin token kedaluwarsa atau RBAC error
  // UI logic components will handle the response errors.
  return res;
};
