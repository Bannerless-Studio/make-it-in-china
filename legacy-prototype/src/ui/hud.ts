import type { GameState } from '../engine';
import type { AudioManager } from '../audio/manager';

type Toast = { text: string; tone: 'gain' | 'loss' | 'notice' };

export function createHud(
  root: HTMLElement,
  onSleep: () => void,
  onMenu: () => void,
  audio: AudioManager,
) {
  const element = document.createElement('aside');
  element.id = 'game-hud';
  element.setAttribute('aria-label', 'Game status');
  element.innerHTML = `
    <div class="hud-strip">
      <span id="hud-day"></span>
      <span id="hud-slots" aria-label="Action slots"></span>
      <strong id="hud-wallet"></strong>
      <span id="hud-gate-badge" hidden>Gate claimed</span>
      <span class="hud-spacer"></span>
      <button id="mute-button" type="button" aria-label="Mute speech"></button>
      <button id="menu-button" type="button" aria-label="Open pause menu">Menu</button>
    </div>
    <div id="hud-objective"><span>Today</span><strong></strong></div>
    <button id="sleep-button" type="button">End day</button>
    <div id="wallet-toast" aria-live="polite" hidden></div>`;
  root.append(element);
  const wallet = element.querySelector<HTMLElement>('#hud-wallet')!;
  const day = element.querySelector<HTMLElement>('#hud-day')!;
  const slots = element.querySelector<HTMLElement>('#hud-slots')!;
  const objectiveElement = element.querySelector<HTMLElement>('#hud-objective strong')!;
  const sleep = element.querySelector<HTMLButtonElement>('#sleep-button')!;
  const mute = element.querySelector<HTMLButtonElement>('#mute-button')!;
  const menu = element.querySelector<HTMLButtonElement>('#menu-button')!;
  const toast = element.querySelector<HTMLElement>('#wallet-toast')!;
  const gateBadge = element.querySelector<HTMLElement>('#hud-gate-badge')!;
  const queue: Toast[] = [];
  let showing = false;
  sleep.addEventListener('click', event => {
    event.preventDefault();
    onSleep();
  });
  const renderMute = (): void => {
    const muted = audio.settings().muted;
    mute.textContent = muted ? '🔇' : '🔊';
    mute.title = muted ? 'Unmute speech' : 'Mute speech';
    mute.ariaLabel = mute.title;
    mute.setAttribute('aria-pressed', String(muted));
  };
  renderMute();
  mute.addEventListener('click', event => {
    event.preventDefault();
    audio.toggleMuted();
    renderMute();
  });
  menu.addEventListener('click', onMenu);

  function showNext(): void {
    const next = queue.shift();
    if (!next) {
      showing = false;
      return;
    }
    showing = true;
    toast.textContent = next.text;
    toast.className = next.tone;
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('show'));
    window.setTimeout(() => {
      toast.classList.remove('show');
      window.setTimeout(() => {
        toast.hidden = true;
        toast.textContent = '';
        showNext();
      }, 200);
    }, 1600);
  }

  return {
    render(state: GameState, objective: string): void {
      wallet.textContent = `¥${state.wallet}`;
      day.textContent = `Day ${state.day}`;
      slots.textContent = Array.from(
        { length: state.rules.actionSlots },
        (_, index) => index < state.actionSlots ? '●' : '○',
      ).join('');
      slots.ariaLabel = `${state.actionSlots} of ${state.rules.actionSlots} action slots remaining`;
      objectiveElement.textContent = objective.replace(/^today:\s*/i, '');
      sleep.hidden = false;
    },
    walletChange(amount: number): void {
      if (amount === 0) return;
      wallet.classList.remove('wallet-change');
      requestAnimationFrame(() => wallet.classList.add('wallet-change'));
      queue.push({
        text: `${amount > 0 ? '+' : '−'}¥${Math.abs(amount)}`,
        tone: amount > 0 ? 'gain' : 'loss',
      });
      if (!showing) showNext();
    },
    toast(text: string): void {
      queue.push({ text, tone: 'notice' });
      if (!showing) showNext();
    },
    setGateBadge(claimed: boolean): void {
      gateBadge.hidden = !claimed;
    },
  };
}
