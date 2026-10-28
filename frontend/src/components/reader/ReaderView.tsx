import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { READER, READER_MESSAGES } from '../../config/reader';
import { ROUTES } from '../../config/routes';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useReadingProgress } from '../../hooks/useReadingProgress';
import { ApiError } from '../../services/api';
import { readerService } from '../../services/readerservice';
import type { ChapterSummary, ReadingProgress, ReadingSettings } from '../../types';
import { toMessage } from '../../utils/errors';
import { parseChapterParam, scrollToPercent } from '../../utils/reader';
import { EmptyState, ErrorState, LoadingBlock } from '../common/States';
import ChapterContent from './ChapterContent';
import ChapterListDrawer from './ChapterListDrawer';
import ChapterNav from './ChapterNav';
import SubscriptionRequired from './SubscriptionRequired';

interface ReaderViewProps {
  book: { id: number; title: string };
  chapters: ChapterSummary[]; // mục lục (API-10), đã chắc chắn không rỗng
  initial: ReadingProgress; // tiến trình đã lưu (API-12)
}

// UC006 bước 3-9: mở đúng chỗ đọc dở, hiện chương + công cụ, tự lưu, thoát thì lưu và báo.
// Admin xem sách: không lưu tiến trình.
export default function ReaderView({ book, chapters, initial }: ReaderViewProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [sp, setSp] = useSearchParams();

  // Chương đang mở: ?chapter=N, không có thì chương đã lưu, chưa lưu thì chương đầu (bước 4)
  const chapterNumber = parseChapterParam(sp.get('chapter')) ?? initial.chapterNumber ?? chapters[0].chapterNumber;
  useEffect(() => {
    if (!sp.get('chapter')) setSp({ chapter: String(chapterNumber) }, { replace: true }); // để F5 / gửi link vẫn đúng chương
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [settings, setSettings] = useState<ReadingSettings>({ fontFamily: initial.fontFamily, fontSize: initial.fontSize });
  const [tocOpen, setTocOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [exitError, setExitError] = useState('');
  const [notice, setNotice] = useState('');
  const exitTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(exitTimer.current), []);

  const chapter = useAsync(() => readerService.getChapter(book.id, chapterNumber), [book.id, chapterNumber]);
  // useAsync giữ dữ liệu cũ khi đang tải chương mới: chỉ coi là "sẵn sàng" khi đúng chương và hết tải
  const loaded = chapter.data && chapter.data.chapterNumber === chapterNumber && !chapter.loading ? chapter.data : null;
  useDocumentTitle(loaded ? `${book.title} - ${loaded.title}` : book.title);

  const progress = useReadingProgress({
    bookId: book.id,
    chapterNumber,
    settings,
    initialPercent: isAdmin ? 0 : chapterNumber === initial.chapterNumber ? initial.scrollPercent : 0,
    active: loaded !== null && !isAdmin,
    persist: !isAdmin,
  });

  // Chương hiện ra: user mở đúng chương đã lưu thì cuộn tới chỗ đọc dở; admin luôn về đầu trang
  const firstOpen = useRef(true);
  useLayoutEffect(() => {
    const c = chapter.data;
    if (!c || c.chapterNumber !== chapterNumber) return;
    if (!isAdmin && firstOpen.current && chapterNumber === initial.chapterNumber) scrollToPercent(initial.scrollPercent);
    else window.scrollTo(0, 0);
    firstOpen.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter.data]);

  const goToChapter = (n: number) => {
    setTocOpen(false);
    setSp({ chapter: String(n) }); // đẩy lịch sử trình duyệt: nút Back quay lại chương trước
  };

  const backToBook = () => (isAdmin ? ROUTES.ADMIN_BOOK_DETAIL(book.id) : ROUTES.BOOK_DETAIL(book.id));

  // User: lưu tiến trình rồi về trang sách. Admin: thoát ngay, không lưu.
  const exit = async () => {
    setExitError('');
    setExiting(true);
    if (isAdmin) {
      navigate(backToBook());
      return;
    }
    try {
      await progress.saveNow();
      setNotice(READER_MESSAGES.saved);
      exitTimer.current = window.setTimeout(() => navigate(backToBook()), READER.EXIT_DELAY_MS);
    } catch (err) {
      setExiting(false);
      setExitError(toMessage(err));
    }
  };

  const err = chapter.error;
  const status = err instanceof ApiError ? err.status : 0;
  let body: ReactNode;
  if (err) {
    body =
      status === 403 ? (
        <SubscriptionRequired bookId={book.id} /> // gói hết hạn giữa chừng
      ) : status === 404 ? (
        <EmptyState
          title="Không tìm thấy chương"
          hint={READER_MESSAGES.chapterNotFound}
          action={<button type="button" className="btn btn--primary" onClick={() => goToChapter(chapters[0].chapterNumber)}>Về chương đầu</button>}
        />
      ) : (
        <ErrorState message={toMessage(err)} onRetry={chapter.reload} />
      );
  } else if (!loaded) {
    body = <LoadingBlock label="Đang tải chương..." />;
  } else {
    body = (
      <>
        <ChapterContent chapter={loaded} settings={settings} />
        <ChapterNav
          bookId={book.id}
          prev={loaded.prevChapterNumber}
          next={loaded.nextChapterNumber}
          index={chapters.findIndex((c) => c.chapterNumber === chapterNumber)}
          total={chapters.length}
          settings={settings}
          onSettings={setSettings}
          onGo={goToChapter}
          onOpenToc={() => setTocOpen(true)}
        />
      </>
    );
  }

  return (
    <div className="reader">
      {/* Dùng Header site (MainLayout). Dưới header: mũi tên trở về rồi nội dung chương */}
      <div className="reader-back-row">
        <button
          type="button"
          className="btn btn--ghost reader-back-row__btn"
          onClick={exit}
          disabled={exiting}
          aria-label="Trở về trang sách"
        >
          {exiting && !isAdmin ? 'Đang lưu...' : '← Trở về'}
        </button>
        {!isAdmin && progress.status !== 'idle' && (
          <span className={`reader-bar__status is-${progress.status}`} role="status">
            {progress.status === 'saving' ? 'Đang lưu...' : progress.status === 'saved' ? 'Đã lưu' : 'Lưu thất bại'}
          </span>
        )}
      </div>

      {exitError && (
        <div className="alert alert--error reader__alert" role="alert">
          <span>Chưa lưu được tiến trình: {exitError}</span>
          <span className="reader__alert-actions">
            <button type="button" className="btn btn--ghost" onClick={exit}>Thử lại</button>
            <Link to={backToBook()} className="btn btn--ghost btn--danger">Thoát không lưu</Link>
          </span>
        </div>
      )}

      <div id="reader-main" className="reader__main">{body}</div>

      <ChapterListDrawer open={tocOpen} chapters={chapters} current={chapterNumber} onSelect={goToChapter} onClose={() => setTocOpen(false)} />

      {notice && <div className="reader__toast" role="status">{notice}</div>}
    </div>
  );
}
