// ============================================================
// SSH POLLER — Ambil metrik sistem (CPU/RAM/Disk) via SSH
// ============================================================
// Server KroomBridge SSH ke PC remote tiap N detik dan jalankan
// 1 perintah gabungan yang mengambil:
//   • CPU load + model + cores
//   • Memory used/total
//   • Disk used/total
//   • Uptime + load average
//
// Mendukung:
//   • SSH langsung (LAN)
//   • SSH via Cloudflare Tunnel (cloudflared access tcp)
//   • SSH chain: Cloudflare → bastion (NAS) → target (PC internal IP)

import { Client as SshClient } from "ssh2";
import { readFileSync } from "fs";
import { spawn, ChildProcess } from "child_process";
import { recordGpuMetric } from "./gpuMetrics.js";
import { Duplex } from "stream";
import { createServer, AddressInfo } from "net";
import { connect as netConnect, Socket } from "net";

interface SshHostConfig {
  hostId: string;
  hostName: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: Buffer;
  privateKeyPath?: string;
  cloudflareHostname?: string;
  // Kalau true, host ini di-akses langsung via cloudflare (cloudflared
  // langsung connect ke SSH server di hostname ini). Kalau false, host
  // ini di-akses VIA bastion yang reachable via cloudflare.
  cfDirect?: boolean;
  jumpConfig?: JumpConfig;
}

const POLL_INTERVAL_MS = parseInt(
  process.env.GPU_SSH_POLL_INTERVAL_MS || "60000",
);

// Timeout untuk satu kali eksekusi SSH command. Handshake awal SSH chain
// (cloudflared tunnel + bastion + target) kadang butuh 10-15 detik di
// koneksi yang lambat / round-trip tinggi. Setelah pool koneksi terbentuk,
// command berikutnya cuma butuh 1-3 detik. Set lebih longgar (25s) supaya
// poll pertama tidak salah dibilang offline.
const SSH_COMMAND_TIMEOUT_MS = parseInt(
  process.env.GPU_SSH_COMMAND_TIMEOUT_MS || "25000",
);

// Timeout khusus handshake SSH (lebih ketat dari command timeout supaya
// kalau handshake stuck, kita bisa fallback cepat).
const SSH_READY_TIMEOUT_MS = parseInt(
  process.env.GPU_SSH_READY_TIMEOUT_MS || "20000",
);

// Timeout cloudflared tunnel pertama kali listen (handshake websocket).
const CF_TUNNEL_TIMEOUT_MS = parseInt(
  process.env.GPU_CF_TUNNEL_TIMEOUT_MS || "20000",
);

// ─── COMMAND TEMPLATE ──────────────────────────────────────
// Poller fokus pada metrik sistem (CPU/RAM/Disk/Uptime). GPU monitoring
// di-skip — kompleksitas NVML version mismatch tanpa reboot tidak
// reliable di production (apt-get download ke folder user gak selalu
// dapet versi yang match dengan kernel module).
function buildSystemCmd(_cfg: SshHostConfig): string {
  return [
    "echo '###CPU###'",
    "(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2 | xargs || echo 'unknown')",
    "(nproc 2>/dev/null || echo 0)",
    "(awk '/^cpu / {idle1=$5; total1=0; for(i=2;i<=NF;i++) total1+=$i} END {print idle1, total1}' /proc/stat)",
    "sleep 0.3",
    "(awk '/^cpu / {idle2=$5; total2=0; for(i=2;i<=NF;i++) total2+=$i} END {print idle2, total2}' /proc/stat)",
    "echo '###MEM###'",
    "(awk '/MemTotal:/ {t=$2} /MemAvailable:/ {a=$2} END {print t, a}' /proc/meminfo)",
    "echo '###DISK###'",
    "(df -k / 2>/dev/null | awk 'NR==2 {print $2, $3}' || echo '0 0')",
    "echo '###UPTIME###'",
    "(cat /proc/uptime 2>/dev/null | awk '{print $1}' || echo 0)",
    "(cat /proc/loadavg 2>/dev/null | awk '{print $1, $2, $3}' || echo '0 0 0')",
  ].join("; ");
}

