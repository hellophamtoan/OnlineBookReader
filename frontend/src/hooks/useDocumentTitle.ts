// hooks/useDocumentTitle.ts
import { useEffect } from 'react';
import { BRAND_NAME } from '../config/rules';

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${BRAND_NAME}` : BRAND_NAME;
  }, [title]);
}
