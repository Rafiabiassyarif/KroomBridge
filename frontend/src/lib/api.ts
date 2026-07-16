const API_URL = import.meta.env.VITE_API_URL || "";

export const adminFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  let resource = input;
  let config = init || {};

  if (typeof resource === "string" && resource.startsWith("/api/")) {
    resource = `${API_URL}${resource.substring(4)}`;
  }

  if (
    typeof input === "string" &&
    input.startsWith("/api/admin") &&
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
  const timeout = setTimeout(() => controller.abort(), 15000);
  
  if (config.signal) {
    // If a signal was already provided, we can't easily merge them in older browsers, 
    // but in modern ones we could use AbortSignal.any. For simplicity, we just use ours.
  }
  config.signal = controller.signal;

  let res: Response;
  try {
    res = await fetch(resource, config);
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  // Jika Unauthorized, mungkin token kedaluwarsa atau RBAC error
  // UI logic components will handle the response errors.
  return res;
};
