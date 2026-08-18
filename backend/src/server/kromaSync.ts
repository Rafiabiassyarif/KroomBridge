import { db, Route } from "./db.js";
import {
  KROMA_API_URL,
  NINER_API_URL,
  getKromaApiKey,
  getNinerApiKey,
} from "./modelRegistry.js";

export const syncKromaRoutes = async () => {
  const apiKey = getKromaApiKey();

  if (!apiKey) {
    return { success: false, error: "Kroma API Key belum dikonfigurasi. Silakan atur di menu Settings." };
  }

  console.log("[KromaSync] Memulai sinkronisasi model dari Kroma AI...");
  try {
    const res = await fetch(`${KROMA_API_URL}/v1/models`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "x-api-key": apiKey
      }
    });

    if (!res.ok) {
      throw new Error(`Gagal mengambil data dari Kroma AI: ${res.statusText}`);
    }

    const json = await res.json();
    const models = json.data || [];
    console.log(`[KromaSync] Ditemukan ${models.length} model Kroma AI.`);

    const existingRoutes = db.getRoutes();
    let updatedCount = 0;
    let addedCount = 0;

    const standardEndpoints = [
      { path: "/v1/chat/completions", desc: "Kroma AI Chat Completions" },
      { path: "/v1/models", desc: "Kroma AI Models" },
    ];

    for (const ep of standardEndpoints) {
      // Route default menunjuk ke 9r (LiteLLM). Gateway akan meng-override
      // targetUrl secara runtime berdasarkan model via modelRegistry.
      const upstreamUrl = `${NINER_API_URL}${ep.path}`;
      const authHeaders: Record<string, string> = {
        "Authorization": `Bearer ${getNinerApiKey()}`
      };

      const gatewayPath = `/gateway/kroma${ep.path}`;

      const existingRoute = existingRoutes.find(r => r.path === gatewayPath);

      const routePayload: Partial<Route> & Omit<Route, "id" | "createdAt"> = {
        path: gatewayPath,
        upstreamUrl: upstreamUrl,
        description: ep.desc,
        isActive: true,
        method: "ALL",
        headers: authHeaders,
      };

      if (existingRoute) {
        db.updateRoute(existingRoute.id, routePayload);
        updatedCount++;
      } else {
        const newRouteId = `route_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        db.createRoute({
          id: newRouteId,
          ...routePayload,
          createdAt: new Date().toISOString()
        });
        addedCount++;
      }
    }

    console.log(`[KromaSync] Sinkronisasi selesai: ${addedCount} ditambahkan, ${updatedCount} diperbarui.`);
    return { success: true, addedCount, updatedCount, totalFound: models.length };

  } catch (error: any) {
    console.error("[KromaSync] Error:", error.message);
    return { success: false, error: error.message };
  }
};
