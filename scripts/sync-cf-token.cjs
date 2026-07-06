// ============================================================
// Sync Cloudflare Access token dari cache cloudflared ke .env
// ============================================================
// cloudflared menyimpan token JWT di ~/.cloudflared/ dengan dua format:
//   • Lama: <hostname-with-dashes>.token       (mis. ssh-kii-lat.token)
//   • Baru: <hostname>-<aud-hash>-token        (mis. ssh.kii.lat-1f1e74...token)
//
// Script ini:
// 1. Scan kedua format
// 2. Pilih cache yang paling baru (exp paling jauh & masih valid)
// 3. Update baris CF_ACCESS_TOKEN_<key> di .env
//
// Pemakaian:
//   node scripts/sync-cf-token.cjs              # default ssh.kii.lat
//   node scripts/sync-cf-token.cjs ssh.kii.lat  # hostname spesifik

const { readFileSync, writeFileSync, existsSync, readdirSync } = require("fs");
const { homedir } = require("os");
const { join } = require("path");

function decodeJwtPayload(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const padded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf-8"));
  } catch {
    return null;
  }
}

function fmt(ts) {
  return new Date(ts * 1000).toISOString();
}

function findCacheFiles(hostname) {
  const dir = join(homedir(), ".cloudflared");
  if (!existsSync(dir)) return [];
  const dashed = hostname.replace(/\./g, "-").replace(/_/g, "-");
  const matches = [];
  for (const f of readdirSync(dir)) {
    if (f === `${dashed}.token`) {
      matches.push(join(dir, f));
      continue;
    }
    if (
      f.startsWith(`${hostname}-`) &&
      (f.endsWith("-token") || f.endsWith(".token"))
    ) {
      matches.push(join(dir, f));
    }
  }
  return matches;
}

function envKeyFor(hostname) {
  return "CF_ACCESS_TOKEN_" + hostname.replace(/\./g, "_").replace(/-/g, "_");
}

function syncOne(hostname) {
  const cacheFiles = findCacheFiles(hostname);
  if (cacheFiles.length === 0) {
    console.log(`❌ Tidak ada file cache cloudflared untuk '${hostname}'.`);
    console.log(`   Jalanin dulu: cloudflared access login ${hostname}`);
    return false;
  }

  // Pilih cache dengan exp paling jauh
  let best = null;
  for (const f of cacheFiles) {
    try {
      const token = readFileSync(f, "utf-8").trim();
      const p = decodeJwtPayload(token);
      if (!p) continue;
      if (!best || (p.exp || 0) > (best.payload.exp || 0)) {
        best = { file: f, token, payload: p };
      }
    } catch {
      /* ignore */
    }
  }

  if (!best) {
    console.log(`❌ Semua file cache '${hostname}' tidak bisa di-decode.`);
    return false;
  }

  const now = Date.now() / 1000;
  if (best.payload.exp && best.payload.exp < now) {
    console.log(
      `❌ Cache token '${hostname}' SUDAH EXPIRED (exp=${fmt(best.payload.exp)}).`,
    );
    console.log(`   Login ulang: cloudflared access login ${hostname}`);
    return false;
  }

  const envKey = envKeyFor(hostname);
  const envPath = join(__dirname, "..", ".env");
  if (!existsSync(envPath)) {
    console.log(`❌ .env tidak ada di ${envPath}`);
    return false;
  }

  let envContent = readFileSync(envPath, "utf-8");
  const lineRegex = new RegExp(`^${envKey}=.*$`, "m");

  if (lineRegex.test(envContent)) {
    envContent = envContent.replace(lineRegex, `${envKey}=${best.token}`);
  } else {
    if (!envContent.endsWith("\n")) envContent += "\n";
    envContent += `${envKey}=${best.token}\n`;
  }

  writeFileSync(envPath, envContent, "utf-8");
  console.log(
    `✅ ${envKey} di-update di .env (sumber: ${best.file}, exp=${fmt(best.payload.exp)})`,
  );
  return true;
}

const args = process.argv.slice(2);
const hostnames = args.length > 0 ? args : ["ssh.kii.lat"];

console.log(`Sync ${hostnames.length} token Cloudflare Access ke .env...\n`);
let okCount = 0;
hostnames.forEach((h) => {
  if (syncOne(h)) okCount++;
});
console.log(`\n${okCount}/${hostnames.length} token berhasil di-sync.`);
process.exit(okCount === hostnames.length ? 0 : 1);
