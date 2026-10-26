import { useState } from 'react';
import type { FormEvent } from 'react';
import { ADMIN } from '../../config/admin';
import type { TaxonomyConfig } from '../../config/admin';
import { useForm } from '../../hooks/useForm';
import { ApiError } from '../../services/api';
import { taxonomyService } from '../../services/admin/taxonomyservice';
import type { TaxonomyItem } from '../../types';
import { validateTaxonomyName } from '../../utils/adminValidators';
import { toMessage } from '../../utils/errors';
import Field from '../common/Field';
import Modal from '../common/Modal';
import TextAreaField from '../common/TextAreaField';

interface TaxonomyFormDialogProps {
  config: TaxonomyConfig;
  open: boolean;
  item: TaxonomyItem | null; // null = thêm mới
  onClose: () => void;
  onSaved: (message: string) => void;
}

function TaxonomyForm({ config, item, onClose, onSaved }: Omit<TaxonomyFormDialogProps, 'open'>) {
  const { values, errors, setErrors, setFieldError, onChange } = useForm({ name: item?.name ?? '', bio: item?.bio ?? '' });
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);

  // UC007 nhánh A / B: kiểm tra -> lưu; sai (thiếu, trùng tên) thì báo lỗi và ở lại form (A2a / B2a)
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setGeneralError('');
    const nameError = validateTaxonomyName(values.name);
    setErrors({ name: nameError, bio: '' });
    if (nameError) return;

    const name = values.name.trim();
    try {
      setLoading(true);
      if (item) await taxonomyService.update(config.kind, item.id, { name, bio: values.bio, status: item.status });
      else await taxonomyService.create(config.kind, { name, bio: values.bio });
      onSaved(item ? `Đã cập nhật ${config.singular} "${name}"` : `Đã thêm ${config.singular} "${name}"`);
    } catch (err) {
      setLoading(false);
      if (err instanceof ApiError) {
        if (err.status === 409) return setFieldError('name', err.message);
        const fe = err.errors.find((x) => x.field === 'name');
        if (fe) return setFieldError('name', fe.message);
      }
      setGeneralError(toMessage(err));
    }
  };

  return (
    <Modal open title={item ? `Sửa ${config.singular}` : `Thêm ${config.singular}`} onClose={onClose} busy={loading}>
      <form onSubmit={handleSubmit} noValidate className="dialog-form">
        {generalError && <div className="alert alert--error" role="alert">{generalError}</div>}
        <Field label="Tên" name="name" maxLength={ADMIN.NAME_MAX} placeholder={config.placeholder} value={values.name} error={errors.name} onChange={onChange} />
        {config.hasBio && <TextAreaField label="Tiểu sử (không bắt buộc)" name="bio" rows={4} value={values.bio} error={errors.bio} onChange={onChange} />}
        <div className="dialog__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={loading}>Hủy</button>
          <button type="submit" className="btn btn--primary" disabled={loading}>{loading ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </form>
    </Modal>
  );
}

// key = id mục (hoặc 'new') để mỗi lần mở là một form mới, không còn chữ của lần trước
export default function TaxonomyFormDialog({ open, item, ...rest }: TaxonomyFormDialogProps) {
  if (!open) return null;
  return <TaxonomyForm key={item?.id ?? 'new'} item={item} {...rest} />;
}
