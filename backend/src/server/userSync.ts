import { db, Client, Package } from "./db.js";

const USERS_API_URL = "https://panel.kroombox.com/api/admin/users";
const API_KEY = process.env.PANEL_API_KEY;

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
    console.log(`[UserSync] Ditemukan ${users.length} users.`);

    const existingClients = db.getClients();
    const existingPackages = db.getPackages();
    let updatedCount = 0;
    let addedCount = 0;

    for (const user of users) {
      // Find or create package based on user.plan
      let pkg = existingPackages.find(p => p.name.toLowerCase() === user.plan?.toLowerCase());
      if (!pkg) {
        const newPkg: Package = {
          id: user.planDetails?.id || `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          name: user.plan || "Default Plan",
          maxRequestsPerMinute: user.planDetails?.maxRequestsPerMinute || 60,
          monthlyQuota: user.planDetails?.monthlyQuota || 100000,
          quotaType: "token",
          allowOverage: user.planDetails?.allowOverage || false,
          overageRatePer1K: user.planDetails?.overageRatePer1K || 0,
          allowedEndpoints: user.planDetails?.allowedEndpoints || ["*"],
          allowedModels: user.planDetails?.allowedModels || ["*"],
          description: `Auto-generated package for plan ${user.plan}`,
          createdAt: new Date().toISOString()
        };
        db.createPackage(newPkg);
        existingPackages.push(newPkg);
        pkg = newPkg;
      } else if (user.planDetails) {
        // Sinkronisasi pembaruan paket dari Panel ke KroomBridge
        const updatedPkg = db.updatePackage(pkg.id, {
          monthlyQuota: user.planDetails.monthlyQuota ?? pkg.monthlyQuota,
          allowedModels: user.planDetails.allowedModels ?? pkg.allowedModels,
          allowedEndpoints: user.planDetails.allowedEndpoints ?? pkg.allowedEndpoints,
          maxRequestsPerMinute: user.planDetails.maxRequestsPerMinute ?? pkg.maxRequestsPerMinute,
        });
        if (updatedPkg) pkg = updatedPkg;
      }

      const existingClient = existingClients.find(c => c.id === user.id);
      const isActive = user.status === "ACTIVE";

      const clientPayload: Partial<Client> & Omit<Client, "createdAt" | "usageThisMonth"> = {
        id: user.id,
        name: user.fullName || user.username,
        email: user.email,
        packageId: pkg.id,
        isActive: isActive,
        status: isActive ? "active" : "suspended",
        tags: [user.userCategory, user.role].filter(Boolean) as string[],
        notes: `Synced from Kroombox Panel. Plan: ${user.plan}`,
        secretKey: existingClient ? existingClient.secretKey : `sk_${user.id}_${Math.random().toString(36).substring(2, 10)}`
      };

      if (existingClient) {
        db.updateClient(existingClient.id, clientPayload);
        updatedCount++;
      } else {
        db.createClient({
          ...clientPayload,
          usageThisMonth: 0,
          createdAt: new Date().toISOString()
        } as Client);
        addedCount++;
      }
    }

    console.log(`[UserSync] Sinkronisasi selesai: ${addedCount} ditambahkan, ${updatedCount} diperbarui.`);
    return { success: true, addedCount, updatedCount, totalFound: users.length };

  } catch (error: any) {
    console.error("[UserSync] Error:", error.message);
    return { success: false, error: error.message };
  }
};
