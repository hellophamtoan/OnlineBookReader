interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

// 1 … 4 5 [6] 7 8 … 20
const windowed = (page: number, total: number): (number | 'gap')[] => {
  const set = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...set].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['gap' as const, p] : [p]));
};

export default function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Phân trang">
      <button type="button" className="pagination__btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>Trang trước</button>
      {windowed(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`g${i}`} className="pagination__gap" aria-hidden="true">…</span>
        ) : (
          <button
            key={p}
            type="button"
            className={`pagination__btn pagination__num${p === page ? ' is-current' : ''}`}
            aria-current={p === page ? 'page' : undefined}
            aria-label={`Trang ${p}`}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        )
      )}
      <button type="button" className="pagination__btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Trang sau</button>
    </nav>
  );
}
