import { Link } from 'react-router-dom';
import { ROLE_LABELS } from '../../config/profile';
import { ROUTES } from '../../config/routes';
import type { UserProfile } from '../../types';
import { formatDate, formatPrice } from '../../utils/format';
import Avatar from '../common/Avatar';

// [Giao diện] Hồ sơ: thẻ thông tin (ảnh, email, SĐT, địa chỉ, vai trò, ngày tham gia, số dư ví).
export default function ProfileInfo({
  profile,
  onEdit,
}: {
  profile: UserProfile;
  onEdit: () => void;
  onBalanceChange?: (balance: number) => void;
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'Email', value: profile.email },
    { label: 'Số điện thoại', value: profile.phone ?? 'Chưa cập nhật' },
    { label: 'Địa chỉ', value: profile.address ?? 'Chưa cập nhật' },
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

      <div className="profile-card__actions">
        <button type="button" className="btn btn--primary" onClick={onEdit}>
          Chỉnh sửa thông tin
        </button>
        {profile.role === 'USER' && (
          <Link to={ROUTES.WALLET_TOPUP} className="btn btn--secondary">
            Nạp ví
          </Link>
        )}
      </div>
    </section>
  );
}