// ─── Parse Konfigurasi ─────────────────────────────────────
function parseHosts(): SshHostConfig[] {
  const raw = process.env.GPU_SSH_HOSTS;
  if (!raw || !raw.trim()) return [];

  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const parts = entry.split(":");
      if (parts.length < 5) {
        console.warn(
          `[SSH Poller] ⚠️  Format konfigurasi salah: '${entry}'. Lewati.`,
        );
        return null;
      }
      const [hostId, host, portStr, username, ...rest] = parts;
      const port = parseInt(portStr) || 22;

      let credential = "";
      let cloudflareHostname: string | undefined;
      let customJump: JumpConfig | undefined;

      let remaining = rest.join(":");

      const jumpMatch = remaining.match(/(?:^|:)jump=([^,]+)$/);
      if (jumpMatch) {
        const jumpStr = jumpMatch[1];
        remaining = remaining.slice(0, jumpMatch.index).replace(/:$/, "");
        const jp = jumpStr.split(":");
        if (jp.length >= 4) {
          const [jHost, jPortStr, jUser, ...jRest] = jp;
          const jCred = jRest.join(":");
          customJump = {
            host: jHost,
            port: parseInt(jPortStr) || 22,
            username: jUser,
          };
          if (jCred.startsWith("password="))
            customJump.password = jCred.slice(9);
          else {
            try {
              customJump.privateKey = readFileSync(jCred);
            } catch (e: any) {
              console.error(`[SSH Poller] ❌ Jump key error: ${e.message}`);
            }
          }
        }
      }

      const cfMatch = remaining.match(/(?:^|:)cf=([^,:]+)$/);
      if (cfMatch) {
        cloudflareHostname = cfMatch[1].trim();
        remaining = remaining.slice(0, cfMatch.index).replace(/:$/, "");
      }
      credential = remaining;

      // host="dummy" artinya host akses langsung via cloudflare (tidak hop)
      // host=IP private artinya host akses via bastion yang ada di cloudflare
      const cfDirect = cloudflareHostname
        ? host === "dummy" || host === cloudflareHostname
        : false;

      const config: SshHostConfig = {
        hostId,
        hostName: hostIdToName(hostId),
        host,
        port,
        username,
        cloudflareHostname,
        cfDirect,
        jumpConfig: customJump,
      };

      if (credential.startsWith("password=")) {
        config.password = credential.slice("password=".length);
      } else {
        config.privateKeyPath = credential;
        try {
          config.privateKey = readFileSync(credential);
        } catch (err: any) {
          console.error(
            `[SSH Poller] ❌ Gagal baca private key '${credential}': ${err.message}`,
          );
          return null;
        }
      }

      return config;
    })
    .filter((c): c is SshHostConfig => c !== null);
}

interface JumpConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: Buffer;
}

function parseJumpConfig(): JumpConfig | null {
  const raw = process.env.GPU_SSH_JUMP;
  if (!raw || !raw.trim()) return null;

  const parts = raw.trim().split(":");
  if (parts.length < 4) {
    console.warn(
      `[SSH Poller] ⚠️  Format GPU_SSH_JUMP salah. Harus: host:port:user:credential`,
    );
    return null;
  }

  const [host, portStr, username, ...rest] = parts;
  const credential = rest.join(":");
  const port = parseInt(portStr) || 22;

  const config: JumpConfig = { host, port, username };

  if (credential.startsWith("password=")) {
    config.password = credential.slice("password=".length);
  } else {
    try {
      config.privateKey = readFileSync(credential);
    } catch (err: any) {
      console.error(
        `[SSH Poller] ❌ Gagal baca jump private key '${credential}': ${err.message}`,
      );
      return null;
    }
  }

  return config;
}

function hostIdToName(id: string): string {
  return id
    .split("-")
    .map((s) => {
      if (s.toLowerCase() === "pc") return "PC";
      if (s.toLowerCase() === "gpu") return "GPU";
      return s.charAt(0).toUpperCase() + s.slice(1);
    })
    .join(" ");
}

