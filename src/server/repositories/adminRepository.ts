import { db } from '../db.js';
import type { AdminUser } from '../db.js';

// ────────────────────────────────────────────────────────────
// Admin Repository — Layer akses data untuk operasi admin
// ────────────────────────────────────────────────────────────

export const adminRepository = {
  /**
   * Autentikasi admin berdasarkan email dan password.
   * Mengembalikan admin tanpa field password, atau null jika gagal.
   */
  authenticate(email: string, password: string): Omit<AdminUser, 'password'> | null {
    const admins = db.getAdmins();
    const admin = admins.find(a => a.email === email && a.password === password);
    if (!admin) return null;

    const { password: _, ...adminSafe } = admin;
    db.updateAdmin(admin.id, { lastLogin: new Date().toISOString() });
    return adminSafe;
  },

  /**
   * Cari admin berdasarkan ID.
   */
  findById(id: string): Omit<AdminUser, 'password'> | null {
    const admin = db.getAdmins().find(a => a.id === id);
    if (!admin) return null;
    const { password: _, ...rest } = admin;
    return rest;
  },

  /**
   * Cari admin berdasarkan email.
   */
  findByEmail(email: string): AdminUser | null {
    return db.getAdminByEmail(email) || null;
  },

  /**
   * Ambil semua admin (tanpa password).
   */
  findAll(): Omit<AdminUser, 'password'>[] {
    return db.getAdmins().map(a => {
      const { password: _, ...rest } = a;
      return rest;
    });
  },

  /**
   * Hitung jumlah admin.
   */
  count(): number {
    return db.getAdmins().length;
  },

  /**
   * Buat admin baru.
   */
  create(data: AdminUser): Omit<AdminUser, 'password'> {
    const created = db.createAdmin(data);
    const { password: _, ...rest } = created;
    return rest;
  },

  /**
   * Update admin.
   */
  update(id: string, updates: Partial<AdminUser>): Omit<AdminUser, 'password'> | null {
    const updated = db.updateAdmin(id, updates);
    if (!updated) return null;
    const { password: _, ...rest } = updated;
    return rest;
  },

  /**
   * Hapus admin berdasarkan ID.
   */
  async delete(id: string): Promise<boolean> {
    return db.deleteAdmin(id);
  },
};
