# GPU Monitoring — Setup

Backend KroomBridge bisa monitoring GPU realtime via 3 cara. Pilih
yang paling cocok dengan setup Anda:

| Skenario                                                  | Cara             | File                           |
| --------------------------------------------------------- | ---------------- | ------------------------------ |
| Server KroomBridge **=** PC Putih (1 mesin, ada GPU)      | **Local poller** | `gpuLocalPoller.ts` (built-in) |
| Server KroomBridge **≠** PC Putih, mau push dari PC Putih | **Node Agent**   | `scripts/gpu-agent.js`         |
| Server KroomBridge **≠** PC Putih, mau pull via SSH       | **SSH poller**   | `gpuSshPoller.ts` (built-in)   |

---

## 🟢 Cara 1 — Local Poller (paling simpel kalau 1 PC)

Server KroomBridge jalan langsung di PC Putih.

Edit `.env`:

```dotenv
GPU_LOCAL_ENABLED=true
GPU_LOCAL_HOST_ID=pc-putih
GPU_LOCAL_HOST_NAME=PC Putih
GPU_LOCAL_POLL_INTERVAL_MS=3000
```

Restart `npm run dev`. Log:

```
[GPU Local] 🚀 Local poller aktif: pc-putih (PC Putih) tiap 3000ms
```

Selesai. Kartu GPU di dashboard langsung berisi data realtime.

---

## 🔵 Cara 2 — Node Agent (PC Putih push ke KroomBridge)

Cocok kalau KroomBridge server jalan di PC lain (mis. mini PC / VPS),
dan Anda mau PC Putih yang push data ke server.

### Setup di PC Putih

1. **Copy file `scripts/gpu-agent.js`** ke PC Putih (lokasi bebas, mis. `/home/kroombox/gpu-agent.js`)

2. **Edit konfigurasi** di bagian atas file atau set lewat env:

   ```bash
   export KROOMBRIDGE_API_URL=http://192.168.1.5:3000
   export GPU_REPORT_SECRET=secret_yang_sama_dengan_di_env_server
   export GPU_HOST_ID=pc-putih
   export GPU_HOST_NAME="PC Putih"
   export GPU_POLL_INTERVAL=3000
   ```

3. **Pastikan Node.js terinstall**:

   ```bash
   node --version    # minimal v16
   ```

   Kalau belum: `sudo apt install nodejs`

4. **Jalankan**:

   ```bash
   node gpu-agent.js
   ```

   Output:

   ```
   ============================================================
   KroomBridge GPU Agent
   ============================================================
   API URL    : http://192.168.1.5:3000
   Host ID    : pc-putih
   Host Name  : PC Putih
   Interval   : 3000ms
   ============================================================
   [10:23:50] ✅ pc-putih: 30% load · 0.8/24.0GB VRAM · 60°C · 42W (2 GPUs)
   ```

### Auto-start saat boot di Linux (systemd)

Buat file `/etc/systemd/system/kroombridge-gpu-agent.service`:

```ini
[Unit]
Description=KroomBridge GPU Agent
After=network.target

[Service]
Type=simple
User=kroombox
WorkingDirectory=/home/kroombox
ExecStart=/usr/bin/node /home/kroombox/gpu-agent.js
Environment=KROOMBRIDGE_API_URL=http://192.168.1.5:3000
Environment=GPU_REPORT_SECRET=secret_anda
Environment=GPU_HOST_ID=pc-putih
Environment=GPU_HOST_NAME=PC Putih
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Aktifkan:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kroombridge-gpu-agent
sudo systemctl status kroombridge-gpu-agent
```

### Auto-start di Windows (Task Scheduler)

1. Buka Task Scheduler → Create Task
2. Triggers: At startup
3. Actions: Start a program
   - Program: `C:\Program Files\nodejs\node.exe`
   - Arguments: `C:\path\ke\gpu-agent.js`
   - Start in: folder gpu-agent.js
4. Conditions: matikan "Start the task only if the computer is on AC power"

---

## 🟣 Cara 3 — SSH Poller (KroomBridge SSH ke PC Putih)

Cocok kalau Anda tidak bisa install apa-apa di PC Putih, tapi SSH
sudah aktif. Server KroomBridge yang inisiatif SSH dan jalankan
`nvidia-smi` tiap N detik.

Edit `.env` di server KroomBridge:

```dotenv
# Pakai password
GPU_SSH_HOSTS=pc-putih:192.168.1.10:22:kroombox:password=passwordnya
GPU_SSH_POLL_INTERVAL_MS=5000

# Atau pakai SSH key (recommended)
GPU_SSH_HOSTS=pc-putih:192.168.1.10:22:kroombox:C:/Users/admin/.ssh/id_rsa
```

Multi-host:

```dotenv
GPU_SSH_HOSTS=pc-putih:192.168.1.10:22:kroombox:password=putih123,pc-hitam:192.168.1.11:22:kroombox:password=hitam456
```

Restart server. Log:

```
[GPU SSH] 🚀 SSH poller aktif untuk 2 host (interval: 5000ms)
[GPU SSH]    └─ pc-putih → kroombox@192.168.1.10:22 (auth: password)
[GPU SSH]    └─ pc-hitam → kroombox@192.168.1.11:22 (auth: key)
```

---

## Multi-GPU

Semua opsi di atas otomatis aggregate kalau PC punya >1 GPU. Untuk
PC Putih dengan **2× RTX 3060 (12GB each)** seperti screenshot:

| Metric      | Hasil                        |
| ----------- | ---------------------------- |
| GPU Name    | `2× NVIDIA GeForce RTX 3060` |
| GPU Load    | rata-rata kedua GPU          |
| VRAM Total  | `24 GB` (12+12)              |
| Temperature | nilai max (worst case)       |
| Power Draw  | total kedua GPU              |
| Fan Speed   | rata-rata                    |

---

## Endpoint API GPU

| Method | Path                             | Auth           | Keterangan                     |
| ------ | -------------------------------- | -------------- | ------------------------------ |
| POST   | `/api/gpu/report`                | `X-GPU-Secret` | Push metrik (dipakai agent)    |
| GET    | `/api/admin/gpu`                 | JWT admin      | Snapshot semua host            |
| GET    | `/api/admin/gpu/:hostId/history` | JWT admin      | History 60 sample terakhir     |
| GET    | `/api/gpu/health`                | (no auth)      | Cek konektivitas + jumlah host |

---

## Troubleshooting

### Status "Offline" di dashboard

- **Local poller**: cek log server saat startup, harus muncul `[GPU Local] 🚀`
- **Agent**: cek log agent, harus muncul ✅. Kalau ❌ HTTP error, secret salah
- **SSH poller**: cek log server, kalau ❌ timeout berarti SSH tidak nyala / firewall blok

### `nvidia-smi: command not found`

Driver NVIDIA belum terinstall, atau `nvidia-smi` tidak ada di PATH non-interaktif. Test:

```bash
ssh user@pc-putih 'nvidia-smi --version'
# atau di PC Putih langsung:
which nvidia-smi
```

### Auto-offline >30 detik

Server menandai host offline kalau tidak ada update >30 detik. Pastikan interval polling lebih kecil dari 30 detik (default 3-5 dtk sudah OK).