// ─── Cloudflared TCP Tunnel ────────────────────────────────
// Spawn `cloudflared access tcp --hostname X --url localhost:PORT`
// yang bikin local TCP listener. Lalu kita connect via net.Socket
// ke localhost:PORT, dan stream socket itu kasih ke ssh2 sebagai 'sock'.
// Cara ini lebih reliable daripada pipe stdio karena cloudflared
// handle protocol-nya secara penuh.

interface CfTunnel {
  proc: ChildProcess;
  localPort: number;
  hostname: string;
}

const tunnelCache: Map<string, Promise<CfTunnel>> = new Map();

// Rate-limit "Tunnel exit" warnings supaya gak spam log saat origin
// tunnel di sisi bastion offline (CF Error 1033). Print sekali per
// 30 detik per hostname.
const tunnelExitLogTime: Map<string, number> = new Map();

// Circuit breaker: kalau tunnel exit dengan CF Error 1033 (origin tunnel
// offline) berulang kali, jangan terus-terusan bikin tunnel baru karena
// gak akan sukses sampai cloudflared di sisi origin (NAS) hidup lagi.
// Tahan upayanya selama N detik, dashboard akan tetap nampilin offline.
interface CircuitState {
  failures: number;
  openUntil: number;
}
const tunnelCircuit: Map<string, CircuitState> = new Map();
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_OPEN_DURATION_MS = 60_000;

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const port = (srv.address() as AddressInfo).port;
      srv.close(() => resolve(port));
    });
  });
}

