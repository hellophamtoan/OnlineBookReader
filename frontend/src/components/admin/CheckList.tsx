import type { TaxonomyItem } from '../../types';

interface CheckListProps {
  legend: string;
  options: TaxonomyItem[];
  selected: number[];
  error?: string;
  hint?: string;
  onChange: (ids: number[]) => void;
}

// Danh sách ô tích chọn nhiều (tác giả, thể loại của sách). Mục ngừng hoạt động chỉ giữ lại nếu đang được chọn, không cho chọn mới.
export default function CheckList({ legend, options, selected, error, hint, onChange }: CheckListProps) {
  const toggle = (id: number) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <fieldset className="checklist">
      <legend className="field__label">{legend}</legend>
      <ul className="checklist__list">
        {options.map((o) => {
          const checked = selected.includes(o.id);
          const locked = o.status === 'inactive' && !checked;
          return (
            <li key={o.id}>
              <label className={`check${locked ? ' is-disabled' : ''}`}>
                <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggle(o.id)} />
                <span>{o.name}{o.status === 'inactive' && <em className="check__note"> (ngừng hoạt động)</em>}</span>
              </label>
            </li>
          );
        })}
        {options.length === 0 && <li className="field__hint">Chưa có mục nào. Hãy thêm ở trang quản lý tương ứng.</li>}
      </ul>
      {error ? <p className="field__error" role="alert">{error}</p> : hint ? <p className="field__hint">{hint}</p> : null}
    </fieldset>
  );
}
