// services/mocks/db.ts
// "CSDL" giả cho tài khoản. Tài khoản đăng ký mới lưu localStorage (khóa mock_users) để F5 không mất.
// Nút MOCK MODE xóa mọi khóa bắt đầu bằng "mock_" nên reset được.
import type { Role } from '../../types';

export interface MockUser {
  id: number;
  fullName: string;
  email: string;
  password: string; // mock nên để nguyên; BE thật lưu bcrypt hash
  role: Role;
  isActive: boolean;
}

// Tài khoản mẫu (mật khẩu theo seed của hợp đồng MNM: User@1234)
export const SEED_USERS: MockUser[] = [
  { id: 1, fullName: 'Quản trị viên', email: 'admin@bookstore.local', password: 'Admin@1234', role: 'ADMIN', isActive: true },
  { id: 2, fullName: 'Nguyễn Văn An', email: 'user1@bookstore.local', password: 'User@1234', role: 'USER', isActive: true },
  { id: 3, fullName: 'Trần Thị Bình', email: 'user2@bookstore.local', password: 'User@1234', role: 'USER', isActive: true },
  // Để thử nhánh 403 "Tài khoản đã bị khóa"
  { id: 4, fullName: 'Tài khoản bị khóa', email: 'locked@bookstore.local', password: 'User@1234', role: 'USER', isActive: false },
];

const KEY = 'mock_users';
let memory: MockUser[] = [];

const loadRegistered = (): MockUser[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as MockUser[];
  } catch {
    return memory;
  }
};

export const allUsers = () => [...SEED_USERS, ...loadRegistered()];

export const findUserByEmail = (email: string) => {
  const e = email.trim().toLowerCase();
  return allUsers().find((u) => u.email.toLowerCase() === e);
};

export const findUserById = (id: number) => allUsers().find((u) => u.id === id);

export const addUser = (data: Omit<MockUser, 'id' | 'role' | 'isActive'>): MockUser => {
  const created: MockUser = { ...data, id: Math.max(...allUsers().map((u) => u.id)) + 1, role: 'USER', isActive: true };
  memory = [...loadRegistered(), created];
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    /* bỏ qua, đã có bản trong bộ nhớ */
  }
  return created;
};

// ---------- Token giả: mock.<base64(payload)>.signature ----------
const TTL_MS = 24 * 60 * 60 * 1000; // 1 ngày, giống JWT mẫu (D-03)

export const makeToken = (u: MockUser) =>
  `mock.${btoa(JSON.stringify({ id: u.id, role: u.role, exp: Date.now() + TTL_MS }))}.signature`;

export const readToken = (token: string | null): { id: number; role: Role } | null => {
  if (!token) return null;
  try {
    const [prefix, payload] = token.split('.');
    if (prefix !== 'mock') return null;
    const p = JSON.parse(atob(payload)) as { id: number; role: Role; exp: number };
    return p.exp > Date.now() ? { id: p.id, role: p.role } : null;
  } catch {
    return null;
  }
};