function spawnCloudflaredTcpTunnel(hostname: string): Promise<CfTunnel> {
  // Reuse tunnel kalau hostname sama (1 tunnel = banyak SSH sessions)
  if (tunnelCache.has(hostname)) {
    return tunnelCache.get(hostname)!;
  }

  // Circuit breaker: kalau tunnel terus-menerus exit dengan CF error
  // (origin offline), tahan upaya selama X detik supaya gak spawn
  // cloudflared 100×/menit ke endpoint yg pasti gagal.
  const circuit = tunnelCircuit.get(hostname);
  if (circuit && circuit.openUntil > Date.now()) {
    const remainSec = Math.ceil((circuit.openUntil - Date.now()) / 1000);
    return Promise.reject(
      new Error(
        `cloudflared tunnel '${hostname}' offline (CF Error 1033 atau origin unreachable). ` +
          `Circuit breaker open, retry dalam ${remainSec}s. ` +
          `Pastikan cloudflared daemon di sisi bastion hidup.`,
      ),
    );
  }

  const promise = (async () => {
    const localPort = await findFreePort();
    const proc = spawn(
      "cloudflared",
      [
        "access",
        "tcp",
        "--hostname",
        hostname,
        "--url",
        `127.0.0.1:${localPort}`,
        "--loglevel",
        "warn",
      ],
      { stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
    );

    return new Promise<CfTunnel>((resolve, reject) => {
      let resolved = false;
      let stderrBuf = "";

      proc.stderr?.on("data", (chunk: Buffer) => {
        const s = chunk.toString();
        stderrBuf += s;
        if (process.env.DEBUG_CLOUDFLARED) {
          process.stderr.write(`[cf:${hostname}] ${chunk}`);
        }
      });

      proc.stdout?.on("data", (chunk: Buffer) => {
        if (process.env.DEBUG_CLOUDFLARED) {
          process.stdout.write(`[cf:${hostname}] ${chunk}`);
        }
      });

      proc.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          tunnelCache.delete(hostname);
          reject(
            new Error(
              `cloudflared spawn gagal: ${err.message}. Pastikan 'cloudflared' terinstall di PATH (winget install Cloudflare.cloudflared).`,
            ),
          );
        }
      });

      proc.on("exit", (code, signal) => {
        tunnelCache.delete(hostname);
        const isCfDown =
          stderrBuf.includes("error code: 1033") ||
          stderrBuf.includes("websocket: bad handshake") ||
          stderrBuf.includes("Cannot reach origin");

        // Update circuit breaker kalau detect CF Error 1033
        if (isCfDown) {
          const c = tunnelCircuit.get(hostname) || {
            failures: 0,
            openUntil: 0,
          };
          c.failures += 1;
          if (c.failures >= CIRCUIT_FAILURE_THRESHOLD) {
            c.openUntil = Date.now() + CIRCUIT_OPEN_DURATION_MS;
            c.failures = 0;
          }
          tunnelCircuit.set(hostname, c);
        } else if (code === 0) {
          tunnelCircuit.delete(hostname);
        }

        if (!resolved) {
          resolved = true;
          reject(
            new Error(
              `cloudflared exit code=${code} signal=${signal}. ` +
                (isCfDown
                  ? `CF Error 1033: origin tunnel offline. Cek cloudflared daemon di sisi bastion '${hostname}'.`
                  : `Cek: 1) cloudflared sudah login (cloudflared access login ${hostname})? ` +
                    `2) hostname '${hostname}' valid? Stderr: ${stderrBuf.slice(0, 300) || "(kosong)"}`),
            ),
          );
        } else {
          const now = Date.now();
          const last = tunnelExitLogTime.get(hostname) || 0;
          if (now - last > 30_000) {
            tunnelExitLogTime.set(hostname, now);
            const hint = isCfDown
              ? ` [CF Error 1033: origin tunnel offline — cloudflared daemon di sisi bastion '${hostname}' sedang mati]`
              : "";
            console.warn(
              `[SSH Poller] ⚠️  Tunnel '${hostname}' exit (code=${code}).${hint}`,
            );
          }
        }
      });

      const startedAt = Date.now();
      const TRY_INTERVAL = 200;
      const TIMEOUT_MS = CF_TUNNEL_TIMEOUT_MS;

      const tryConnect = () => {
        const test = netConnect({ port: localPort, host: "127.0.0.1" });
        test.once("connect", () => {
          test.end();
          if (!resolved) {
            resolved = true;
            resolve({ proc, localPort, hostname });
          }
        });
        test.once("error", () => {
          if (Date.now() - startedAt > TIMEOUT_MS) {
            if (!resolved) {
              resolved = true;
              proc.kill();
              tunnelCache.delete(hostname);
              reject(
                new Error(
                  `cloudflared tunnel '${hostname}' timeout (${TIMEOUT_MS}ms). ` +
                    `Stderr: ${stderrBuf.slice(0, 300) || "(kosong)"}`,
                ),
              );
            }
            return;
          }
          setTimeout(tryConnect, TRY_INTERVAL);
        });
      };
      setTimeout(tryConnect, 300);
    });
  })();

  tunnelCache.set(hostname, promise);
  promise.catch(() => tunnelCache.delete(hostname));
  return promise;
}

function getTcpSocket(host: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = netConnect({ host, port });
    sock.once("connect", () => resolve(sock));
    sock.once("error", reject);
  });
}

// ─── Persistent connection pool ────────────────────────────
interface PooledConnection {
  bastion: SshClient | null;
  target: SshClient;
  cfSocket: Socket | null;
}

const connectionPool: Map<string, PooledConnection> = new Map();

async function getOrCreateConnection(
  cfg: SshHostConfig,
  jump: JumpConfig | null,
): Promise<PooledConnection> {
  const existing = connectionPool.get(cfg.hostId);
  if (existing) {
    try {
      const ok = await testConnection(existing.target);
      if (ok) return existing;
    } catch {
      /* fall through */
    }
    closeConnection(cfg.hostId);
  }

  const conn = await createConnection(cfg, jump);
  connectionPool.set(cfg.hostId, conn);
  return conn;
}

function testConnection(client: SshClient): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(false);
      }
    }, 3000);
    try {
      client.exec(":", (err, stream) => {
        if (done) return;
        if (err) {
          done = true;
          clearTimeout(timer);
          return resolve(false);
        }
        stream
          .on("close", () => {
            if (!done) {
              done = true;
              clearTimeout(timer);
              resolve(true);
            }
          })
          .on("error", () => {
            if (!done) {
              done = true;
              clearTimeout(timer);
              resolve(false);
            }
          });
      });
    } catch {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolve(false);
      }
    }
  });
}

