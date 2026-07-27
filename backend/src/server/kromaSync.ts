import { db, Route } from "./db.js";

const KROMA_API_URL = process.env.KROMA_API_URL || "https://kroma.kroombox.com";

export const syncKromaRoutes = async () => {
  const meta = db.getMeta();
  const apiKey = meta.apiKeys?.find(k => k.provider === 'kroma')?.key || meta.kromaApiKey || process.env.KROMA_API_KEY;

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
      const upstreamUrl = `${KROMA_API_URL}${ep.path}`;
      const gatewayPath = `/gateway/kroma${ep.path}`;

      const existingRoute = existingRoutes.find(r => r.path === gatewayPath);

      const routePayload: Partial<Route> & Omit<Route, "id" | "createdAt"> = {
        path: gatewayPath,
        upstreamUrl: upstreamUrl,
        description: ep.desc,
        isActive: true,
        method: "ALL",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "x-api-key": apiKey
        },
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
