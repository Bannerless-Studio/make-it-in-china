const FOCUSABLE = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function trapFocus(
  container: HTMLElement,
  onEscape?: () => void,
): () => void {
  const focusables = (): HTMLElement[] => (
    [...container.querySelectorAll<HTMLElement>(FOCUSABLE)]
      .filter(element => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
  );

  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && onEscape) {
      event.preventDefault();
      onEscape();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = focusables();
    event.preventDefault();
    if (!items.length) {
      container.focus();
      return;
    }
    const current = document.activeElement instanceof HTMLElement
      ? items.indexOf(document.activeElement)
      : -1;
    const step = event.shiftKey ? -1 : 1;
    const next = items[(current + step + items.length) % items.length];
    next.focus();
  };

  container.addEventListener('keydown', onKeydown);
  requestAnimationFrame(() => (focusables()[0] ?? container).focus());
  return () => container.removeEventListener('keydown', onKeydown);
}

export function restoreFocus(target: HTMLElement | null, fallbackId = 'menu-button'): void {
  if (target?.isConnected) {
    target.focus();
    return;
  }
  const fallback = document.getElementById(fallbackId);
  if (fallback instanceof HTMLElement) fallback.focus();
}
