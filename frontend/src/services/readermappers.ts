// services/readermappers.ts
// UC006 - chuẩn hóa dữ liệu thô của API-10..API-13 về kiểu FE (types/reader.ts).
import { DEFAULT_SETTINGS } from '../config/reader';
import type { Chapter, ChapterList, ChapterSummary, ReadingProgress } from '../types';
import { isObj, num } from './mappers';
import type { Raw } from './mappers';

const mapSummary = (raw: unknown): ChapterSummary => {
  const r: Raw = isObj(raw) ? raw : {};
  return {
    id: Number(r.id),
    chapterNumber: Number(r.chapterNumber),
    title: String(r.title ?? ''),
    isFree: r.isFree === undefined ? undefined : Boolean(r.isFree),
    locked: r.locked === undefined ? undefined : Boolean(r.locked),
  };
};

export const mapChapterList = (data: unknown): ChapterList => {
  const d: Raw = isObj(data) ? data : {};
  const book: Raw = isObj(d.book) ? d.book : {};
  const items = (Array.isArray(d.items) ? d.items.map(mapSummary) : []).sort((a, b) => a.chapterNumber - b.chapterNumber);
  return {
    book: { id: Number(book.id), title: String(book.title ?? '') },
    items,
    freeChapterLimit: num(d.freeChapterLimit) ?? undefined,
    hasActiveSubscription: d.hasActiveSubscription === undefined ? undefined : Boolean(d.hasActiveSubscription),
  };
};

export const mapChapter = (data: unknown): Chapter => {
  const r: Raw = isObj(data) ? data : {};
  return {
    bookId: Number(r.bookId),
    id: Number(r.id),
    chapterNumber: Number(r.chapterNumber),
    title: String(r.title ?? ''),
    content: typeof r.content === 'string' ? r.content : '',
    prevChapterNumber: num(r.prevChapterNumber),
    nextChapterNumber: num(r.nextChapterNumber),
  };
};

export const mapProgress = (data: unknown): ReadingProgress => {
  const r: Raw = isObj(data) ? data : {};
  return {
    bookId: Number(r.bookId),
    chapterId: num(r.chapterId),
    chapterNumber: num(r.chapterNumber),
    scrollPercent: num(r.scrollPercent) ?? 0,
    fontFamily: typeof r.fontFamily === 'string' && r.fontFamily ? r.fontFamily : DEFAULT_SETTINGS.fontFamily,
    fontSize: num(r.fontSize) ?? DEFAULT_SETTINGS.fontSize,
  };
};
