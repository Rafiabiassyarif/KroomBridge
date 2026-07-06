export const adminFetch = async (
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> => {
  let resource = input;
  let config = init || {};

  if (
    typeof resource === "string" &&
    resource.startsWith("/api/admin") &&
    resource !== "/api/admin/login"
  ) {
    const token = sessionStorage.getItem("kroombridge_admin_token");
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      };
    }
  }

  const res = await fetch(resource, config);

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent("auth:unauthorized"));
  }

  // Jika Unauthorized, mungkin token kedaluwarsa atau RBAC error
  // UI logic components will handle the response errors.
  return res;
};
