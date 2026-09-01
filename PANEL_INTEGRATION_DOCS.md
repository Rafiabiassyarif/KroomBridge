# Panduan Integrasi API: KroomBridge & Kroombox Panel

Dokumen ini berisi spesifikasi endpoint yang diperlukan untuk menghubungkan KroomBridge dengan sistem Kroombox Panel.

---

## 1. Webhook dari Panel ke KroomBridge
Kroombox Panel harus melakukan HTTP POST/GET ke KroomBridge saat ada perubahan data di sisi Panel (pembelian, upgrade, cancel).

**Autentikasi (Wajib):**
Setiap request ke KroomBridge harus menyertakan Header:
`webhook_secret: kroombridge_126`

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