function closeConnection(hostId: string) {
  const c = connectionPool.get(hostId);
  if (!c) return;
  try {
    c.target.end();
  } catch {}
  try {
    c.bastion?.end();
  } catch {}
  try {
    c.cfSocket?.destroy();
  } catch {}
  connectionPool.delete(hostId);
}

async function createConnection(
  cfg: SshHostConfig,
  jump: JumpConfig | null,
): Promise<PooledConnection> {
  let bastionConn: SshClient | null = null;
  let targetConn: SshClient | null = null;
  let cfSocket: Socket | null = null;

  let useBastion = false;
  let initialSocket: Socket;

  if (cfg.cloudflareHostname && cfg.cfDirect) {
    const tunnel = await spawnCloudflaredTcpTunnel(cfg.cloudflareHostname);
    initialSocket = await getTcpSocket("127.0.0.1", tunnel.localPort);
  } else if (cfg.cloudflareHostname && !cfg.cfDirect) {
    const tunnel = await spawnCloudflaredTcpTunnel(cfg.cloudflareHostname);
    cfSocket = await getTcpSocket("127.0.0.1", tunnel.localPort);
    initialSocket = cfSocket;
    useBastion = true;
  } else if (cfg.jumpConfig || jump) {
    const activeJump = cfg.jumpConfig || jump;
    cfSocket = await getTcpSocket(activeJump!.host, activeJump!.port);
    initialSocket = cfSocket;
    useBastion = true;
  } else {
    initialSocket = await getTcpSocket(cfg.host, cfg.port);
  }

  if (useBastion) {
    const activeJump = cfg.jumpConfig || jump;
    const bastionCreds = activeJump || {
      username: cfg.username,
      password: cfg.password,
      privateKey: cfg.privateKey,
    };

    bastionConn = await new Promise<SshClient>((resolve, reject) => {
      const c = new SshClient();
      c.on("ready", () => resolve(c));
      c.on("error", reject);
      c.connect({
        sock: initialSocket as unknown as Duplex,
        username: bastionCreds.username,
        password: bastionCreds.password,
        privateKey: bastionCreds.privateKey,
        readyTimeout: SSH_READY_TIMEOUT_MS,
        keepaliveInterval: 15_000,
        keepaliveCountMax: 3,
      });
    });

    let fwdStream: Duplex | null = null;
    try {
      fwdStream = await new Promise<Duplex>((resolve, reject) => {
        bastionConn!.forwardOut(
          "127.0.0.1",
          0,
          cfg.host,
          cfg.port,
          (err, stream) => {
            if (err) return reject(err);
            resolve(stream as unknown as Duplex);
          },
        );
      });
    } catch {
      // Fallback: bastion menolak direct-tcpip (umum di Synology).
      // Pakai exec sebagai pipe TCP via socat / ncat / nc / bash /dev/tcp / python3.
      const host = cfg.host;
      const port = cfg.port;
      const proxyCandidates = [
        `if command -v socat >/dev/null 2>&1; then exec socat - TCP:${host}:${port}; fi`,
        `if command -v ncat >/dev/null 2>&1; then exec ncat --no-shutdown ${host} ${port}; fi`,
        `if command -v nc >/dev/null 2>&1; then exec nc -N ${host} ${port} 2>/dev/null || exec nc ${host} ${port}; fi`,
        `if command -v bash >/dev/null 2>&1; then exec bash -c 'exec 3<>/dev/tcp/${host}/${port}; cat <&3 & cat >&3; wait'; fi`,
        `if command -v python3 >/dev/null 2>&1; then exec python3 -u -c 'import socket,sys,os,threading; s=socket.create_connection(("${host}",${port})); out=os.fdopen(sys.stdout.fileno(),"wb",0); inn=os.fdopen(sys.stdin.fileno(),"rb",0); t=threading.Thread(target=lambda:([ (s.sendall(d) or None) for d in iter(lambda:inn.read(4096),b\"\")])); t.daemon=True; t.start(); [(out.write(d) or None) for d in iter(lambda:s.recv(4096),b\"\")]'; fi`,
        `echo "__PROXY_NO_TOOL__" >&2; exit 1`,
      ];
      const proxyCmd = proxyCandidates.join("; ");

      fwdStream = await new Promise<Duplex>((resolve, reject) => {
        bastionConn!.exec(proxyCmd, (execErr, stream) => {
          if (execErr) {
            return reject(
              new Error(
                `Bastion menolak forwardOut DAN exec proxy gagal: ${execErr.message}.`,
              ),
            );
          }
          let stderrBuf = "";
          let resolved = false;
          stream.stderr.on("data", (d: Buffer) => {
            stderrBuf += d.toString();
            if (!resolved && stderrBuf.includes("__PROXY_NO_TOOL__")) {
              resolved = true;
              reject(
                new Error(`Tidak ada tool TCP-proxy di bastion ${cfg.hostId}.`),
              );
              try {
                stream.end();
              } catch {}
            }
          });
          if (!resolved) {
            resolved = true;
            resolve(stream as unknown as Duplex);
          }
        });
      });
    }

    targetConn = await new Promise<SshClient>((resolve, reject) => {
      const c = new SshClient();
      c.on("ready", () => resolve(c));
      c.on("error", reject);
      c.connect({
        sock: fwdStream as unknown as Duplex,
        username: cfg.username,
        password: cfg.password,
        privateKey: cfg.privateKey,
        readyTimeout: SSH_READY_TIMEOUT_MS,
        keepaliveInterval: 15_000,
        keepaliveCountMax: 3,
      });
    });
  } else {
    targetConn = await new Promise<SshClient>((resolve, reject) => {
      const c = new SshClient();
      c.on("ready", () => resolve(c));
      c.on("error", reject);
      c.connect({
        sock: initialSocket as unknown as Duplex,
        username: cfg.username,
        password: cfg.password,
        privateKey: cfg.privateKey,
        readyTimeout: SSH_READY_TIMEOUT_MS,
        keepaliveInterval: 15_000,
        keepaliveCountMax: 3,
      });
    });
  }

  const onClose = () => closeConnection(cfg.hostId);
  if (bastionConn) {
    bastionConn.on("close", onClose);
    bastionConn.on("error", onClose);
  }
  targetConn.on("close", onClose);
  targetConn.on("error", onClose);

  return { bastion: bastionConn, target: targetConn, cfSocket };
}

