# Kroombox API Gateway

Backend Express.js untuk **Kroombox API Gateway** — platform gateway API yang mengelola klien, paket, route upstream, keamanan, dan autentikasi.

---

## 🚀 Cara Menjalankan

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
# Edit .env sesuai kebutuhan
```

### 3. Jalankan Server
```bash
# Development (dengan Vite dev server)
npm run dev

# Production
npm run build
NODE_ENV=production npm start
```

Server akan berjalan di `http://localhost:3000`

---

## 📁 Struktur File

```
KroomboxAPI/
├── server.ts                          # Entry point utama
├── database.json                      # Database JSON (auto-generated)
├── .env                               # Konfigurasi environment
├── src/server/
│   ├── db.ts                          # Database layer (JSONDatabase)
│   ├── auth.ts                        # Auth routes (/api/auth/*)
│   ├── admin.ts                       # Admin routes (/api/admin/*)
│   ├── gateway.ts                     # Gateway middleware + proxy (/gateway/*)
│   ├── integration.ts                 # Webhook integration (/api/integration/*)
│   └── repositories/
│       └── adminRepository.ts         # Repository layer admin
```

---

## 📌 Daftar Endpoint Lengkap

### 🟢 Public Endpoints (Tanpa Auth)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/health` | Cek status server |
| GET | `/api/info` | Info lengkap API, paket, dan routes tersedia |

---

### 🔐 Auth Endpoints (`/api/auth`)

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/auth/token` | Dapatkan access token (Client ID + Secret) |
| POST | `/api/auth/refresh` | Perbarui access token dengan refresh token |
| POST | `/api/auth/validate` | Validasi access token |

**Contoh: Mendapatkan Token**
```http
POST /api/auth/token
Content-Type: application/json

{
  "clientId": "client_demo",
  "clientSecret": "demo_secret_123"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 900,
  "client_name": "Demo Client",
  "package": "Free",
  "quota_remaining": 1000
}
```

---

### 🛡️ Admin Endpoints (`/api/admin`)

> Semua endpoint di bawah (kecuali `/login`) memerlukan header:
> `Authorization: Bearer <admin_token>`

**RBAC Roles:**
- `Admin` — Akses penuh
- `Moderator` — Akses penuh kecuali hapus admin
- `Viewer` — Hanya bisa GET (baca saja)

#### Login Admin
```http
POST /api/admin/login
Body: { "email": "rafiabiassyarif@gmail.com", "password": "admin123" }
```

#### Dashboard & Analytics

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/admin/dashboard-stats` | Statistik lengkap dashboard |
| GET | `/api/admin/analytics/usage` | Data penggunaan per hari |
| POST | `/api/admin/reset-monthly-usage` | Reset kuota semua klien (Admin only) |

#### Manajemen Klien

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/admin/clients` | List semua klien |
| GET | `/api/admin/clients/:id` | Detail klien + log + statistik |
| POST | `/api/admin/clients` | Buat klien baru |
| PATCH | `/api/admin/clients/:id` | Update data klien |
| PATCH | `/api/admin/clients/:id/toggle` | Aktifkan/nonaktifkan klien |
| POST | `/api/admin/clients/:id/rotate` | Rotasi secret key klien |
| POST | `/api/admin/clients/:id/reset-usage` | Reset usage bulan ini |
| DELETE | `/api/admin/clients/:id` | Hapus klien |

#### Manajemen Paket

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/admin/packages` | List semua paket |
| GET | `/api/admin/packages/:id` | Detail paket |
| POST | `/api/admin/packages` | Buat paket baru |
| PATCH | `/api/admin/packages/:id` | Update paket |
| DELETE | `/api/admin/packages/:id` | Hapus paket (jika tidak ada klien) |

#### Manajemen Routes Gateway

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/admin/routes` | List semua routes |
| GET | `/api/admin/routes/:id` | Detail route |
| POST | `/api/admin/routes` | Buat route baru |
| PATCH | `/api/admin/routes/:id` | Update route |
| PATCH | `/api/admin/routes/:id/toggle` | Aktifkan/nonaktifkan route |
| DELETE | `/api/admin/routes/:id` | Hapus route |

#### Konfigurasi Keamanan

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/admin/security` | Lihat konfigurasi keamanan |
| PATCH | `/api/admin/security` | Update pengaturan keamanan |
| POST | `/api/admin/security/allowlist` | Tambah IP ke allowlist |
| DELETE | `/api/admin/security/allowlist/:ip` | Hapus IP dari allowlist |
| POST | `/api/admin/security/denylist` | Blokir IP (tambah ke denylist) |
| DELETE | `/api/admin/security/denylist/:ip` | Hapus IP dari denylist |

