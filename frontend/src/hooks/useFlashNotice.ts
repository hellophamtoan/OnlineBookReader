// hooks/useFlashNotice.ts
// Thông báo "một lần" qua navigate(..., { state: { notice, noticeTone? } }).
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type FlashTone = 'success' | 'error' | 'warning';

type FlashState = {
  notice?: string;
  noticeTone?: FlashTone;
};

export function useFlashNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as FlashState | null) ?? null;
  const incoming = state?.notice ?? '';
  const incomingTone: FlashTone =
    state?.noticeTone === 'error' || state?.noticeTone === 'warning' ? state.noticeTone : 'success';

  const [notice, setNotice] = useState(incoming);
  const [tone, setTone] = useState<FlashTone>(incoming ? incomingTone : 'success');

  useEffect(() => {
    if (incoming) {
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [notice, setNotice, tone, setTone] as const;
}
