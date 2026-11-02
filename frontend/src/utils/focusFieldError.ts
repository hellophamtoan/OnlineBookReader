/**
 * Khi form báo lỗi đỏ: cuộn + focus ô đầu tiên bị lỗi để người dùng sửa.
 * Gọi sau setErrors (dùng rAF để DOM kịp gắn aria-invalid / field__error).
 */

function isErrorValue(v: unknown): boolean {
  if (v == null || v === false) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

/** Thứ tự ưu tiên theo key trong object errors (thường là thứ tự field trên form) */
export function firstErrorFields(errors: Record<string, unknown>): string[] {
  return Object.keys(errors).filter((k) => isErrorValue(errors[k]));
}

export function focusFirstFieldError(
  errors: Record<string, unknown>,
  root?: ParentNode | Document | null,
): void {
  const fields = firstErrorFields(errors);
  const scope: ParentNode = root ?? document;

  const tryFocus = (el: HTMLElement) => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const focusable =
      el.matches('input, select, textarea, button')
        ? el
        : el.querySelector<HTMLElement>('input, select, textarea, button');
    focusable?.focus({ preventScroll: true });
  };

  for (const name of fields) {
    // name="field" trên input/select/textarea
    const byName = scope.querySelector<HTMLElement>(`[name="${CSS.escape(name)}"]`);
    if (byName) {
      tryFocus(byName);
      return;
    }
    // id / data-field fallback
    const byData = scope.querySelector<HTMLElement>(`[data-field="${CSS.escape(name)}"]`);
    if (byData) {
      tryFocus(byData);
      return;
    }
  }

  // Fallback: dòng lỗi đỏ đầu tiên trong scope
  const errNode = scope.querySelector<HTMLElement>('.field__error, [role="alert"].field__error');
  if (errNode) {
    const field = errNode.closest('.field') as HTMLElement | null;
    if (field) tryFocus(field);
    else errNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

/** Gọi ngay sau setState lỗi — đợi 2 frame để React gắn class lỗi */
export function scheduleFocusFirstFieldError(
  errors: Record<string, unknown>,
  root?: ParentNode | Document | null,
): void {
  if (!firstErrorFields(errors).length) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => focusFirstFieldError(errors, root));
  });
}
