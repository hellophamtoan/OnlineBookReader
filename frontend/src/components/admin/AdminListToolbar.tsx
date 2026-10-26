import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import type { EntityStatus } from '../../types';

interface AdminListToolbarProps {
  search: string;
  status?: EntityStatus;
  placeholder: string;
  onSearch: (q: string) => void;
  onStatus: (s: EntityStatus | '') => void;
  children?: ReactNode; // nút phụ bên phải
}

// Thanh tìm kiếm + lọc trạng thái của các trang danh sách quản trị. Gõ xong 0,4 giây mới gọi (giống trang Sách).
export default function AdminListToolbar({ search, status, placeholder, onSearch, onStatus, children }: AdminListToolbarProps) {
  const [text, setText] = useState(search);
  const debounced = useDebounce(text, 400);

  useEffect(() => setText(search), [search]);
  useEffect(() => {
    if (debounced.trim() !== search) onSearch(debounced.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="admin-toolbar" role="search">
      <input type="search" className="input" placeholder={placeholder} aria-label="Tìm kiếm" value={text} maxLength={100} onChange={(e) => setText(e.target.value)} />
      <select className="input" aria-label="Lọc theo trạng thái" value={status ?? ''} onChange={(e) => onStatus(e.target.value as EntityStatus | '')}>
        <option value="">Tất cả trạng thái</option>
        <option value="active">Đang hoạt động</option>
        <option value="inactive">Ngừng hoạt động</option>
      </select>
      {children}
    </div>
  );
}
