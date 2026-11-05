// UC008 — Quản lý gói đọc + UC013 nạp ví test
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import AdminPlanFormDialog, { type PlanFormState } from '../../components/admin/AdminPlanFormDialog';
import AdminWalletTopup from '../../components/admin/AdminWalletTopup';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { EmptyState, ErrorState, LoadingBlock } from '../../components/common/States';
import { ROUTES } from '../../config/routes';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { planAdminService, type AdminPlan, type AdminUserOption } from '../../services/admin/planadminservice';
import { formatPrice } from '../../utils/format';
import {
  LIFETIME_DAYS,
  PLAN_KIND_LABEL,
  PLAN_MIN_DAYS,
  type PlanKind,
} from '../../utils/planDates';
import { toMessage } from '../../utils/errors';

const emptyForm: PlanFormState = {
  name: '',
  description: '',
  planKind: 'fixed',
  basePrice30: '60000',
  price: '60000',
  durationDays: String(PLAN_MIN_DAYS),
};

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
  const [topupHistoryKey, setTopupHistoryKey] = useState(0);
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
    setForm({ ...emptyForm });
    setEditPlan(null);
    setShowForm(true);
    setError('');
  };

  const openEdit = (p: AdminPlan) => {
    setEditPlan(p);
    setForm({
      name: p.name,
      description: p.description || '',
      planKind: p.planKind ?? 'fixed',
      basePrice30: String(p.basePrice30 ?? 60000),
      price: String(p.price),
      durationDays: String(p.durationDays || PLAN_MIN_DAYS),
    });
    setShowForm(true);
    setError('');
  };

  const closeForm = () => {
    setShowForm(false);
    setEditPlan(null);
    setForm(emptyForm);
  };

  const onKindChange = (planKind: PlanKind) => {
    setForm((f) => {
      const base = Number(f.basePrice30) || 60000;
      if (planKind === 'custom') {
        return { ...f, planKind, price: '0', durationDays: String(PLAN_MIN_DAYS) };
      }
      if (planKind === 'lifetime') {
        return {
          ...f,
          planKind,
          durationDays: String(LIFETIME_DAYS),
          price: f.price === '0' ? String(base * 10) : f.price,
        };
      }
      return {
        ...f,
        planKind,
        durationDays: f.durationDays === String(LIFETIME_DAYS) ? String(PLAN_MIN_DAYS) : f.durationDays,
        price: f.price === '0' ? String(base) : f.price,
      };
    });
  };

  /** Giá hiển thị cuối form theo loại */
  const previewPrice = (() => {
    const base = Number(form.basePrice30) || 0;
    if (form.planKind === 'custom') {
      return { label: 'Người dùng chọn ngày → giá lũy tiến từ đơn giá 30 ngày', amount: null as number | null, base };
    }
    if (form.planKind === 'lifetime') {
      const n = Number(form.price);
      return { label: 'Giá trọn đời', amount: Number.isFinite(n) ? n : 0, base };
    }
    const n = Number(form.price);
    return { label: 'Giá gói cố định', amount: Number.isFinite(n) ? n : 0, base };
  })();

  const savePlan = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const planKind = form.planKind;
    if (!form.name.trim()) {
      setError('Vui lòng nhập tên gói');
      return;
    }
    let price = Number(form.price);
    let durationDays = Number(form.durationDays);
    let basePrice30 = Number(form.basePrice30);
    if (planKind === 'custom') {
      if (!Number.isFinite(basePrice30) || basePrice30 < 0) {
        setError('Giá cơ sở 30 ngày không hợp lệ');
        return;
      }
      price = 0;
      durationDays = PLAN_MIN_DAYS;
    } else if (planKind === 'lifetime') {
      durationDays = LIFETIME_DAYS;
      if (!Number.isFinite(price) || price < 0) {
        setError('Giá không hợp lệ');
        return;
      }
    } else {
      if (!Number.isInteger(durationDays) || durationDays < 1) {
        setError('Số ngày phải là số nguyên ≥ 1');
        return;
      }
      if (!Number.isFinite(price) || price < 0) {
        setError('Giá không hợp lệ');
        return;
      }
      // Cố định / trọn đời: không dùng giá cơ sở — lưu theo giá gói
      basePrice30 = price;
    }
    if (planKind === 'lifetime') {
      basePrice30 = price;
    }
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        planKind,
        basePrice30,
        price,
        durationDays,
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
      const wasActive = removePlan.status === 'active';
      await planAdminService.remove(removePlan.id);
      setNotice(
        wasActive
          ? `Đã ngừng bán «${removePlan.name}» (xóa mềm). User đã mua vẫn dùng đến hết hạn.`
          : `Đã xóa hẳn «${removePlan.name}» khỏi danh mục. User đã mua vẫn dùng đến hết hạn.`,
      );
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
      setTopupHistoryKey((k) => k + 1);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  };

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
                <th>Loại</th>
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
                  <td>{PLAN_KIND_LABEL[p.planKind ?? 'fixed']}</td>
                  <td>
                    {p.planKind === 'custom'
                      ? `Cơ sở 30n: ${formatPrice(p.basePrice30 ?? 0)}`
                      : formatPrice(p.price)}
                  </td>
                  <td>{p.planKind === 'lifetime' ? 'Trọn đời' : p.planKind === 'custom' ? 'User chọn' : p.durationDays}</td>
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

      <AdminPlanFormDialog
        open={showForm}
        editId={editPlan?.id ?? null}
        form={form}
        busy={busy}
        previewPrice={previewPrice}
        onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onKindChange={onKindChange}
        onSubmit={savePlan}
        onClose={closeForm}
      />

      <AdminWalletTopup
        userOptions={userOptions}
        selectedUser={selectedUser}
        topup={topup}
        busy={busy}
        historyKey={topupHistoryKey}
        onChange={(patch) => setTopup((t) => ({ ...t, ...patch }))}
        onSubmit={doTopup}
      />

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
        title={removePlan?.status === 'active' ? 'Ngừng bán gói (xóa mềm)?' : 'Xóa hẳn gói?'}
        message={
          removePlan
            ? removePlan.status === 'active'
              ? `«${removePlan.name}» sẽ ngừng bán (xóa mềm). Người dùng đã mua vẫn sử dụng đến hết hạn.`
              : `«${removePlan.name}» sẽ bị xóa hẳn khỏi danh mục. Người dùng đã mua vẫn sử dụng đến hết hạn.`
            : ''
        }
        confirmLabel={removePlan?.status === 'active' ? 'Ngừng bán' : 'Xóa hẳn'}
        cancelLabel="Hủy"
        busy={busy}
        onConfirm={doRemove}
        onCancel={() => setRemovePlan(null)}
      />
    </>
  );
}
