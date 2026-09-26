import type { AudioManager } from '../audio/manager';
import type { GameEvent, GameState, GateStatus } from '../engine';
import { trapFocus, restoreFocus } from './modal';
import {
  applyPreferences,
  loadPreferences,
  savePreferences,
  type UiPreferences,
} from './preferences';

interface UiShellOptions {
  hasSave: boolean;
  audio: AudioManager;
  onNewGame: () => void;
  onResetSave: () => void;
  onExport: () => string;
  onImport: (save: string) => void;
  onSleep: () => void;
  onAbandon: () => void;
  getState: () => GameState | null;
  getEvents: () => GameEvent[];
}

type Surface = 'title' | 'pause' | 'settings' | 'help' | 'credits' | 'save' | 'sleep' | 'new-game' | 'money' | 'leave-confirm';

export function createUiShell(root: HTMLElement, options: UiShellOptions) {
  let preferences = loadPreferences();
  let surface: Surface | null = 'title';
  let hasSave = options.hasSave;
  let releaseTrap: (() => void) | null = null;
  let returnSurface: Surface = 'title';
  let settingsReturn: 'title' | 'pause' = 'title';
  let opener: HTMLElement | null = null;
  applyPreferences(preferences);

  const overlay = document.createElement('div');
  overlay.id = 'ui-overlay';
  overlay.className = 'ui-overlay';
  const panel = document.createElement('section');
  panel.className = 'ui-sheet';
  panel.tabIndex = -1;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  overlay.append(panel);
  root.append(overlay);

  const rent = document.createElement('aside');
  rent.id = 'rent-notice';
  rent.className = 'rent-notice';
  rent.setAttribute('role', 'status');
  rent.setAttribute('aria-live', 'polite');
  rent.hidden = true;
  root.append(rent);

  const gate = document.createElement('aside');
  gate.id = 'gate-notice';
  gate.className = 'rent-notice gate-notice';
  gate.setAttribute('role', 'status');
  gate.setAttribute('aria-live', 'polite');
  gate.hidden = true;
  root.append(gate);

  function button(
    label: string,
    action: () => void,
    className = '',
  ): HTMLButtonElement {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = className;
    control.textContent = label;
    control.addEventListener('click', action);
    return control;
  }

  function heading(eyebrow: string, title: string, summary?: string): void {
    const header = document.createElement('header');
    header.className = 'sheet-header';
    const label = document.createElement('span');
    label.className = 'sheet-eyebrow';
    label.textContent = eyebrow;
    const h = document.createElement('h1');
    h.id = 'surface-title';
    h.textContent = title;
    header.append(label, h);
    if (summary) {
      const copy = document.createElement('p');
      copy.textContent = summary;
      header.append(copy);
    }
    panel.append(header);
    panel.setAttribute('aria-labelledby', h.id);
  }

  function close(): void {
    releaseTrap?.();
    releaseTrap = null;
    surface = null;
    overlay.hidden = true;
    panel.replaceChildren();
    restoreFocus(opener);
    opener = null;
  }

  function activate(onEscape?: () => void): void {
    releaseTrap?.();
    overlay.hidden = false;
    releaseTrap = trapFocus(panel, onEscape);
  }

  function open(next: Surface, back: Surface = next === 'title' ? 'title' : 'pause'): void {
    if (surface === null) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    if (next === 'title' || next === 'pause' || next === 'sleep') options.audio.stop();
    surface = next;
    if (next === 'settings' && (back === 'title' || back === 'pause')) settingsReturn = back;
    returnSurface = back;
    panel.replaceChildren();
    panel.className = `ui-sheet ui-sheet-${next}`;
    if (next === 'title') renderTitle();
    if (next === 'pause') renderPause();
    if (next === 'settings') renderSettings();
    if (next === 'help') renderHelp();
    if (next === 'credits') renderCredits();
    if (next === 'save') renderSave();
    if (next === 'sleep') renderSleep();
    if (next === 'new-game') renderNewGame();
    if (next === 'money') renderMoney();
    if (next === 'leave-confirm') renderLeaveConfirm();
  }

  function goBack(): void {
    if (returnSurface === 'title') open('title');
    else if (returnSurface === 'settings') open('settings', settingsReturn);
    else open('pause');
  }

  function renderTitle(): void {
    heading('A Mandarin street story', 'Make It in China', 'Listen first. Work, shop, and find your way through a neighbourhood that grows familiar.');
    const skyline = document.createElement('div');
    skyline.className = 'title-skyline';
    skyline.setAttribute('aria-hidden', 'true');
    skyline.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
    const actions = document.createElement('div');
    actions.className = 'title-actions';
    const continueButton = button('Continue', () => {
      void options.audio.unlock();
      hasSave = true;
      close();
    }, 'button-primary');
    continueButton.disabled = !hasSave;
    actions.append(
      continueButton,
      button('New game', () => {
        void options.audio.unlock();
        if (hasSave) open('new-game', 'title');
        else {
          hasSave = true;
          close();
        }
      }),
      button('Import save', () => open('save', 'title')),
      button('Settings', () => open('settings', 'title')),
      button('Help', () => open('help', 'title')),
      button('Credits', () => open('credits', 'title')),
    );
    panel.append(skyline, actions);
    activate();
  }

  function renderPause(): void {
    heading('Game paused', 'Take a breath', 'The street and speech wait until you resume.');
    const actions = document.createElement('div');
    actions.className = 'menu-list';
    actions.append(
      button('Resume', close, 'button-primary'),
      button('Money', () => open('money', 'pause')),
      button('Controls & help', () => open('help', 'pause')),
      button('Settings', () => open('settings', 'pause')),
      button('Save & import', () => open('save', 'pause')),
      button('Credits', () => open('credits', 'pause')),
      button('Return to title', () => open('title')),
    );
    if (options.getState()?.dialogue) {
      actions.append(button('Leave conversation', () => open('leave-confirm', 'pause'), 'button-danger'));
    }
    panel.append(actions);
    activate(close);
  }

  function renderLeaveConfirm(): void {
    heading('Leave conversation', 'End this conversation?', 'An unfinished action earns ¥0 and keeps its spent slot.');
    const actions = document.createElement('div');
    actions.className = 'sheet-actions';
    actions.append(
      button('Cancel', goBack),
      button('Leave conversation', () => {
        options.onAbandon();
        close();
      }, 'button-danger'),
    );
    panel.append(actions);
    activate(goBack);
  }

  const REASON_LABEL: Record<string, string> = {
    reward: 'Wage', penalty: 'Mix-up', purchase: 'Purchase', withhold: 'Tool withheld', food: 'Food', rent: 'Rent', cost: 'Cost',
  };

  function renderMoney(): void {
    const state = options.getState();
    heading('Ledger', 'Money', 'Today’s wages, purchases, and costs.');
    const entries = options.getEvents()
      .filter((event): event is GameEvent & { type: 'transaction' } => event.type === 'transaction' && event.day === state?.day);
    const list = document.createElement('ul');
    list.className = 'money-ledger';
    for (const entry of entries) {
      const row = document.createElement('li');
      const label = REASON_LABEL[entry.data.reason] ?? entry.data.reason;
      row.innerHTML = `<span>${label}${entry.data.itemId ? ` · ${entry.data.itemId.replaceAll('_', ' ')}` : ''}</span><b class="${entry.data.amount >= 0 ? 'gain' : 'loss'}">${entry.data.amount >= 0 ? '+' : '−'}¥${Math.abs(entry.data.amount)}</b>`;
      list.append(row);
    }
    if (!entries.length) list.innerHTML = '<li class="money-empty">No transactions yet today.</li>';
    const total = entries.reduce((sum, entry) => sum + entry.data.amount, 0);
    const totals = document.createElement('dl');
    totals.className = 'money-totals';
    totals.innerHTML = `<div><dt>Today's net</dt><dd class="${total >= 0 ? 'gain' : 'loss'}">${total >= 0 ? '+' : '−'}¥${Math.abs(total)}</dd></div>
      <div><dt>Balance</dt><dd>¥${state?.wallet ?? 0}</dd></div>`;
    panel.append(list, totals, button('Back', goBack, 'button-primary button-block'));
    activate(goBack);
  }

  function settingRow(labelText: string, control: HTMLElement, detail?: string): HTMLElement {
    const row = document.createElement('label');
    row.className = 'setting-row';
    const text = document.createElement('span');
    text.className = 'setting-copy';
    const label = document.createElement('strong');
    label.textContent = labelText;
    text.append(label);
    if (detail) {
      const small = document.createElement('small');
      small.textContent = detail;
      text.append(small);
    }
    row.append(text, control);
    return row;
  }

  function storePreferences(next: UiPreferences): void {
    preferences = next;
    savePreferences(preferences);
    applyPreferences(preferences);
  }

  function renderSettings(): void {
    heading('Preferences', 'Settings', 'Changes are saved on this device.');
    const form = document.createElement('div');
    form.className = 'settings-list';

    const volume = document.createElement('input');
    volume.type = 'range';
    volume.min = '0';
    volume.max = '100';
    volume.step = '5';
    volume.value = String(Math.round(options.audio.settings().speech * 100));
    volume.setAttribute('aria-label', 'Speech volume');
    const volumeValue = document.createElement('output');
    volumeValue.className = 'setting-value';
    volumeValue.textContent = `${volume.value}%`;
    volume.addEventListener('input', () => {
      options.audio.setVolumes({ speech: Number(volume.value) / 100 });
      volumeValue.textContent = `${volume.value}%`;
    });
    const volumeControl = document.createElement('span');
    volumeControl.className = 'range-control';
    volumeControl.append(volume, volumeValue);

    const muted = document.createElement('input');
    muted.type = 'checkbox';
    muted.checked = options.audio.settings().muted;
    muted.className = 'switch';
    muted.addEventListener('change', () => options.audio.setMuted(muted.checked));

    const pinyin = document.createElement('input');
    pinyin.type = 'checkbox';
    pinyin.checked = preferences.pinyin;
    pinyin.className = 'switch';
    pinyin.addEventListener('change', () => storePreferences({ ...preferences, pinyin: pinyin.checked }));

    const textSize = document.createElement('select');
    textSize.setAttribute('aria-label', 'Text size');
    for (const size of [100, 125, 150] as const) {
      const option = document.createElement('option');
      option.value = String(size);
      option.textContent = `${size}%`;
      option.selected = preferences.textSize === size;
      textSize.append(option);
    }
    textSize.addEventListener('change', () => {
      storePreferences({ ...preferences, textSize: Number(textSize.value) as 100 | 125 | 150 });
    });

    form.append(
      settingRow('Speech volume', volumeControl, 'Dialogue, reply, and word audio'),
      settingRow('Mute speech', muted),
      settingRow('Show pinyin by default', pinyin, 'You can still toggle it in each conversation'),
      settingRow('Text size', textSize, 'Browser zoom remains supported'),
    );
    const footer = document.createElement('footer');
    footer.className = 'sheet-actions';
    footer.append(
      button('Reset save', () => open('new-game', 'settings'), 'button-danger'),
      button('Done', goBack, 'button-primary'),
    );
    panel.append(form, footer);
    activate(goBack);
  }

  function renderHelp(): void {
    heading('Controls', 'Help', 'Every action is available with keyboard or touch.');
    const grid = document.createElement('div');
    grid.className = 'help-grid';
    const controlGroups = [
      ['Move', 'WASD or arrow keys', 'Touch joystick'],
      ['Run', 'Hold Shift', 'Hold Run'],
      ['Talk', 'Face an NPC and press E', 'Tap Talk'],
      ['Dialogue', '1–4 select · Enter says', 'Tap to preview · tap again to say'],
      ['Notebook', 'Tab', 'Tap Book'],
      ['Camera', 'Right-drag · R recentres', 'Drag the open street'],
      ['Pause', 'Escape', 'Tap Menu'],
    ];
    for (const [name, desktop, phone] of controlGroups) {
      const card = document.createElement('article');
      card.innerHTML = `<h2>${name}</h2><p><span>Desktop</span>${desktop}</p><p><span>Phone</span>${phone}</p>`;
      grid.append(card);
    }
    panel.append(grid, button('Back', goBack, 'button-primary button-block'));
    activate(goBack);
  }

  function renderCredits(): void {
    heading('Project notices', 'Credits', 'Source links open in a new tab.');
    const content = document.createElement('div');
    content.className = 'credits-copy';
    content.innerHTML = `
      <h2>Language</h2>
      <p>HSK 2.0 Level 1 vocabulary — Chinese Testing International / Hanban.</p>
      <h2>3D assets</h2>
      <ul>
        <li><a href="https://kenney.nl/" target="_blank" rel="noreferrer">Kenney</a> — City Kit and Food Kit, CC0.</li>
        <li><a href="https://quaternius.com/" target="_blank" rel="noreferrer">Quaternius</a> — Universal Animation Library, CC0.</li>
        <li><a href="https://kaylousberg.com/" target="_blank" rel="noreferrer">Kay Lousberg</a> — KayKit City Builder Bits, CC0.</li>
      </ul>
      <h2>Type</h2>
      <p>Noto Sans SC by the Noto Project, SIL Open Font License 1.1.</p>
      <p>Full provenance and file-level notices are in <code>docs/CREDITS.md</code>.</p>`;
    panel.append(content, button('Back', goBack, 'button-primary button-block'));
    activate(goBack);
  }

  function renderSave(): void {
    heading('Local save', 'Save & import', 'Your save stays in this browser unless you copy it elsewhere.');
    const textarea = document.createElement('textarea');
    textarea.rows = 7;
    textarea.spellcheck = false;
    textarea.setAttribute('aria-label', 'Save data');
    const status = document.createElement('p');
    status.className = 'save-status';
    status.setAttribute('role', 'status');
    const actions = document.createElement('div');
    actions.className = 'sheet-actions wrap';
    actions.append(
      button('Export', () => {
        textarea.value = options.onExport();
        textarea.select();
        status.textContent = `${new Blob([textarea.value]).size.toLocaleString()} bytes ready to copy.`;
      }),
      button('Copy', () => {
        textarea.select();
        void navigator.clipboard?.writeText(textarea.value);
        status.textContent = 'Save copied when clipboard access is available.';
      }),
      button('Import', () => {
        try {
          options.onImport(textarea.value.trim());
          hasSave = true;
          status.textContent = 'Save imported.';
        } catch (error) {
          status.textContent = error instanceof Error ? error.message : 'Import failed.';
        }
      }, 'button-primary'),
      button('Back', goBack),
    );
    panel.append(textarea, actions, status);
    activate(goBack);
  }

  function renderSleep(): void {
    const state = options.getState();
    heading('End of day', 'Sleep until morning?', 'Food is settled at dawn and the street advances to the next day.');
    const summary = document.createElement('dl');
    summary.className = 'sleep-summary';
    summary.innerHTML = `
      <div><dt>Unused slots</dt><dd>${state?.actionSlots ?? 0}</dd></div>
      <div><dt>Food</dt><dd>−¥${state?.rules.foodCost ?? 2}</dd></div>`;
    if (state?.dialogue) {
      const warning = document.createElement('p');
      warning.className = 'warning-card';
      warning.textContent = 'Unfinished shift earns ¥0.';
      panel.append(summary, warning);
    } else {
      panel.append(summary);
    }
    const actions = document.createElement('div');
    actions.className = 'sheet-actions';
    actions.append(
      button('Back', close),
      button('Sleep', () => {
        options.onSleep();
        close();
      }, 'button-primary'),
    );
    panel.append(actions);
    activate(close);
  }

  function renderNewGame(): void {
    const fromSettings = returnSurface === 'settings';
    heading('Local progress', fromSettings ? 'Reset saved game?' : 'Replace current game?', 'This removes the current local game from this browser.');
    const actions = document.createElement('div');
    actions.className = 'sheet-actions wrap';
    actions.append(
      button('Export first', () => open('save', returnSurface)),
      button('Cancel', goBack),
      button(fromSettings ? 'Reset save' : 'New game', () => {
        if (fromSettings) options.onResetSave();
        else options.onNewGame();
      }, 'button-danger'),
    );
    panel.append(actions);
    activate(goBack);
  }

  function showRent(amount: number, graceUntil: number): void {
    rent.replaceChildren();
    const copy = document.createElement('div');
    copy.innerHTML = `<strong>Rent due · ¥${amount}</strong><span>Extra time through day ${graceUntil}</span>`;
    rent.append(copy, button('Continue', () => {
      rent.hidden = true;
    }));
    rent.hidden = false;
  }

  function showGate(status: GateStatus, onClaim: () => void, onLater: () => void): void {
    gate.replaceChildren();
    const copy = document.createElement('div');
    copy.innerHTML = `<strong>Gate open · ${status.met}/${status.total} words</strong><span>Savings ¥${status.savings} / ¥${status.target}</span>`;
    gate.append(
      copy,
      button('Later', () => {
        gate.hidden = true;
        onLater();
      }),
      button('Claim', () => {
        gate.hidden = true;
        onClaim();
      }, 'button-primary'),
    );
    gate.hidden = false;
  }

  function hideGate(): void {
    gate.hidden = true;
  }

  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.key !== 'Escape') return;
    event.preventDefault();
    if (surface === 'pause') close();
    else if (surface === null) open('pause');
  });

  open('title');

  return {
    isOpen(): boolean {
      return surface !== null;
    },
    openPause(): void {
      if (surface === null) open('pause');
    },
    openSleep(): void {
      if (surface === null) open('sleep');
    },
    showRent,
    showGate,
    hideGate,
    preferences(): UiPreferences {
      return { ...preferences };
    },
    markSaveAvailable(): void {
      hasSave = true;
    },
  };
}
