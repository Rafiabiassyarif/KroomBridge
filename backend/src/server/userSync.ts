import { db, Client, Package } from "./db.js";

const USERS_API_URL = "https://panel.kroombox.com/api/admin/users";
const API_KEY = process.env.PANEL_API_KEY;

function findMatchingBridgePackage(userPlan: string, packages: Package[]): Package | null {
  if (!userPlan) return null;
  const cleaned = userPlan.trim().toLowerCase();
  const normalized = cleaned.replace(/[-_\s]/g, "");

  // Abaikan string non-paket
  if (["none", "no plan", "null", "undefined", "-", "inactive", "belum", "tidak ada", "unsubscribed", "trial_ended"].includes(cleaned)) {
    return null;
  }

  // 1. Jika di Panel Kroombox plan-nya adalah "Basic", "Free", atau "Gratis":
  // Ini adalah akun Free Tier bawaan Panel -> Petakan ke paket FREE di KroomBridge!
  const isFreeOrBasic = 
    cleaned.includes("free") || 
    cleaned.includes("gratis") || 
    cleaned === "basic" || 
    cleaned === "basic plan";

  if (isFreeOrBasic) {
    const freePkg = packages.find((p) => p.id === "pkg_free" || p.name.toLowerCase().includes("free") || p.name.toLowerCase().includes("gratis"));
    if (freePkg) return freePkg;
  }

  // 2. Paket Starter
  if (cleaned === "starter" || cleaned === "starter plan" || cleaned === "paket starter") {
    const starterPkg = packages.find((p) => p.id === "pkg_starter" || p.name.toLowerCase() === "starter");
    if (starterPkg) return starterPkg;
  }

  // 3. Paket Pro
  if (cleaned === "pro" || cleaned === "pro plan" || cleaned === "paket pro" || cleaned.includes("creator pro")) {
    const proPkg = packages.find((p) => p.id === "pkg_pro" || p.name.toLowerCase() === "pro");
    if (proPkg) return proPkg;
  }

  // 4. Paket Business & Enterprise
  if (cleaned.includes("business")) {
    const bizPkg = packages.find((p) => p.id === "pkg_business" || p.name.toLowerCase().includes("business"));
    if (bizPkg) return bizPkg;
  }
  if (cleaned.includes("enterprise")) {
    const entPkg = packages.find((p) => p.id === "pkg_enterprise" || p.name.toLowerCase().includes("enterprise"));
    if (entPkg) return entPkg;
  }

  // Selain paket-paket di atas (misal paket server VPS: Dedicated JS Stack, Minibox, dll.)
  // -> BUKAN PAKET API -> RETURN NULL (Otomatis Diabaikan/Di-skip!)
  return null;
}

export const syncUsersToClients = async () => {
  console.log("[UserSync] Memulai sinkronisasi users dari panel...");
  try {
    const res = await fetch(USERS_API_URL, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      throw new Error(`Gagal mengambil data users: ${res.statusText}`);
    }

    const users = await res.json();
    console.log(`[UserSync] Ditemukan ${users.length} users di Panel.`);

    const existingClients = db.getClients();
    const existingPackages = db.getPackages();
    let updatedCount = 0;
    let addedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      // 1. Cari klien yang SUDAH ADA dengan multi-level matching agar TIDAK DUPLIKAT:
      // Cocokkan ID, tag external, email, atau username
      const existingClient = existingClients.find(
        (c) =>
          c.id === user.id ||
          (user.id && c.tags?.includes(`external:${user.id}`)) ||
          (user.email && c.email && c.email.toLowerCase() === user.email.toLowerCase()) ||
          (user.username && c.name && c.name.toLowerCase() === user.username.toLowerCase())
      );

      // 2. Filter status: Hanya user dengan status ACTIVE yang boleh masuk
      const isActive = String(user.status || "").toUpperCase() === "ACTIVE";

      if (!isActive) {
        // Jika user tidak aktif dan belum ada di KroomBridge, lewati
        if (!existingClient) {
          skippedCount++;
          continue;
        }
        // Jika sudah ada sebelumnya, update statusnya menjadi suspended
        db.updateClient(existingClient.id, { isActive: false, status: "suspended" });
        updatedCount++;
        continue;
      }

      // 3. Filter paket: Harus punya informasi paket API yang valid
      const planName = user.apiPlan || user.planDetails?.name || user.plan;
      if (!planName) {
        skippedCount++;
        continue;
      }

      // 4. Filter paket KroomBridge: Hanya masukkan jika user BENAR-BENAR menggunakan paket milik KroomBridge
      const pkg = findMatchingBridgePackage(planName, existingPackages);
      if (!pkg) {
        // Bukan paket API KroomBridge -> lewati (jangan dimasukkan ke KroomBridge)
        skippedCount++;
        continue;
      }

      const mergedTags = [
        ...new Set([
          `external:${user.id}`,
          ...(existingClient?.tags || []),
          user.userCategory,
          user.role,
        ].filter(Boolean) as string[]),
      ];

      const clientPayload: Partial<Client> & Omit<Client, "createdAt" | "usageThisMonth"> = {
        id: existingClient ? existingClient.id : user.id,
        name: user.fullName || user.username || existingClient?.name || "Client",
        email: user.email || existingClient?.email,
        packageId: pkg.id,
        isActive: isActive,
        status: isActive ? "active" : "suspended",
        tags: mergedTags,
        notes: `Synced from Kroombox Panel. Plan: ${user.plan || pkg.name}`,
        secretKey: existingClient ? existingClient.secretKey : `sk_${user.id}_${Math.random().toString(36).substring(2, 10)}`
      };

      if (existingClient) {
        db.updateClient(existingClient.id, clientPayload);
        updatedCount++;
      } else {
        const newClient: Client = {
          ...clientPayload,
          usageThisMonth: 0,
          createdAt: new Date().toISOString()
        } as Client;
        db.createClient(newClient);
        existingClients.push(newClient);
        addedCount++;
      }
    }

    console.log(
      `[UserSync] Sinkronisasi selesai: ${addedCount} ditambahkan, ${updatedCount} diperbarui, ${skippedCount} dilewati (bukan paket KroomBridge atau tidak aktif).`
    );
    return { success: true, addedCount, updatedCount, skippedCount, totalFound: users.length };

  } catch (error: any) {
    console.error("[UserSync] Error:", error.message);
    return { success: false, error: error.message };
  }
};
