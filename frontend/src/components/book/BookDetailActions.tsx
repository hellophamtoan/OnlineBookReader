import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { libraryService } from '../../services/libraryservice';
import type { Book } from '../../types';

/** Nút lưu thư viện — chỉ trang chi tiết sách, USER đã đăng nhập */
export default function BookDetailActions({ book }: { book: Book }) {
  const { user } = useAuth();
  const isUser = user?.role === 'USER';
  const [inLibrary, setInLibrary] = useState(false);
  const [busyLib, setBusyLib] = useState(false);

  useEffect(() => {
    if (!isUser) return;
    let cancelled = false;
    libraryService
      .status(book.id)
      .then((lib) => {
        if (!cancelled) setInLibrary(lib.inLibrary);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [book.id, isUser, user?.id]);

  if (!isUser) return null;

  const toggleLib = async () => {
    if (busyLib) return;
    setBusyLib(true);
    try {
      if (inLibrary) {
        await libraryService.remove(book.id);
        setInLibrary(false);
      } else {
        await libraryService.add(book.id);
        setInLibrary(true);
      }
    } catch {
      /* ignore */
    } finally {
      setBusyLib(false);
    }
  };

  return (
    <div className="detail-actions" role="group" aria-label="Thư viện">
      <button type="button" className="btn btn--ghost" disabled={busyLib} onClick={toggleLib}>
        {busyLib ? '...' : inLibrary ? '📚 Đã lưu · Gỡ' : '📚 Lưu vào thư viện'}
      </button>
    </div>
  );
}
