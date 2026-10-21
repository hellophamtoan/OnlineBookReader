import type { FormEvent } from 'react';
import { RULES } from '../../config/rules';
import type { BookFilterState, FilterPatch } from '../../utils/bookFilters';
import type { Option } from '../../types';

interface BookFiltersProps {
  filters: BookFilterState;
  keyword: string;
  categories: Option[];
  authors: Option[]; // rỗng -> ẩn bộ lọc (BE chưa có API tác giả)
  publishers: Option[]; // rỗng -> ẩn bộ lọc
  canClear: boolean;
  onKeywordChange: (v: string) => void;
  onKeywordSubmit: () => void;
  onChange: (patch: FilterPatch) => void;
  onClear: () => void;
}

const toId = (v: string) => (v ? Number(v) : undefined);

// Bộ lọc của UC003 bước 3: từ khóa, thể loại, tác giả, NXB, hình thức
export default function BookFilters({
  filters, keyword, categories, authors, publishers, canClear, onKeywordChange, onKeywordSubmit, onChange, onClear,
}: BookFiltersProps) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onKeywordSubmit();
  };

  return (
    <aside className="filters" aria-label="Bộ lọc sách">
      <form onSubmit={submit} role="search" className="filters__group">
        <label className="filters__label" htmlFor="f-search">Từ khóa</label>
        <input
          id="f-search"
          type="search"
          className="input"
          placeholder="Tên sách hoặc tác giả"
          value={keyword}
          maxLength={RULES.SEARCH_MAX}
          onChange={(e) => onKeywordChange(e.target.value)}
        />
      </form>

      <fieldset className="filters__group">
        <legend className="filters__label">Thể loại</legend>
        <ul className="filters__list">
          <li>
            <button type="button" className="filters__item" aria-pressed={!filters.categoryId} onClick={() => onChange({ categoryId: undefined })}>
              Tất cả thể loại
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <button type="button" className="filters__item" aria-pressed={filters.categoryId === c.id} onClick={() => onChange({ categoryId: c.id })}>
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      </fieldset>

      {authors.length > 0 && (
        <div className="filters__group">
          <label className="filters__label" htmlFor="f-author">Tác giả</label>
          <select id="f-author" className="input" value={filters.authorId ?? ''} onChange={(e) => onChange({ authorId: toId(e.target.value) })}>
            <option value="">Tất cả tác giả</option>
            {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
      )}

      {publishers.length > 0 && (
        <div className="filters__group">
          <label className="filters__label" htmlFor="f-pub">Nhà xuất bản</label>
          <select id="f-pub" className="input" value={filters.publisherId ?? ''} onChange={(e) => onChange({ publisherId: toId(e.target.value) })}>
            <option value="">Tất cả nhà xuất bản</option>
            {publishers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <div className="filters__group">
        <label className="filters__label" htmlFor="f-format">Hình thức</label>
        <select id="f-format" className="input" value={filters.format} onChange={(e) => onChange({ format: e.target.value })}>
          <option value="all">Sách giấy và e-book</option>
          <option value="ebook">Có bản e-book</option>
          <option value="print">Chỉ có bản giấy</option>
        </select>
      </div>

      {canClear && <button type="button" className="btn btn--ghost btn--block" onClick={onClear}>Xóa bộ lọc</button>}
    </aside>
  );
}
