import { ROLE_LABELS } from '../../config/profile';
import type { UserProfile } from '../../types';
import { formatDate, formatPrice } from '../../utils/format';
import Avatar from '../common/Avatar';

// UC012 bước 2: hiển thị hồ sơ hiện tại (chỉ đọc). Số dư ví chỉ để xem: tiền được cửa hàng nạp thủ công, người dùng không tự sửa.
export default function ProfileInfo({ profile, onEdit }: { profile: UserProfile; onEdit: () => void }) {
  const rows: { label: string; value: string }[] = [
    { label: 'Email', value: profile.email },
    { label: 'Số điện thoại', value: profile.phone ?? 'Chưa cập nhật' },
    { label: 'Vai trò', value: ROLE_LABELS[profile.role] },
    { label: 'Ngày tham gia', value: formatDate(profile.createdAt) || '—' },
    ...(profile.role === 'USER' ? [{ label: 'Số dư ví', value: formatPrice(profile.walletBalance) }] : []),
  ];

  return (
    <section className="profile-card" aria-label="Thông tin cá nhân">
      <div className="profile-card__head">
        <Avatar name={profile.fullName} src={profile.avatarUrl} size="lg" />
        <div>
          <h2 className="profile-card__name">{profile.fullName}</h2>
          <p className="profile-card__email">{profile.email}</p>
        </div>
      </div>

      <dl className="detail__meta profile-card__meta">
        {rows.map((r) => (
          <div key={r.label} className="profile-card__row">
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      {profile.role === 'USER' && <p className="field__hint">Muốn nạp thêm tiền vào ví? Vui lòng liên hệ cửa hàng.</p>}

      <div className="profile-card__actions">
        <button type="button" className="btn btn--primary" onClick={onEdit}>Chỉnh sửa thông tin</button>
      </div>
    </section>
  );
}
