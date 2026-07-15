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
    const res = await fetch(`${KROMA_API_URL}/api/apis`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      }
    });

    if (!res.ok) {
      throw new Error(`Gagal mengambil data dari Kroma AI: ${res.statusText}`);
    }

    const models = await res.json();
    console.log(`[KromaSync] Ditemukan ${models.length} model Kroma AI.`);

    const existingRoutes = db.getRoutes();
    let updatedCount = 0;
    let addedCount = 0;

    for (const model of models) {
      const endpoint = model.endpoint.startsWith('/') ? model.endpoint : `/${model.endpoint}`;
      const upstreamUrl = `${KROMA_API_URL}${endpoint}`;
      // Misal endpoint /v1/chat/completions -> gateway /gateway/kroma/v1/chat/completions
      const gatewayPath = `/gateway/kroma${endpoint}`;

      const existingRoute = existingRoutes.find(r => r.path === gatewayPath);

      const routePayload: Partial<Route> & Omit<Route, "id" | "createdAt"> = {
        path: gatewayPath,
        upstreamUrl: upstreamUrl,
        description: `Model Kroma AI: ${model.name} (${model.type}) - ${model.description}`,
        isActive: true,
        method: "ALL", // atau bisa model.type == 'text-to-image' ? 'POST' : 'POST' (tapi biarkan ALL agar fleksibel)
        headers: {
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
