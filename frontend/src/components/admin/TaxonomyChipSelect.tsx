// Chọn nhiều mục danh mục kiểu NXB: một <select> + chip đã chọn.
import type { TaxonomyItem } from '../../types';

interface Props {
  legend: string;
  options: TaxonomyItem[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  error?: string;
  /** Tên lấy từ EPUB chưa có trong danh mục */
  pendingNames?: string[];
  onRemovePending?: (name: string) => void;
}

export default function TaxonomyChipSelect({
  legend,
  options,
  selectedIds,
  onChange,
  error,
  pendingNames = [],
  onRemovePending,
}: Props) {
  const available = options.filter((o) => o.status === 'active' || selectedIds.includes(o.id));
  const selected = available.filter((o) => selectedIds.includes(o.id));
  const toAdd = available.filter((o) => !selectedIds.includes(o.id));

  return (
    <div className="field" style={{ marginBottom: 16 }}>
      <span className="field__label">{legend}</span>

      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {selected.map((o) => (
            <span
              key={o.id}
              className="tag"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {o.name}
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ padding: '0 6px', minWidth: 0, lineHeight: 1 }}
                aria-label={`Bỏ ${o.name}`}
                onClick={() => onChange(selectedIds.filter((id) => id !== o.id))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {pendingNames.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {pendingNames.map((name) => (
            <span
              key={name}
              className="tag"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderStyle: 'dashed',
                opacity: 0.95,
              }}
              title="Chưa có trong danh mục"
            >
              {name} <em style={{ fontSize: 12, fontWeight: 400 }}>(chưa có)</em>
              {onRemovePending && (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  style={{ padding: '0 6px', minWidth: 0, lineHeight: 1 }}
                  aria-label={`Bỏ ${name}`}
                  onClick={() => onRemovePending(name)}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <select
        className="input"
        value=""
        aria-label={`Thêm ${legend}`}
        onChange={(e) => {
          const id = Number(e.target.value);
          if (id && !selectedIds.includes(id)) onChange([...selectedIds, id]);
          e.target.value = '';
        }}
      >
        <option value="">— Chọn {legend.toLowerCase()} để thêm —</option>
        {toAdd.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>

      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
