import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { favoritesService } from '../../services/favoritesservice';
import { libraryService } from '../../services/libraryservice';
import type { Book } from '../../types';

/** Yêu thích + Thư viện — chỉ trang chi tiết sách */
export default function BookDetailActions({ book }: { book: Book }) {
  const { user } = useAuth();
  const isUser = user?.role === 'USER';
  const [favorited, setFavorited] = useState(false);
  const [inLibrary, setInLibrary] = useState(false);
  const [busyFav, setBusyFav] = useState(false);
  const [busyLib, setBusyLib] = useState(false);

  useEffect(() => {
    if (!isUser) return;
    let cancelled = false;
    Promise.all([favoritesService.status(book.id), libraryService.status(book.id)])
      .then(([fav, lib]) => {
        if (cancelled) return;
        setFavorited(fav.favorited);
        setInLibrary(lib.inLibrary);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [book.id, isUser, user?.id]);

  if (!isUser) return null;

  const toggleFav = async () => {
    if (busyFav) return;
    setBusyFav(true);
    try {
      setFavorited((await favoritesService.toggle(book.id)).favorited);
    } catch {
      /* ignore */
    } finally {
      setBusyFav(false);
    }
  };

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
    <div className="detail-actions" role="group" aria-label="Thư viện và yêu thích">
      <button type="button" className="btn btn--ghost" disabled={busyLib} onClick={toggleLib}>
        {busyLib ? '...' : inLibrary ? '📚 Đã lưu · Gỡ' : '📚 Lưu vào thư viện'}
      </button>
      <button type="button" className="btn btn--ghost" disabled={busyFav} onClick={toggleFav}>
        {busyFav ? '...' : favorited ? '♥ Đã yêu thích' : '♡ Yêu thích'}
      </button>
    </div>
  );
}
