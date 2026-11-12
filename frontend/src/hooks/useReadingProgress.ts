// hooks/useReadingProgress.ts
// UC006 - theo dõi vị trí cuộn và TỰ LƯU tiến trình đọc (API-13).
// Lưu khi: dừng cuộn / đổi chương / đổi font-cỡ chữ sau AUTOSAVE_DELAY_MS, khi ẩn tab, khi rời trang, và khi bấm "Thoát" (saveNow).
// Các lần lưu được xếp hàng nên không bao giờ chạy chồng nhau.
import { useCallback, useEffect, useRef, useState } from 'react';
import { READER } from '../config/reader';
import { readerService } from '../services/readerservice';
import type { ReadingSettings } from '../types';
import { getScrollPercent } from '../utils/reader';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Options {
  bookId: number;
  chapterNumber: number;
  settings: ReadingSettings;
  initialPercent: number; // vị trí đã lưu của chương đang mở (0 nếu chương khác)
  active: boolean; // false khi chương đang tải: không lưu để khỏi ghi đè bằng số liệu của trang trống
  /** false = không lưu tiến trình (vd. admin xem sách) */
  persist?: boolean;
}

export function useReadingProgress({
  bookId,
  chapterNumber,
  settings,
  initialPercent,
  active,
  persist = true,
}: Options) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const percent = useRef(initialPercent);
  const dirty = useRef(false);
  const timer = useRef<number>();
  const queue = useRef<Promise<void>>(Promise.resolve());

  // Luôn đọc giá trị mới nhất trong callback mà không phải tạo lại callback
  const latest = useRef({ bookId, chapterNumber, settings });
  latest.current = { bookId, chapterNumber, settings };
  const activeRef = useRef(active);
  activeRef.current = active;
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const flush = useCallback((): Promise<void> => {
    window.clearTimeout(timer.current);
    if (!persistRef.current) {
      dirty.current = false;
      return Promise.resolve();
    }
    if (!dirty.current || !activeRef.current) return queue.current;
    dirty.current = false;
    const snap = { ...latest.current, scrollPercent: percent.current };

    const run = async () => {
      setStatus('saving');
      try {
        await readerService.saveProgress(snap.bookId, {
          chapterNumber: snap.chapterNumber,
          scrollPercent: snap.scrollPercent,
          fontFamily: snap.settings.fontFamily,
          fontSize: snap.settings.fontSize,
        });
        setStatus('saved');
      } catch (err) {
        dirty.current = true; // lần sau thử lại
        setStatus('error');
        throw err;
      }
    };
    const next = queue.current.catch(() => undefined).then(run);
    queue.current = next;
    return next;
  }, []);

  const schedule = useCallback(() => {
    if (!persistRef.current) return;
    dirty.current = true;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      flush().catch(() => undefined);
    }, READER.AUTOSAVE_DELAY_MS);
  }, [flush]);

  // Lưu NGAY (nút Thoát). Ném lỗi nếu thất bại để nơi gọi báo cho người đọc.
  // Admin (persist=false): resolve ngay, không gọi API.
  const saveNow = useCallback(() => {
    if (!persistRef.current) return Promise.resolve();
    dirty.current = true;
    return flush();
  }, [flush]);

  // Cuộn trang -> cập nhật vị trí
  useEffect(() => {
    const onScroll = () => {
      if (!activeRef.current) return;
      percent.current = getScrollPercent();
      schedule();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [schedule]);

  // Đổi chương (vị trí về 0) hoặc đổi font / cỡ chữ -> lưu. Lần render đầu không lưu.
  const last = useRef({ chapterNumber, fontFamily: settings.fontFamily, fontSize: settings.fontSize });
  useEffect(() => {
    const chapterChanged = last.current.chapterNumber !== chapterNumber;
    const settingsChanged = last.current.fontFamily !== settings.fontFamily || last.current.fontSize !== settings.fontSize;
    if (!chapterChanged && !settingsChanged) return;
    last.current = { chapterNumber, fontFamily: settings.fontFamily, fontSize: settings.fontSize };
    if (chapterChanged) percent.current = 0;
    schedule();
  }, [chapterNumber, settings.fontFamily, settings.fontSize, schedule]);

  // Chương vừa tải xong mà còn thay đổi chưa lưu -> hẹn lưu
  useEffect(() => {
    if (active && dirty.current) schedule();
  }, [active, schedule]);

  // Ẩn tab / rời trang -> lưu nốt
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush().catch(() => undefined);
    };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      flush().catch(() => undefined);
      window.clearTimeout(timer.current);
    };
  }, [flush]);

  return { status, saveNow };
}