// ─── SSH Execute (pakai pool) ──────────────────────────────
function runSshCommand(
  cfg: SshHostConfig,
  jump: JumpConfig | null,
  cmd: string,
  timeoutMs = SSH_COMMAND_TIMEOUT_MS,
  retryCount = 1,
): Promise<string> {
  const attempt = async (
    retriesLeft: number,
    isRetry: boolean,
  ): Promise<string> => {
    return new Promise<string>(async (resolve, reject) => {
      let resolved = false;

      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          closeConnection(cfg.hostId);
          reject(new Error(`SSH ${cfg.hostId} timeout (${timeoutMs}ms)`));
        }
      }, timeoutMs);

      try {
        const conn = await getOrCreateConnection(cfg, jump);
        let output = "";
        let stderr = "";
        conn.target.exec(cmd, (err, stream) => {
          if (err) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timeout);
              closeConnection(cfg.hostId);
              reject(err);
            }
            return;
          }
          stream
            .on("close", () => {
              if (!resolved) {
                resolved = true;
                clearTimeout(timeout);
                if (stderr && !output) {
                  reject(new Error(stderr.trim()));
                } else {
                  resolve(output);
                }
              }
            })
            .on("data", (d: Buffer) => {
              output += d.toString();
            })
            .stderr.on("data", (d: Buffer) => {
              stderr += d.toString();
            });
        });
      } catch (err: any) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(err);
        }
      }
    }).catch(async (err: any) => {
      const msg = String(err?.message || err?.code || "");
      const isTransient =
        msg.includes("ECONNRESET") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("EPIPE") ||
        msg.includes("Channel open failure");
      if (retriesLeft > 0 && isTransient && !isRetry) {
        closeConnection(cfg.hostId);
        await new Promise((r) => setTimeout(r, 2000));
        return attempt(retriesLeft - 1, true);
      }
      throw err;
    });
  };
  return attempt(retryCount, false);
}

