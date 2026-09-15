# Panduan Integrasi API: KroomBridge & Kroombox Panel

Dokumen ini berisi spesifikasi endpoint yang diperlukan untuk menghubungkan KroomBridge dengan sistem Kroombox Panel.

---

## 1. Webhook dari Panel ke KroomBridge
Kroombox Panel harus melakukan HTTP POST/GET ke KroomBridge saat ada perubahan data di sisi Panel (pembelian, upgrade, cancel).

**Autentikasi (Wajib):**
Setiap request ke KroomBridge harus menyertakan Header:
`webhook_secret: whsec_a1039f0ab2581354eb871c7b0d80dde80aa8d5b83ac14cae`

### A. Pembelian Paket Baru (Beli Langganan API)
- **Endpoint**: `POST /api/integration/webhook/purchase`
- **Body Request (JSON)**:
  ```json
  {
    "userName": "Nama User",      // Wajib
    "packageId": "id_paket",      // Wajib (Dapatkan ID dari Endpoint E, ATAU buat ID baru)
    "userEmail": "email@user.com",// Opsional
    "externalUserId": "id_123",   // Opsional (ID User di database Panel)
    "notes": "Catatan tambahan",  // Opsional
    
    // (BARU!) Sertakan packageDetails jika Kroombox Panel ingin mengontrol batas/limit sendiri.
    // Jika KroomBridge belum mengenali 'packageId' ini, paket akan otomatis dibuat berdasarkan detail ini.
    "packageDetails": {
      "name": "Paket Pro",
      "quotaType": "token",          // "token" atau "request" (default: "token")
      "costPerRequest": 1,           // Jika quotaType = "request", kuota yang dipotong per hit (default: 1)
      "monthlyQuota": 500000,
      "maxRequestsPerMinute": 100,
      "allowedModels": ["gpt-4o-mini", "claude-3-haiku"], // model yang diizinkan
      "allowedEndpoints": ["*"]
    }
  }
  ```

### B. Upgrade / Downgrade Paket
- **Endpoint**: `POST /api/integration/webhook/upgrade`
- **Body Request (JSON)**:
  ```json
  {
    "externalUserId": "id_123", // Opsional (Bisa gunakan ini atau clientId)
    "clientId": "client_abc",   // Opsional
    "newPackageId": "pkg_pro",  // Wajib (ID paket yang baru)
    
    // (BARU!) Sama seperti di atas, sertakan ini agar paket otomatis disinkronisasi ke KroomBridge
    "packageDetails": {
      "monthlyQuota": 500000,
      "allowedModels": ["*"]
    }
  }
  ```

### C. Pembatalan Layanan (Cancel / Gagal Bayar)
- **Endpoint**: `POST /api/integration/webhook/cancel`
- **Body Request (JSON)**:
  ```json
  {
    "externalUserId": "id_123",  // Opsional
    "clientId": "client_abc",    // Opsional
    "reason": "Gagal bayar"      // Opsional (Alasan penutupan)
  }
  ```

### D. Cek Info & Kuota Klien
- **Endpoint**: `GET /api/integration/client-info/:clientId`
- **Tujuan**: Mengambil status aktif/tidak, sisa kuota, dan pemakaian user untuk ditampilkan di dashboard Panel.

### E. Ambil Daftar Paket
- **Endpoint**: `GET /api/integration/packages`
- **Tujuan**: Menarik daftar paket API KroomBridge secara dinamis untuk ditampilkan di halaman pembelian Kroombox Panel. (Jika Panel tidak punya master paket, bisa pakai ini. Jika Panel punya sistem paket sendiri, abaikan endpoint ini).
- **Respons (JSON)**: Akan mengembalikan array objek paket yang mencakup `id`, `name`, `price`, `monthlyQuota`, `allowedEndpoints`, dan **`allowedModels`**.

