// services/mocks/db.ts
// "CSDL" giả cho tài khoản. Tài khoản đăng ký mới lưu localStorage (khóa mock_users) để F5 không mất.
// Nút MOCK MODE xóa mọi khóa bắt đầu bằng "mock_" nên reset được.
import type { Role } from '../../types';
import { readJson, writeJson } from './storage';

export interface MockUser {
  id: number;
  fullName: string;
  email: string;
  password: string; // mock nên để nguyên; BE thật lưu bcrypt hash
  role: Role;
  isActive: boolean;
  phone?: string;
  address?: string;
  avatarUrl?: string; // UC012
  walletBalance: number; // số dư ban đầu; thay đổi lúc chạy được lưu ở shopdb.ts (UC004)
}

// Tài khoản mẫu (mật khẩu theo seed của hợp đồng MNM: User@1234)
export const SEED_USERS: MockUser[] = [
  { id: 1, fullName: 'Quản trị viên', email: 'admin@bookstore.local', password: 'Admin@1234', role: 'ADMIN', isActive: true, walletBalance: 0 },
  { id: 2, fullName: 'Nguyễn Văn An', email: 'user1@bookstore.local', password: 'User@1234', role: 'USER', isActive: true, phone: '0912345678', address: '12 Phố Huế, Hai Bà Trưng, Hà Nội', walletBalance: 761000 },
  { id: 3, fullName: 'Trần Thị Bình', email: 'user2@bookstore.local', password: 'User@1234', role: 'USER', isActive: true, walletBalance: 0 }, // ví 0đ: thử INSUFFICIENT_BALANCE
  // Để thử nhánh 403 "Tài khoản đã bị khóa"
  { id: 4, fullName: 'Tài khoản bị khóa', email: 'locked@bookstore.local', password: 'User@1234', role: 'USER', isActive: false, walletBalance: 0 },
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

// ---------- UC012: hồ sơ đã sửa (ghi đè lên cả tài khoản mẫu lẫn tài khoản đăng ký; khóa mock_profile_overrides) ----------
// null = đã xóa giá trị (phone / avatarUrl)
export interface ProfilePatch {
  fullName?: string;
  email?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  password?: string;
}
const PROFILE_KEY = 'mock_profile_overrides';
const profileOverrides = () => readJson<Record<string, ProfilePatch>>(PROFILE_KEY, {});

const applyOverride = (u: MockUser): MockUser => {
  const p = profileOverrides()[u.id];
  if (!p) return u;
  return {
    ...u,
    fullName: p.fullName ?? u.fullName,
    email: p.email ?? u.email,
    phone: p.phone === undefined ? u.phone : p.phone ?? undefined,
    avatarUrl: p.avatarUrl === undefined ? u.avatarUrl : p.avatarUrl ?? undefined,
    password: p.password ?? u.password,
  };
};

export const updateUser = (id: number, patch: ProfilePatch) => {
  // Ghi đè hồ sơ (kể cả mật khẩu) — áp dụng cho cả tài khoản seed lẫn tài khoản đăng ký
  writeJson(PROFILE_KEY, { ...profileOverrides(), [id]: { ...profileOverrides()[id], ...patch } });

  // Đồng bộ mật khẩu / email / tên vào mock_users nếu đây là user đăng ký (tránh mất khi F5)
  if (patch.password !== undefined || patch.email !== undefined || patch.fullName !== undefined) {
    try {
      const list = loadRegistered();
      const idx = list.findIndex((u) => u.id === id);
      if (idx >= 0) {
        const next = { ...list[idx] };
        if (patch.password !== undefined) next.password = patch.password;
        if (patch.email !== undefined) next.email = patch.email;
        if (patch.fullName !== undefined) next.fullName = patch.fullName;
        if (patch.phone !== undefined) next.phone = patch.phone ?? undefined;
        if (patch.avatarUrl !== undefined) next.avatarUrl = patch.avatarUrl ?? undefined;
        const updated = [...list];
        updated[idx] = next;
        memory = updated;
        localStorage.setItem(KEY, JSON.stringify(updated));
      }
    } catch {
      /* bỏ qua lỗi localStorage */
    }
  }
};

export const allUsers = () => [...SEED_USERS, ...loadRegistered()].map(applyOverride);

export const findUserByEmail = (email: string) => {
  const e = email.trim().toLowerCase();
  return allUsers().find((u) => u.email.toLowerCase() === e);
};

export const findUserById = (id: number) => allUsers().find((u) => u.id === id);

export const addUser = (data: Pick<MockUser, 'fullName' | 'email' | 'password'>): MockUser => {
  const created: MockUser = { ...data, id: Math.max(...allUsers().map((u) => u.id)) + 1, role: 'USER', isActive: true, walletBalance: 0 };
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