// ─── Parse output gabungan ─────────────────────────────────
interface ParsedOutput {
  cpu?: { cpuModel: string; cpuCores: number; cpuLoad: number };
  memory?: { memUsed: number; memTotal: number };
  disk?: { diskUsed: number; diskTotal: number };
  uptime?: { uptime: number; loadAvg1: number };
}

function toNum(s: string): number {
  const cleaned = s.replace("[N/A]", "0").replace("Not Supported", "0");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}

function parseOutput(raw: string): ParsedOutput {
  const sections = raw.split(/###(\w+)###/);
  const map: Record<string, string> = {};
  for (let i = 1; i < sections.length; i += 2) {
    const tag = sections[i];
    const content = (sections[i + 1] || "").trim();
    map[tag] = content;
  }

  const result: ParsedOutput = {};

  if (map.CPU) {
    const lines = map.CPU.split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length >= 4) {
      const cpuModel = lines[0] || "Unknown CPU";
      const cpuCores = parseInt(lines[1]) || 0;
      const [idle1, total1] = lines[2].split(/\s+/).map(toNum);
      const [idle2, total2] = lines[3].split(/\s+/).map(toNum);
      const idleDelta = idle2 - idle1;
      const totalDelta = total2 - total1;
      const cpuLoad =
        totalDelta > 0
          ? Math.max(
              0,
              Math.min(100, Math.round((1 - idleDelta / totalDelta) * 100)),
            )
          : 0;
      result.cpu = { cpuModel, cpuCores, cpuLoad };
    }
  }

  if (map.MEM) {
    const parts = map.MEM.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const totalKb = toNum(parts[0]);
      const availKb = toNum(parts[1]);
      const usedKb = Math.max(0, totalKb - availKb);
      result.memory = {
        memUsed: +(usedKb / 1024 / 1024).toFixed(2),
        memTotal: +(totalKb / 1024 / 1024).toFixed(2),
      };
    }
  }

  if (map.DISK) {
    const parts = map.DISK.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const totalKb = toNum(parts[0]);
      const usedKb = toNum(parts[1]);
      result.disk = {
        diskUsed: +(usedKb / 1024 / 1024).toFixed(2),
        diskTotal: +(totalKb / 1024 / 1024).toFixed(2),
      };
    }
  }

  if (map.UPTIME) {
    const lines = map.UPTIME.split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length >= 2) {
      const uptime = Math.round(toNum(lines[0]));
      const loadAvg1 = toNum(lines[1].split(/\s+/)[0]);
      result.uptime = { uptime, loadAvg1 };
    }
  }

  return result;
}

// ─── Per-Host Polling ──────────────────────────────────────
const failureCount: Map<string, number> = new Map();
const inFlight: Map<string, boolean> = new Map();
let cachedJump: JumpConfig | null = null;

