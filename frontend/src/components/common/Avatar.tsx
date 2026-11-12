import { useEffect, useState } from 'react';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Ảnh đại diện tròn (UC012). Không có ảnh hoặc ảnh lỗi thì hiện chữ cái đầu của tên.
export default function Avatar({ name, src, size = 'sm', className = '' }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  return (
    <span className={`avatar avatar--${size} ${className}`.trim()} aria-hidden="true">
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}
