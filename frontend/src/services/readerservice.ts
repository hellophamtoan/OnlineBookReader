// services/readerservice.ts
// UC006 — API-10..13 (API_Tuan2). BE thật: USER + gói đọc còn hiệu lực.
import type { Chapter, ChapterList, ReadingProgress, SaveProgressPayload } from '../types';
import { api } from './api';
import { ENDPOINTS } from './endpoints';
import { mapChapter, mapChapterList, mapProgress } from './readermappers';

const clampScroll = (n: number | undefined) => {
  if (n === undefined || Number.isNaN(n)) return undefined;
  return Math.min(100, Math.max(0, n));
};

export const readerService = {
  async getChapterList(bookId: number): Promise<ChapterList> {
    return mapChapterList((await api.get(ENDPOINTS.reading.chapters(bookId))).data);
  },

  async getChapter(bookId: number, chapterNumber: number): Promise<Chapter> {
    return mapChapter((await api.get(ENDPOINTS.reading.chapter(bookId, chapterNumber))).data);
  },

  async getProgress(bookId: number): Promise<ReadingProgress> {
    return mapProgress((await api.get(ENDPOINTS.reading.progress(bookId))).data);
  },

  async saveProgress(bookId: number, payload: SaveProgressPayload): Promise<ReadingProgress> {
    const body: Record<string, unknown> = {
      chapterNumber: payload.chapterNumber,
    };
    const sp = clampScroll(payload.scrollPercent);
    if (sp !== undefined) body.scrollPercent = sp;
    if (payload.fontFamily) body.fontFamily = payload.fontFamily;
    if (payload.fontSize !== undefined) {
      const fs = Math.trunc(Number(payload.fontSize));
      if (fs >= 8 && fs <= 72) body.fontSize = fs;
    }
    return mapProgress((await api.put(ENDPOINTS.reading.progress(bookId), body)).data);
  },
};
