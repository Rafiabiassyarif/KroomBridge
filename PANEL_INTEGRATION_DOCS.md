# Panduan Integrasi API: KroomBridge & Kroombox Panel

Dokumen ini berisi spesifikasi endpoint yang diperlukan untuk menghubungkan KroomBridge dengan sistem Kroombox Panel.

**Base URL KroomBridge:** `https://kroombridge.kii.lat`

---

## 1. Webhook dari Panel ke KroomBridge
Kroombox Panel harus melakukan HTTP POST/GET ke KroomBridge (`https://kroombridge.kii.lat`) saat ada perubahan data di sisi Panel (pembelian, upgrade, cancel, rotasi key).

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
- **Endpoint**: `GET /api/integration/client-info/:clientId` (Parameter `:clientId` bisa diisi `clientId` KroomBridge ATAU `externalUserId` Panel)
- **Tujuan**: Mengambil status aktif/tidak, sisa kuota, pemakaian, dan API Key aktif user untuk ditampilkan di dashboard Panel.
- **Respons (JSON)**:
  ```json
  {
    "clientId": "client_abc123",
    "name": "John Doe",
    "email": "john@example.com",
    "secretKey": "sk_abc123...",
    "keyVersion": 2,
    "isActive": true,
    "status": "active",
    "packageId": "pkg_pro",
    "packageName": "Paket Pro",
    "usageThisMonth": 1250,
    "quotaType": "token",
    "costPerRequest": 1,
    "quotaRemaining": 498750,
    "quotaPercentage": 1,
    "lastSeen": "2026-09-17T08:00:00.000Z",
    "createdAt": "2026-09-01T10:00:00.000Z"
  }
  ```

### E. Ambil Daftar Paket
- **Endpoint**: `GET /api/integration/packages`
- **Tujuan**: Menarik daftar paket API KroomBridge secara dinamis untuk ditampilkan di halaman pembelian Kroombox Panel.
- **Respons (JSON)**: Mengembalikan array objek paket.

### F. Sinkronisasi Paket dari Panel ke KroomBridge (Buat / Edit Paket)
- **Endpoint**: `POST /api/integration/webhook/package`
- **Tujuan**: Dipanggil saat admin di Kroombox Panel membuat atau mengubah paket.

### G. Edit Sebagian Field Paket dari Panel
- **Endpoint**: `PATCH /api/integration/webhook/package/:id`

### H. Hapus Paket dari Panel
- **Endpoint**: `DELETE /api/integration/webhook/package/:id`

### I. Unified Webhook Event Receiver (Alternatif Terpadu)
- **Endpoint**: `POST /api/integration/webhook/event`

### J. Rotasi API Key dari Sisi Panel (BARU)
- **Endpoint**: `POST /api/integration/webhook/rotate-key`
- **Tujuan**: Dipanggil saat user atau admin di Panel Kroombox menekan tombol "Rotasi API Key". KroomBridge akan otomatis mengenerate key baru, menonaktifkan key lama, dan mengembalikan key barunya.
- **Body Request (JSON)**:
  ```json
  {
    "externalUserId": "usr_12345" // ID user di database Panel (atau bisa pakai "clientId")
  }
  ```
- **Respons (JSON)**:
  ```json
  {
    "success": true,
    "message": "Secret Key berhasil dirotasi.",
    "clientId": "client_abc123",
    "externalUserId": "usr_12345",
    "oldSecretKey": "sk_lama...",
    "newSecretKey": "sk_baru_abcdef0123456789...",
    "keyVersion": 2,
    "rotatedAt": "2026-09-17T08:50:00.000Z"
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
      
      // (Opsional) Jika Panel mengelola detail paket
      "planDetails": {
         "monthlyQuota": 500000,
         "maxRequestsPerMinute": 100,
         "allowedModels": ["gpt-4o", "claude-3-opus"]
      }
    }
  ]
  ```

---

## 3. Webhook dari KroomBridge ke Panel

KroomBridge akan menembak HTTP POST ke Kroombox Panel (`PANEL_WEBHOOK_URL`) setiap kali terjadi:
1. **Rotasi Secret Key User** (Admin merotasi key di dashboard KroomBridge).
2. **Paket API** ditambah, diedit, atau dihapus langsung di KroomBridge.

**URL Endpoint di Panel:** `https://panel.kroombox.com/api/kroombridge/webhook`

**Headers yang Dikirim KroomBridge:**
```http
Content-Type: application/json
Authorization: Bearer kp_live_...
webhook_secret: whsec_a1039f0ab2581354eb871c7b0d80dde80aa8d5b83ac14cae
```

### Event 1: Rotasi API Key User (`client:key_rotated`)
Event ini terkirim otomatis saat admin KroomBridge menekan tombol **Rotasi Secret Key**.

**Payload JSON:**
```json
{
  "event": "client:key_rotated",
  "data": {
    "clientId": "client_abc123",
    "externalUserId": "usr_12345",
    "username": "John Doe",
    "email": "john@example.com",
    "oldSecretKey": "sk_lama123...",
    "newSecretKey": "sk_baru456...",
    "keyVersion": 2,
    "rotatedAt": "2026-09-17T08:50:00.000Z"
  }
}
```

**Aksi yang Harus Dilakukan Panel:**
Update kolom API Key user di database Panel dengan `newSecretKey` berdasarkan `externalUserId` (atau `clientId` / `email`). Dengan begitu:
- Di dashboard Panel, key baru langsung muncul ke user.
- Key lama otomatis tidak dapat digunakan lagi.

### Event 2: Paket API (`package:created`, `package:updated`, `package:deleted`)
```json
{
  "event": "package:updated",
  "data": {
    "id": "pkg_12345678",
    "name": "Paket Premium",
    "maxRequestsPerMinute": 100,
    "monthlyQuota": 100000,
    "quotaType": "token",
    "price": 50000
  }
}
```

---

## 4. Contoh Kode Handler Webhook di Backend Panel

### Contoh Node.js / Express:
```typescript
app.post("/api/kroombridge/webhook", async (req, res) => {
  const secret = req.headers["webhook_secret"] || req.headers["x-webhook-secret"];
  if (secret !== process.env.KROOMBRIDGE_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { event, data } = req.body;

  if (event === "client:key_rotated") {
    const { externalUserId, clientId, newSecretKey } = data;

    // Update API Key user di database Panel
    await db.query(
      "UPDATE users SET api_key = ? WHERE id = ? OR client_id = ?",
      [newSecretKey, externalUserId, clientId]
    );

    console.log(`[Panel] Key user ${externalUserId || clientId} berhasil dirotasi.`);
    return res.json({ success: true, message: "User API key updated in Panel" });
  }

  res.json({ received: true });
});
```

### Contoh PHP / Laravel:
```php
public function handleKroomBridgeWebhook(Request $request)
{
    $secret = $request->header('webhook_secret');
    if ($secret !== config('services.kroombridge.webhook_secret')) {
        return response()->json(['error' => 'Unauthorized'], 401);
    }

    $event = $request->input('event');
    $data = $request->input('data');

    if ($event === 'client:key_rotated') {
        $userId = $data['externalUserId'] ?? null;
        $newKey = $data['newSecretKey'];

        \DB::table('users')
            ->where('id', $userId)
            ->update(['api_key' => $newKey]);

        return response()->json(['success' => true]);
    }

    return response()->json(['received' => true]);
}
```
