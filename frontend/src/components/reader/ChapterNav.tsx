import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_SETTINGS, FONT_FAMILIES, READER } from '../../config/reader';
import { ROUTES } from '../../config/routes';
import type { ReadingSettings } from '../../types';
import { stepFontSize } from '../../utils/reader';

interface ChapterNavProps {
  bookId: number;
  prev: number | null;
  next: number | null;
  index: number;
  total: number;
  settings: ReadingSettings;
  onSettings: (next: ReadingSettings) => void;
  onGo: (chapterNumber: number) => void;
  onOpenToc: () => void;
}

/** Một hàng: Chương trước | Mục lục | ⚙ | Chương sau */
export default function ChapterNav({
  bookId,
  prev,
  next,
  index,
  total,
  settings,
  onSettings,
  onGo,
  onOpenToc,
}: ChapterNavProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [settingsOpen]);

  const fonts = FONT_FAMILIES.some((f) => f.value === settings.fontFamily)
    ? FONT_FAMILIES
    : [...FONT_FAMILIES, { value: settings.fontFamily, label: settings.fontFamily, stack: '' }];

  return (
    <nav className="reader-nav" aria-label="Chuyển chương">
      <div className="reader-nav__row">
        <button
          type="button"
          className="btn btn--ghost reader-nav__btn"
          disabled={prev === null}
          onClick={() => prev !== null && onGo(prev)}
        >
          ← Chương trước
        </button>

        <button type="button" className="btn btn--ghost reader-nav__toc" onClick={onOpenToc}>
          Mục lục
        </button>

        <div className="reader-nav__gear-wrap" ref={panelRef}>
          <button
            type="button"
            className="btn btn--ghost reader-nav__gear"
            aria-label="Cài đặt font và cỡ chữ"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((o) => !o)}
          >
            ⚙
          </button>
          {settingsOpen && (
            <div className="reader-settings-panel reader-settings-panel--bottom" role="dialog" aria-label="Cài đặt hiển thị">
              <label className="reader-bar__font">
                <span className="reader-settings-panel__label">Font chữ</span>
                <select
                  className="input"
                  value={settings.fontFamily}
                  onChange={(e) => onSettings({ ...settings, fontFamily: e.target.value })}
                >
                  {fonts.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="reader-size" role="group" aria-label="Cỡ chữ">
                <span className="reader-settings-panel__label">Cỡ chữ</span>
                <button
                  type="button"
                  aria-label="Giảm cỡ chữ"
                  disabled={settings.fontSize <= READER.FONT_SIZE_MIN}
                  onClick={() => onSettings({ ...settings, fontSize: stepFontSize(settings.fontSize, -1) })}
                >
                  A−
                </button>
                <span aria-live="polite">{settings.fontSize}</span>
                <button
                  type="button"
                  aria-label="Tăng cỡ chữ"
                  disabled={settings.fontSize >= READER.FONT_SIZE_MAX}
                  onClick={() => onSettings({ ...settings, fontSize: stepFontSize(settings.fontSize, 1) })}
                >
                  A+
                </button>
                <button type="button" className="reader-size__reset" onClick={() => onSettings(DEFAULT_SETTINGS)}>
                  Mặc định
                </button>
              </div>
            </div>
          )}
        </div>

        {next !== null ? (
          <button type="button" className="btn btn--primary reader-nav__btn" onClick={() => onGo(next)}>
            Chương sau →
          </button>
        ) : (
          <Link to={ROUTES.BOOK_DETAIL(bookId)} className="btn btn--primary reader-nav__btn">
            Hết sách · Về trang sách
          </Link>
        )}
      </div>
      <p className="reader-nav__pos">{index >= 0 ? `Chương ${index + 1} / ${total}` : `${total} chương`}</p>
    </nav>
  );
}
