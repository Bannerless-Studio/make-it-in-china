import type { GameState, WordProgress } from '../engine';
import type { Location, Npc, Scene, Word } from '../content/types';
import type { AudioManager } from '../audio/manager';
import { trapFocus, restoreFocus } from './modal';
import { unmetReason } from './activityAvailability';

function pointerAction(element: HTMLElement, action: () => void): void {
  element.addEventListener('click', event => {
    event.preventDefault();
    action();
  });
}

export function createNotebook(
  root: HTMLElement,
  words: Word[],
  locations: Location[],
  onWord: (word: string) => void,
  audio: AudioManager,
  mentorScenes: Scene[] = [],
  npcs: Npc[] = [],
) {
  const byHanzi = new Map(words.map(word => [word.hanzi, word]));
  const locationNames = new Map(locations.map(location => [location.id, location.name]));
  const npcById = new Map(npcs.map(npc => [npc.id, npc]));
  const mentorLabel = (scene: Scene): string => `${npcById.get(scene.npc)?.label ?? scene.npc} · ${scene.exchanges[0]?.line.en ?? scene.id}`;
  const button = document.createElement('button');
  button.id = 'notebook-button';
  button.type = 'button';
  button.textContent = 'Book';
  button.setAttribute('aria-label', 'Open word notebook');
  const panel = document.createElement('aside');
  panel.id = 'notebook-panel';
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-labelledby', 'notebook-title');
  panel.innerHTML = `
    <header>
      <div><span class="sheet-eyebrow">Your street vocabulary</span><h2 id="notebook-title">Notebook</h2></div>
      <button id="notebook-close" type="button" aria-label="Close notebook">×</button>
    </header>
    <div id="notebook-progress"></div>
    <div class="notebook-filters">
      <label>State<select id="notebook-state">
        <option value="all">All met words</option>
        <option value="known">Known</option>
        <option value="shaky">Review soon</option>
        <option value="met">Just met</option>
      </select></label>
      <label>Location<select id="notebook-location"><option value="all">Everywhere</option></select></label>
    </div>
    <div class="notebook-layout">
      <div id="notebook-words" role="list"></div>
      <section id="notebook-detail" aria-live="polite"></section>
    </div>
    <section id="notebook-mentor"><h3>Mentor topics</h3><ul id="notebook-mentor-list"></ul></section>
    <section id="notebook-inventory"><h3>Inventory</h3><ul id="notebook-inventory-list"></ul></section>`;
  root.append(button, panel);
  const progressCount = panel.querySelector<HTMLElement>('#notebook-progress')!;
  const list = panel.querySelector<HTMLElement>('#notebook-words')!;
  const detail = panel.querySelector<HTMLElement>('#notebook-detail')!;
  const stateFilter = panel.querySelector<HTMLSelectElement>('#notebook-state')!;
  const locationFilter = panel.querySelector<HTMLSelectElement>('#notebook-location')!;
  const mentorList = panel.querySelector<HTMLElement>('#notebook-mentor-list')!;
  const inventoryList = panel.querySelector<HTMLElement>('#notebook-inventory-list')!;
  let currentState: GameState | null = null;
  let selected: string | null = null;
  let releaseTrap: (() => void) | null = null;
  let opener: HTMLElement | null = null;

  for (const location of locations) {
    const option = document.createElement('option');
    option.value = location.id;
    option.textContent = location.name;
    locationFilter.append(option);
  }
  const starter = document.createElement('option');
  starter.value = 'starter';
  starter.textContent = 'Starter words';
  locationFilter.append(starter);

  function audioButton(label: string, id: string, missing: HTMLElement): HTMLButtonElement {
    const play = document.createElement('button');
    play.type = 'button';
    play.textContent = label;
    pointerAction(play, () => {
      void audio.play(id).then(result => {
        missing.hidden = result !== 'missing';
      });
    });
    return play;
  }

  function renderDetail(word: Word, progress: WordProgress): void {
    detail.replaceChildren();
    const header = document.createElement('header');
    const title = document.createElement('h3');
    title.lang = 'zh-Hans';
    title.textContent = word.hanzi;
    const state = document.createElement('span');
    state.className = `word-state state-${progress.state}`;
    state.textContent = progress.state === 'shaky' ? 'Review soon' : progress.state;
    header.append(title, state);
    if (word.bonus) {
      const bonus = document.createElement('span');
      bonus.className = 'bonus-tag';
      bonus.textContent = 'Bonus';
      header.append(bonus);
    }
    const pronunciation = document.createElement('p');
    pronunciation.className = 'word-pronunciation';
    pronunciation.textContent = word.pinyin;
    const english = document.createElement('p');
    english.className = 'word-english';
    english.lang = 'en';
    english.textContent = word.en;
    const firstSeen = document.createElement('div');
    firstSeen.className = 'first-seen-card';
    const firstLabel = document.createElement('span');
    firstLabel.textContent = 'First heard';
    const sentence = document.createElement('p');
    sentence.lang = 'zh-Hans';
    sentence.textContent = progress.firstSeen?.sentence ?? 'No sentence recorded.';
    firstSeen.append(firstLabel, sentence);
    const actions = document.createElement('div');
    actions.className = 'notebook-audio-actions';
    const missing = document.createElement('small');
    missing.className = 'audio-missing';
    missing.textContent = 'Audio unavailable';
    missing.hidden = true;
    const wordId = audio.word(word.hanzi);
    if (wordId) {
      const playWord = audioButton('▶ Hear word', wordId, missing);
      playWord.addEventListener('click', () => onWord(word.hanzi));
      actions.append(playWord);
    }
    if (progress.firstSeen?.audio) {
      actions.append(audioButton(
        '↻ Hear sentence',
        audio.sentence(progress.firstSeen.audio, progress.firstSeen.sentence),
        missing,
      ));
    }
    actions.append(missing);
    detail.append(header, pronunciation, english, firstSeen, actions);
  }

  function renderState(state: GameState): void {
    currentState = state;
    const entries: Array<{ word: Word; progress: WordProgress; location: string }> = [];
    let learned = 0;
    for (const hanzi of Object.keys(state.words)) {
      const progress = state.words[hanzi];
      if (progress.state === 'unseen') continue;
      const word = byHanzi.get(hanzi);
      if (!word) continue;
      if (!word.bonus) learned += 1;
      entries.push({
        word,
        progress,
        location: progress.firstSeen?.location ?? 'starter',
      });
    }
    const filtered = entries.filter(entry => (
      (stateFilter.value === 'all' || entry.progress.state === stateFilter.value)
      && (locationFilter.value === 'all' || entry.location === locationFilter.value)
    ));
    progressCount.textContent = `${learned} / ${words.filter(word => !word.bonus).length} words met`;
    list.replaceChildren();
    const grouped = new Map<string, typeof filtered>();
    for (const entry of filtered) {
      const group = grouped.get(entry.location) ?? [];
      group.push(entry);
      grouped.set(entry.location, group);
    }
    for (const [location, group] of grouped) {
      const heading = document.createElement('h3');
      heading.textContent = location === 'starter'
        ? 'Starter words'
        : (locationNames.get(location) ?? location);
      list.append(heading);
      for (const entry of group) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = `notebook-word state-${entry.progress.state}`;
        row.dataset.word = entry.word.hanzi;
        row.setAttribute('role', 'listitem');
        row.innerHTML = `
          <strong lang="zh-Hans">${entry.word.hanzi}</strong>
          <span>${entry.word.pinyin}</span>
          <small>${entry.word.en}</small>
          <i>${entry.progress.state === 'shaky' ? 'Review' : entry.progress.state}</i>`;
        pointerAction(row, () => {
          selected = entry.word.hanzi;
          list.querySelectorAll('.notebook-word').forEach(item => item.classList.remove('selected'));
          row.classList.add('selected');
          renderDetail(entry.word, entry.progress);
        });
        list.append(row);
      }
    }
    if (!filtered.length) list.textContent = entries.length
      ? 'No words match these filters.'
      : 'Tap new words in conversation to fill your notebook.';
    const active = filtered.find(entry => entry.word.hanzi === selected) ?? filtered[0];
    if (active) {
      selected = active.word.hanzi;
      [...list.querySelectorAll<HTMLElement>('.notebook-word')]
        .find(row => row.dataset.word === selected)
        ?.classList.add('selected');
      renderDetail(active.word, active.progress);
    } else {
      detail.innerHTML = '<p class="notebook-empty">Choose a word to see its first sentence and audio.</p>';
    }
    mentorList.replaceChildren();
    for (const scene of mentorScenes) {
      const row = document.createElement('li');
      const visited = state.progress.mentorTopics.includes(scene.id);
      const reason = visited ? undefined : unmetReason(scene, state);
      row.className = visited ? 'mentor-visited' : reason ? 'mentor-blocked' : 'mentor-ready';
      row.innerHTML = `<span>${mentorLabel(scene)}</span><small>${visited ? 'Visited' : reason ?? 'Ready this evening'}</small>`;
      mentorList.append(row);
    }
    if (!mentorScenes.length) mentorList.innerHTML = '<li class="notebook-empty">No mentor topics yet.</li>';
    inventoryList.replaceChildren();
    const items = Object.entries(state.progress.inventory).filter(([, count]) => count > 0);
    for (const [itemId, count] of items) {
      const row = document.createElement('li');
      row.innerHTML = `<span>${itemId.replaceAll('_', ' ')}</span><small>×${count}</small>`;
      inventoryList.append(row);
    }
    if (!items.length) inventoryList.innerHTML = '<li class="notebook-empty">No items yet.</li>';
  }

  function close(): void {
    releaseTrap?.();
    releaseTrap = null;
    panel.hidden = true;
    restoreFocus(opener);
    opener = null;
  }

  function open(): void {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    audio.stop();
    panel.hidden = false;
    releaseTrap?.();
    releaseTrap = trapFocus(panel, close);
  }

  pointerAction(button, open);
  pointerAction(panel.querySelector<HTMLElement>('#notebook-close')!, close);
  stateFilter.addEventListener('change', () => {
    if (currentState) renderState(currentState);
  });
  locationFilter.addEventListener('change', () => {
    if (currentState) renderState(currentState);
  });

  return {
    render: renderState,
    toggle(): void {
      if (panel.hidden) open();
      else close();
    },
    isOpen(): boolean {
      return !panel.hidden;
    },
  };
}
