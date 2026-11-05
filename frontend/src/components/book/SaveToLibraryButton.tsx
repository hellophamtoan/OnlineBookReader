// Nút lưu/gỡ thư viện — đặt dưới ảnh bìa ở trang chi tiết sách (chỉ USER)
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { libraryService } from '../../services/libraryservice';
import type { Book } from '../../types';

export default function SaveToLibraryButton({ book }: { book: Pick<Book, 'id'> }) {
  const { user } = useAuth();
  const [inLibrary, setInLibrary] = useState(false);
  const [busy, setBusy] = useState(false);

  const isUser = user?.role === 'USER';

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

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
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
      setBusy(false);
    }
  };

  return (
    <div className="detail-actions" role="group" aria-label="Thư viện">
      <button type="button" className="btn btn--ghost" disabled={busy} onClick={toggle}>
        {busy ? '...' : inLibrary ? '📚 Đã lưu · Gỡ' : '📚 Lưu vào thư viện'}
      </button>
    </div>
  );
}
