export const ADMIN_USERS_COLLECTION = 'admin_users';
export const ADMIN_SESSION_STORAGE_KEY = 'comelec-live-tally-admin-session';

export interface AdminUser {
  username: string;
  role: 'admin';
}

export interface AdminUserRecord extends AdminUser {
  passwordHash: string;
  createdAt: string;
}

export const normalizeUsername = (username: string) => username.trim().toLowerCase();

export async function hashPassword(password: string): Promise<string> {
  const bytes = new TextEncoder().encode(password);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}