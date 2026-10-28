// UC008 — Quản lý gói đọc + UC013 nạp ví test
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Field from '../../components/common/Field';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/common/States';
import TextAreaField from '../../components/common/TextAreaField';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { planAdminService, type AdminPlan, type AdminUserOption } from '../../services/admin/planadminservice';
import { formatPrice } from '../../utils/format';
import { toMessage } from '../../utils/errors';

const emptyForm = { name: '', description: '', price: '49000', durationDays: '30' };

export default function AdminPlansPage() {
  useDocumentTitle('Quản lý gói đọc');
  const list = useAsync(() => planAdminService.list(), []);
  const users = useAsync(() => planAdminService.listUsers(), []);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [deactivate, setDeactivate] = useState<AdminPlan | null>(null);
  const [removePlan, setRemovePlan] = useState<AdminPlan | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState<AdminPlan | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [topup, setTopup] = useState({ userId: '', amount: '100000', note: 'Nạp test — môi trường học tập' });

  const crumbs = [
    { label: 'Tổng quan', to: ROUTES.ADMIN_HOME },
    { label: 'Gói đọc' },
  ];

  // Chỉ nạp ví cho USER — không hiện ADMIN trong danh sách
  const userOptions = useMemo(
    () => (users.data ?? []).filter((u) => u.role === 'USER'),
    [users.data],
  );
  const selectedUser: AdminUserOption | undefined = useMemo(
    () => userOptions.find((u) => String(u.id) === topup.userId),
    [userOptions, topup.userId],
  );

  useEffect(() => {
    if (userOptions.length === 0) {
      if (topup.userId) setTopup((t) => ({ ...t, userId: '' }));
      return;
    }
    const stillValid = userOptions.some((u) => String(u.id) === topup.userId);
    if (!topup.userId || !stillValid) {
      setTopup((t) => ({ ...t, userId: String(userOptions[0].id) }));
    }
  }, [userOptions, topup.userId]);

  // Khóa cuộn nền khi mở khung thêm/sửa
  useEffect(() => {
    if (!showForm) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showForm]);

  const openAdd = () => {
    setForm(emptyForm);
    setEditPlan(null);
    setShowForm(true);
    setError('');
  };

  const openEdit = (p: AdminPlan) => {
    setEditPlan(p);
    setForm({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      durationDays: String(p.durationDays),
    });
    setShowForm(true);
    setError('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditPlan(null);
    setForm(emptyForm);
  };

  const savePlan = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        durationDays: Number(form.durationDays),
      };
      if (editPlan) {
        await planAdminService.update(editPlan.id, payload);
        setNotice(`Đã cập nhật gói «${payload.name}»`);
      } else {
        await planAdminService.create(payload);
        setNotice('Đã tạo gói mới');
      }
      closeForm();
      list.reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doDeactivate = async () => {
    if (!deactivate) return;
    setBusy(true);
    setError('');
    try {
      await planAdminService.update(deactivate.id, { status: 'inactive' });
      setNotice(`Đã ngừng bán «${deactivate.name}»`);
      setDeactivate(null);
      list.reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doReactivate = async (p: AdminPlan) => {
    setBusy(true);
    setError('');
    try {
      await planAdminService.update(p.id, { status: 'active' });
      setNotice(`Đã mở bán lại «${p.name}»`);
      list.reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doRemove = async () => {
    if (!removePlan) return;
    setBusy(true);
    setError('');
    try {
      await planAdminService.remove(removePlan.id);
      setNotice(`Đã xóa (ngừng cung cấp) «${removePlan.name}»`);
      setRemovePlan(null);
      list.reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doTopup = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!topup.userId) {
      setError('Vui lòng chọn người dùng để nạp ví');
      return;
    }
    setBusy(true);
    try {
      const data = await planAdminService.topupWallet(Number(topup.userId), Number(topup.amount), topup.note);
      setNotice(
        `Đã nạp ${formatPrice(data.amount)} cho user #${data.userId}. Số dư mới: ${formatPrice(data.balance)}. (Môi trường học tập)`,
      );
      users.reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const formModal =
    showForm && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="overlay"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !busy) closeForm();
            }}
          >
            <div className="dialog admin-plan-dialog" role="dialog" aria-modal="true" aria-labelledby="plan-form-title">
              <h2 id="plan-form-title" className="dialog__title">
                {editPlan ? `Sửa gói #${editPlan.id}` : 'Thêm gói đọc'}
              </h2>
              <form className="admin-form admin-form--aligned" onSubmit={savePlan}>
                <Field
                  label="Tên gói"
                  name="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <TextAreaField
                  label="Mô tả"
                  name="description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
                <div className="admin-form__row">
                  <Field
                    label="Giá (₫)"
                    name="price"
                    inputMode="numeric"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  />
                  <Field
                    label="Số ngày"
                    name="durationDays"
                    inputMode="numeric"
                    value={form.durationDays}
                    onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))}
                  />
                </div>
                <div className="dialog__actions">
                  <button type="button" className="btn btn--ghost" onClick={closeForm} disabled={busy}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn--primary" disabled={busy}>
                    {editPlan ? 'Lưu thay đổi' : 'Tạo gói'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <AdminPageHeader
        title="Gói đọc"
        subtitle="Quản lý gói dịch vụ đọc · nạp ví test (học tập)"
        crumbs={crumbs}
        actions={
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            + Thêm gói đọc
          </button>
        }
      />

      {notice && (
        <div className="alert alert--success admin-alert" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="alert alert--error admin-alert" role="alert">
          {error}
        </div>
      )}

      {list.loading && !list.data ? (
        <LoadingBlock label="Đang tải gói..." />
      ) : list.error ? (
        <ErrorState message={toMessage(list.error)} onRetry={list.reload} />
      ) : (
        <div className="table-wrap" style={{ marginBottom: 28 }}>
          <table className="table table--plans">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tên</th>
                <th>Giá</th>
                <th>Ngày</th>
                <th>Trạng thái</th>
                <th className="table__actions-col table__actions-col--center">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((p) => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td className="table__strong">
                    {p.name}
                    {p.isFree ? ' (free)' : ''}
                  </td>
                  <td>{formatPrice(p.price)}</td>
                  <td>{p.durationDays}</td>
                  <td>
                    <span className={p.status === 'active' ? 'tag tag--ok' : 'tag'}>
                      {p.status === 'active' ? 'Đang bán' : 'Ngừng bán'}
                    </span>
                  </td>
                  <td className="table__actions table__actions--center">
                    <div className="plan-actions">
                      <button type="button" className="btn btn--ghost btn--sm plan-actions__btn" disabled={busy} onClick={() => openEdit(p)}>
                        Sửa
                      </button>
                      {p.status === 'active' ? (
                        <button type="button" className="btn btn--ghost btn--sm plan-actions__btn" disabled={busy} onClick={() => setDeactivate(p)}>
                          Ngừng bán
                        </button>
                      ) : (
                        <button type="button" className="btn btn--ghost btn--sm plan-actions__btn" disabled={busy} onClick={() => doReactivate(p)}>
                          Bán lại
                        </button>
                      )}
                      <button type="button" className="btn btn--ghost btn--sm plan-actions__btn" disabled={busy} onClick={() => setRemovePlan(p)}>
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(list.data ?? []).length === 0 && <EmptyState title="Chưa có gói" />}
        </div>
      )}

      <form className="admin-form form-section admin-form--aligned" onSubmit={doTopup}>
        <legend className="form-section__title">Nạp ví user (UC013 — học tập)</legend>
        <p className="field__hint">Chỉ dùng để test thanh toán ví / mua gói. Không phải cổng thanh toán thật.</p>

        <label className="field">
          <span className="field__label">User (ID — Họ và tên)</span>
          <select
            className="input"
            name="userId"
            value={topup.userId}
            onChange={(e) => setTopup((t) => ({ ...t, userId: e.target.value }))}
          >
            <option value="">— Chọn user —</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                #{u.id} — {u.fullName}
              </option>
            ))}
          </select>
        </label>

        {selectedUser && (
          <section className="admin-user-card" aria-label="Thông tin cá nhân (chỉ xem)">
            <h3 className="admin-user-card__title">{selectedUser.fullName}</h3>
            <p className="admin-user-card__sub">{selectedUser.email || '—'}</p>
            <dl className="admin-user-card__list">
              <div className="admin-user-card__row">
                <dt>ID</dt>
                <dd>#{selectedUser.id}</dd>
              </div>
              <div className="admin-user-card__row">
                <dt>Họ và tên</dt>
                <dd>{selectedUser.fullName}</dd>
              </div>
              <div className="admin-user-card__row">
                <dt>Email</dt>
                <dd>{selectedUser.email || '—'}</dd>
              </div>
              <div className="admin-user-card__row">
                <dt>Số điện thoại</dt>
                <dd>{selectedUser.phone || 'Chưa cập nhật'}</dd>
              </div>
              <div className="admin-user-card__row">
                <dt>Vai trò</dt>
                <dd>USER</dd>
              </div>
              <div className="admin-user-card__row">
                <dt>Số dư ví</dt>
                <dd>
                  <strong>{formatPrice(selectedUser.walletBalance ?? 0)}</strong>
                </dd>
              </div>
            </dl>
          </section>
        )}

        <div className="admin-form__row">
          <Field
            label="Số tiền nạp (₫)"
            name="amount"
            value={topup.amount}
            onChange={(e) => setTopup((t) => ({ ...t, amount: e.target.value }))}
          />
          <Field
            label="Ghi chú"
            name="note"
            value={topup.note}
            onChange={(e) => setTopup((t) => ({ ...t, note: e.target.value }))}
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={busy || !topup.userId}>
          Nạp ví
        </button>
      </form>

      {formModal}

      <ConfirmDialog
        open={!!deactivate}
        title="Ngừng bán gói?"
        message={
          deactivate ? `«${deactivate.name}» sẽ không bán mới. User đã mua vẫn giữ quyền đến hết hạn.` : ''
        }
        confirmLabel="Ngừng bán"
        cancelLabel="Hủy"
        busy={busy}
        onConfirm={doDeactivate}
        onCancel={() => setDeactivate(null)}
      />

      <ConfirmDialog
        open={!!removePlan}
        title="Xóa gói?"
        message={
          removePlan
            ? `«${removePlan.name}» sẽ chuyển sang ngừng cung cấp (xóa mềm). User đã mua vẫn đọc đến hết hạn.`
            : ''
        }
        confirmLabel="Xóa"
        cancelLabel="Hủy"
        busy={busy}
        onConfirm={doRemove}
        onCancel={() => setRemovePlan(null)}
      />
    </>
  );
}
