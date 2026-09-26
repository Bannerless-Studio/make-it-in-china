import { describe, expect, it, beforeEach, vi } from 'vitest';
import { trapFocus, restoreFocus } from '../../src/ui/modal';

class FakeElement {
  tagName: string;
  disabled = false;
  hidden = false;
  isConnected = true;
  children: FakeElement[] = [];
  private attrs = new Map<string, string>();
  private listeners = new Map<string, Set<(event: any) => void>>();

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
  }

  append(...kids: FakeElement[]): void {
    this.children.push(...kids);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  addEventListener(type: string, handler: (event: any) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  removeEventListener(type: string, handler: (event: any) => void): void {
    this.listeners.get(type)?.delete(handler);
  }

  dispatch(type: string, event: any): void {
    for (const handler of this.listeners.get(type) ?? []) handler(event);
  }

  focus(): void {
    activeElement = this;
  }

  querySelectorAll(): FakeElement[] {
    const found: FakeElement[] = [];
    const walk = (node: FakeElement): void => {
      for (const child of node.children) {
        if (child.tagName === 'BUTTON' && !child.disabled) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }
}

let activeElement: FakeElement | null = null;

beforeEach(() => {
  activeElement = null;
  (globalThis as any).HTMLElement = FakeElement;
  (globalThis as any).document = {
    get activeElement() {
      return activeElement;
    },
    getElementById: () => null,
  };
  (globalThis as any).requestAnimationFrame = (callback: () => void) => {
    callback();
    return 0;
  };
});

function tabEvent(shiftKey: boolean): { key: string; shiftKey: boolean; preventDefault: () => void } {
  return { key: 'Tab', shiftKey, preventDefault: vi.fn() };
}

describe('trapFocus', () => {
  it('advances focus forward through every focusable and wraps only at the end', () => {
    const container = new FakeElement('div');
    const first = new FakeElement('button');
    const second = new FakeElement('button');
    const third = new FakeElement('button');
    container.append(first, second, third);

    trapFocus(container as unknown as HTMLElement);
    expect(activeElement).toBe(first);

    container.dispatch('keydown', tabEvent(false));
    expect(activeElement).toBe(second);

    container.dispatch('keydown', tabEvent(false));
    expect(activeElement).toBe(third);

    container.dispatch('keydown', tabEvent(false));
    expect(activeElement).toBe(first);
  });

  it('moves focus backward on Shift+Tab and wraps to the last item from the first', () => {
    const container = new FakeElement('div');
    const first = new FakeElement('button');
    const second = new FakeElement('button');
    const third = new FakeElement('button');
    container.append(first, second, third);

    trapFocus(container as unknown as HTMLElement);
    expect(activeElement).toBe(first);

    container.dispatch('keydown', tabEvent(true));
    expect(activeElement).toBe(third);

    container.dispatch('keydown', tabEvent(true));
    expect(activeElement).toBe(second);
  });

  it('runs onEscape and prevents default when Escape is pressed', () => {
    const container = new FakeElement('div');
    container.append(new FakeElement('button'));
    const onEscape = vi.fn();
    trapFocus(container as unknown as HTMLElement, onEscape);

    const event = { key: 'Escape', preventDefault: vi.fn() };
    container.dispatch('keydown', event);
    expect(onEscape).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });
});

describe('restoreFocus', () => {
  it('returns focus to the given opener when it is still connected', () => {
    const opener = new FakeElement('button');
    restoreFocus(opener as unknown as HTMLElement);
    expect(activeElement).toBe(opener);
  });

  it('falls back to the HUD menu button when the opener is gone', () => {
    const menuButton = new FakeElement('button');
    (globalThis as any).document.getElementById = (id: string) => (id === 'menu-button' ? menuButton : null);
    const opener = new FakeElement('button');
    opener.isConnected = false;

    restoreFocus(opener as unknown as HTMLElement);
    expect(activeElement).toBe(menuButton);
  });

  it('does nothing when neither the opener nor the fallback exist', () => {
    activeElement = null;
    restoreFocus(null);
    expect(activeElement).toBeNull();
  });
});
