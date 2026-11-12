import { useMemo } from 'react';
import { fontStack } from '../../config/reader';
import type { Chapter, ReadingSettings } from '../../types';
import { sanitizeChapterHtml } from '../../utils/sanitize';

// Nội dung một chương. HTML từ BE LUÔN được làm sạch bằng DOMPurify trước khi đưa vào trang (utils/sanitize.ts).
export default function ChapterContent({ chapter, settings }: { chapter: Chapter; settings: ReadingSettings }) {
  const html = useMemo(() => sanitizeChapterHtml(chapter.content), [chapter.content]);
  return (
    <article className="reader-article" style={{ fontFamily: fontStack(settings.fontFamily), fontSize: settings.fontSize }}>
      <h1 className="reader-article__title">{chapter.title}</h1>
      <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