#### Manajemen Admin Users

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/admin/users` | List semua admin |
| POST | `/api/admin/users` | Buat admin baru |
| PATCH | `/api/admin/users/:id` | Update admin |
| DELETE | `/api/admin/users/:id` | Hapus admin |

#### Logs

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/admin/logs` | List logs (filter: clientId, routeId, status) |
| DELETE | `/api/admin/logs` | Hapus semua logs (Admin only) |

---

### 🌐 Gateway Endpoints (`/gateway`)

> Memerlukan header: `Authorization: Bearer <access_token>`
> Access token didapatkan dari `POST /api/auth/token`

Semua request ke `/gateway/*` akan di-proxy ke upstream URL yang dikonfigurasi.

**Contoh: Panggil endpoint AI Chat**
```http
POST /gateway/ai/chat
Authorization: Bearer eyJ...
Content-Type: application/json

{
  "message": "Halo, bagaimana kabar kamu?"
}
```

**Fitur Gateway:**
- ✅ Rate limiting per klien (per paket)
- ✅ Kuota bulanan dengan overage support
- ✅ IP Allowlist & Denylist
- ✅ RBAC endpoint permission
- ✅ Request/Response body transformation
- ✅ Anomaly detection
- ✅ Timeout handling
- ✅ Logging otomatis

---

### 🔗 Integration Webhooks (`/api/integration`)

> Memerlukan header: `webhook_secret: <WEBHOOK_SECRET>` atau `X-Webhook-Secret`

Digunakan oleh **KroomBridge Panel** untuk komunikasi antar server.

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/integration/webhook/purchase` | User beli paket (buat klien baru) |
| POST | `/api/integration/webhook/cancel` | User batalkan langganan |
| POST | `/api/integration/webhook/upgrade` | User upgrade/downgrade paket |
| GET | `/api/integration/client-info/:clientId` | Cek status klien |
| GET | `/api/integration/packages` | List paket yang tersedia |

**Contoh: Webhook Pembelian**
```http
POST /api/integration/webhook/purchase
webhook_secret: kroombox_internal_secret
Content-Type: application/json

{
  "userName": "Budi Santoso",
  "userEmail": "budi@example.com",
  "packageId": "pkg_pro",
  "externalUserId": "user_12345"
}
```

---

## ⚙️ Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | `3000` | Port server |
| `NODE_ENV` | `development` | Mode (development/production) |
| `JWT_SECRET` | *(default)* | Secret untuk access token klien |
| `REFRESH_SECRET` | *(default)* | Secret untuk refresh token |
| `ADMIN_JWT_SECRET` | *(default)* | Secret untuk token admin |
| `WEBHOOK_SECRET` | *(default)* | Secret untuk webhook integration |
| `QUOTA_RESET_DAY` | `1` | Hari reset kuota (1-28) |
| `ALLOWED_ORIGINS` | `*` | CORS origins yang diizinkan |

---

## 📊 Response Format

### Sukses
```json
{ "data": "...", "message": "..." }
```

### Error
```json
{
  "error": "Pesan error yang deskriptif",
  "hint": "Petunjuk untuk memperbaiki (opsional)"
}
```

### Status Codes
| Code | Arti |
|------|------|
| 200 | Sukses |
| 201 | Dibuat |
| 400 | Input tidak valid |
| 401 | Tidak terautentikasi |
| 403 | Tidak berhak |
| 404 | Tidak ditemukan |
| 409 | Konflik (duplikat) |
| 413 | Body terlalu besar |
| 429 | Rate limit / quota habis |
| 502 | Upstream error |
| 504 | Upstream timeout |

---

## 🔒 Keamanan

- JWT dengan expiry 15 menit (access) dan 7 hari (refresh)
- RBAC berbasis role (Admin/Moderator/Viewer)
- IP Allowlist dan Denylist
- Rate limiting per klien
- Anomaly detection
- Body size limit
- CORS protection
