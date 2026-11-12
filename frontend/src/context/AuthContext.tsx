import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { TOKEN_KEY, USER_KEY, UNAUTHORIZED_EVENT } from '../services/api';
import { authService } from '../services/authservice';
import type { AuthUser, Role } from '../types';

export type { AuthUser, Role };

interface AuthContextValue {
  user: AuthUser | null;
  // Gọi sau khi API đăng nhập thành công
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  // UC012: sau khi sửa hồ sơ thành công, cập nhật tên/email/ảnh đang hiển thị (Header, khung quản trị)
  updateUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const readStoredUser = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw && localStorage.getItem(TOKEN_KEY) ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readStoredUser);

  const login = useCallback((token: string, nextUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser((u) => (u ? { ...u, ...patch } : u));
  }, []);

  // Giữ bản sao ở localStorage khớp với state (updateUser chỉ đổi state)
  useEffect(() => {
    if (user && localStorage.getItem(TOKEN_KEY)) localStorage.setItem(USER_KEY, JSON.stringify(user));
  }, [user]);

  // API trả 401 (token hết hạn) hoặc tài khoản bị khóa => tự đăng xuất
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  // Mở lại trang: tin thông tin đã lưu để không bị chớp, đồng thời hỏi BE (API-03) xem phiên còn hiệu lực không.
  // 401/khóa -> api.ts phát UNAUTHORIZED_EVENT -> đăng xuất. Lỗi mạng thì giữ phiên cũ.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    let cancelled = false;
    authService
      .getMe()
      .then((me) => {
        if (cancelled) return;
        localStorage.setItem(USER_KEY, JSON.stringify(me));
        setUser(me);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => ({ user, login, logout, updateUser }), [user, login, logout, updateUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong <AuthProvider>');
  return ctx;
}
