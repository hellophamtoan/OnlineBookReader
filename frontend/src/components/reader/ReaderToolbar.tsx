import type { SaveStatus } from '../../hooks/useReadingProgress';

interface ReaderToolbarProps {
  bookTitle: string;
  chapterTitle?: string;
  saveStatus: SaveStatus;
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Đang lưu...',
  saved: 'Đã lưu',
  error: 'Lưu thất bại',
};

/** Thanh tiêu đề trên cùng trang đọc: tên sách + chương (+ trạng thái lưu). */
export default function ReaderToolbar({ bookTitle, chapterTitle, saveStatus }: ReaderToolbarProps) {
  return (
    <header className="reader-bar" role="banner" aria-label="Thanh tiêu đề đọc sách">
      <div className="reader-bar__title-row">
        <div className="reader-bar__title">
          <span className="reader-bar__book">{bookTitle}</span>
          {chapterTitle ? <span className="reader-bar__chapter">{chapterTitle}</span> : null}
        </div>
        <span className={`reader-bar__status is-${saveStatus}`} role="status">
          {STATUS_TEXT[saveStatus]}
        </span>
      </div>
    </header>
  );
}