async function pollHost(cfg: SshHostConfig) {
  if (inFlight.get(cfg.hostId)) {
    return;
  }
  inFlight.set(cfg.hostId, true);

  try {
    const output = await runSshCommand(cfg, cachedJump, buildSystemCmd(cfg));
    const parsed = parseOutput(output);

    if (!parsed.cpu && !parsed.memory && !parsed.disk) {
      console.warn(
        `[SSH Poller] ⚠️  ${cfg.hostId}: tidak ada metrik yang bisa diparse`,
      );
      return;
    }

    // Hanya record 1 snapshot per host fisik — fokusnya CPU/RAM/Disk.
    // Field GPU di-keep di schema tapi nilainya 0 (legacy compat).
    recordGpuMetric({
      hostId: cfg.hostId,
      hostName: cfg.hostName,
      cpuLoad: parsed.cpu?.cpuLoad,
      cpuCores: parsed.cpu?.cpuCores,
      cpuModel: parsed.cpu?.cpuModel,
      memUsed: parsed.memory?.memUsed,
      memTotal: parsed.memory?.memTotal,
      diskUsed: parsed.disk?.diskUsed,
      diskTotal: parsed.disk?.diskTotal,
      uptime: parsed.uptime?.uptime,
      loadAvg1: parsed.uptime?.loadAvg1,
      agentVersion: "ssh-poller-3.0",
      meta: { kind: "system-monitor" },
    });

    if (failureCount.get(cfg.hostId)) {
      console.log(`[SSH Poller] ✅ ${cfg.hostId} kembali online`);
      failureCount.set(cfg.hostId, 0);
    }
  } catch (err: any) {
    const fc = (failureCount.get(cfg.hostId) || 0) + 1;
    failureCount.set(cfg.hostId, fc);
    if (fc === 1 || fc % 12 === 0) {
      const msg = String(err?.message || "");
      const isCfOriginDown =
        msg.includes("ECONNRESET") ||
        msg.includes("Channel open failure") ||
        msg.includes("websocket: bad handshake");
      const hint = isCfOriginDown
        ? ` ▸ Cloudflare Tunnel origin offline. Cek cloudflared di bastion.`
        : "";
      console.error(
        `[SSH Poller] ❌ ${cfg.hostId}: ${err.message} (kegagalan ke-${fc})${hint}`,
      );
    }
  } finally {
    inFlight.set(cfg.hostId, false);
  }
}

// ─── Public API ────────────────────────────────────────────
let pollerStarted = false;
let intervals: NodeJS.Timeout[] = [];

export function startGpuSshPoller() {
  if (pollerStarted) return;
  pollerStarted = true;

  const hosts = parseHosts();
  if (hosts.length === 0) {
    console.log(
      "[SSH Poller] ℹ️  GPU_SSH_HOSTS belum dikonfigurasi — SSH poller tidak aktif.",
    );
    return;
  }

  cachedJump = parseJumpConfig();

  console.log(
    `[SSH Poller] 🚀 SSH poller aktif untuk ${hosts.length} host (interval: ${POLL_INTERVAL_MS}ms)`,
  );
  if (cachedJump) {
    console.log(
      `[SSH Poller] 🔀 Jump config: ${cachedJump.username}@${cachedJump.host}:${cachedJump.port} (auth: ${
        cachedJump.password ? "password" : "key"
      })`,
    );
  }
  hosts.forEach((h) => {
    const auth = h.password ? "password" : "key";
    let transport = "";
    if (h.cloudflareHostname && h.cfDirect) {
      transport = `[via cloudflare: ${h.cloudflareHostname}]`;
    } else if (h.cloudflareHostname && !h.cfDirect) {
      transport = `[via cloudflare bastion: ${h.cloudflareHostname} → ${h.host}:${h.port}]`;
    } else if (h.jumpConfig || cachedJump) {
      const j = h.jumpConfig || cachedJump;
      transport = `[via jump: ${j!.host} → ${h.host}:${h.port}]`;
    }
    console.log(
      `[SSH Poller]    └─ ${h.hostId} → ${h.username}@${h.host}:${h.port} (auth: ${auth}) ${transport}`,
    );
    pollHost(h);
    const interval = setInterval(() => pollHost(h), POLL_INTERVAL_MS);
    intervals.push(interval);
  });
}

export function stopGpuSshPoller() {
  intervals.forEach((i) => clearInterval(i));
  intervals = [];
  pollerStarted = false;

  Array.from(connectionPool.keys()).forEach(closeConnection);

  tunnelCache.forEach(async (p) => {
    try {
      const t = await p;
      t.proc.kill();
    } catch {
      /* ignore */
    }
  });
  tunnelCache.clear();
}