### F. Sinkronisasi Paket dari Panel ke KroomBridge (Buat / Edit Paket)
- **Endpoint**: `POST /api/integration/webhook/package`
- **Tujuan**: Dipanggil saat admin di Kroombox Panel membuat atau mengubah paket. Jika ID paket sudah ada, KroomBridge akan otomatis mengupdate paket tersebut. Jika belum ada, paket baru akan otomatis dibuat. Perubahan akan langsung tampil realtime di dashboard KroomBridge.
- **Body Request (JSON)**:
  ```json
  {
    "id": "pkg_pro",                  // Wajib (ID Paket di Panel)
    "name": "Paket Pro",              // Wajib
    "monthlyQuota": 1000000,          // Kuota bulanan
    "maxRequestsPerMinute": 120,      // Rate limit per menit
    "quotaType": "token",             // "token", "request", atau "credit"
    "costPerRequest": 1,              // Jika quotaType = "request"
    "costPer1KTokens": 20,            // Jika quotaType = "credit"
    "allowOverage": false,
    "overageRatePer1K": 0,
    "allowedEndpoints": ["*"],
    "allowedModels": ["*"],           // Daftar model yang diizinkan
    "price": 75000,
    "description": "Paket Pro Kroombox Panel"
  }
  ```

### G. Edit Sebagian Field Paket dari Panel
- **Endpoint**: `PATCH /api/integration/webhook/package/:id`
- **Tujuan**: Mengupdate atribut paket tertentu (misal hanya harga atau kuota).
- **Body Request (JSON)**:
  ```json
  {
    "price": 85000,
    "monthlyQuota": 1200000
  }
  ```

### H. Hapus Paket dari Panel
- **Endpoint**: `DELETE /api/integration/webhook/package/:id`
- **Query Params**: `?force=true` (opsional jika masih ada klien terhubung)
- **Tujuan**: Menghapus paket dari KroomBridge.

### I. Unified Webhook Event Receiver (Alternatif Terpadu)
- **Endpoint**: `POST /api/integration/webhook/event`
- **Tujuan**: Menerima event webhook serbaguna dengan struktur format event standar.
- **Body Request (JSON)**:
  ```json
  {
    "event": "package:updated", // "package:created", "package:updated", atau "package:deleted"
    "data": {
      "id": "pkg_pro",
      "name": "Paket Pro Max",
      "monthlyQuota": 2000000
    }
  }
  ```

---

## 2. API dari KroomBridge ke Panel (Tugas Tim Panel)
KroomBridge akan melakukan request ke backend Kroombox Panel untuk sinkronisasi user otomatis. **Backend Panel harus membuat endpoint ini**.

### Endpoint Sinkronisasi User
- **URL yang harus dibuat di Panel**: `GET https://panel.kroombox.com/api/admin/users`
- **Tujuan**: Mengembalikan daftar seluruh user agar otomatis terdaftar sebagai klien API KroomBridge.
- **Autentikasi**: KroomBridge akan mengirimkan request dengan header `Authorization: Bearer <PANEL_API_KEY>`
- **Response JSON yang Diharapkan oleh KroomBridge**:
  ```json
  [
    {
      "id": "usr_12345",
      "username": "johndoe",
      "fullName": "John Doe",
      "email": "john@example.com",
      "plan": "Pro Plan",       // Penting: Nama paket langganan saat ini
      "status": "ACTIVE",       // "ACTIVE" atau status lainnya
      "userCategory": "member", 
      "role": "user",
      
      // (BARU!) Jika Panel mengelola paket, sertakan 'planDetails' di sini
      "planDetails": {
         "monthlyQuota": 500000,
         "maxRequestsPerMinute": 100,
         "allowedModels": ["gpt-4o", "claude-3-opus"]
      }
    }
  ]
  ```

---

## 3. Webhook dari KroomBridge ke Panel (BARU)
KroomBridge akan menembak HTTP POST ke Kroombox Panel setiap kali **Paket API** ditambah, diedit, atau dihapus langsung melalui KroomBridge Console. Hal ini dilakukan agar Panel mengetahui dan mensinkronisasikan daftar paketnya.

**Endpoint yang harus disiapkan oleh Panel:**
Silakan buat endpoint di backend Panel Anda dan atur URL-nya pada `.env` KroomBridge (`PANEL_WEBHOOK_URL=https://...`).

**Contoh Payload Webhook:**
```json
{
  "event": "package:created", // Bisa "package:created", "package:updated", atau "package:deleted"
  "data": {
    "id": "pkg_12345678",
    "name": "Paket Premium",
    "maxRequestsPerMinute": 100,
    "monthlyQuota": 100000,
    "quotaType": "token",
    "allowOverage": false,
    "overageRatePer1K": 0,
    "allowedEndpoints": ["*"],
    "price": 50000,
    "description": "Paket terbaik",
    "createdAt": "2026-09-02T10:00:00.000Z"
  }
}
```
*Catatan: Jika `event` adalah `package:deleted`, maka `data` hanya berisi `{ "id": "pkg_12345678" }`.*
