// UC012 - Quản lý thông tin cá nhân (API-08 xem, API-09 sửa). Dùng chung cho Người dùng (/profile, khung site)
// và Admin (/admin/profile, khung quản trị): chỉ khác khung bao ngoài, truyền variant="admin" ở App.tsx.
import { useState } from 'react';
import { ErrorState, LoadingBlock } from '../components/common/States';
import ProfileForm from '../components/profile/ProfileForm';
import ProfileInfo from '../components/profile/ProfileInfo';
import { PROFILE_MESSAGES } from '../config/profile';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { userService } from '../services/userservice';
import type { UserProfile } from '../types';
import { toMessage } from '../utils/errors';

export default function ProfilePage({ variant = 'site' }: { variant?: 'site' | 'admin' }) {
  useDocumentTitle('Thông tin cá nhân');
  const { updateUser } = useAuth();
  const { data, loading, error, reload } = useAsync(() => userService.getProfile(), []);
  const [saved, setSaved] = useState<UserProfile | null>(null); // bản mới nhất sau khi lưu
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState('');

  const profile = saved ?? data;
  const frame = variant === 'admin' ? 'profile-page' : 'container page profile-page';

  if (loading && !profile) return <div className={frame}><LoadingBlock label="Đang tải thông tin cá nhân..." /></div>;
  if (error || !profile) return <div className={frame}><ErrorState message={toMessage(error)} onRetry={reload} /></div>;

  // Bước 7-8: lưu xong -> cập nhật tên/ảnh đang hiển thị ở Header, báo thành công, quay về chế độ xem
  const handleSaved = (next: UserProfile) => {
    setSaved(next);
    setEditing(false);
    updateUser({ fullName: next.fullName, email: next.email, avatarUrl: next.avatarUrl });
    setNotice(PROFILE_MESSAGES.saved);
  };

  return (
    <div className={frame}>
      <h1 className="page__title">Thông tin cá nhân</h1>
      {notice && <div className="alert alert--success profile-page__notice" role="status">{notice}</div>}
      {editing ? (
        <ProfileForm profile={profile} onSaved={handleSaved} onCancel={() => setEditing(false)} />
      ) : (
        <ProfileInfo profile={profile} onEdit={() => { setNotice(''); setEditing(true); }} />
      )}
    </div>
  );
}
