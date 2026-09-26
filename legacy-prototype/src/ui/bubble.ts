import type { AssistReason, DialogueFrame } from '../engine';
import type { Line, Npc, Word } from '../content/types';
import type { AudioManager, PlayResult } from '../audio/manager';
import type { ActivityChoice } from './activityAvailability';

export interface MessageAction { label: string; primary?: boolean; onClick: () => void }

function activate(element: HTMLElement, action: () => void): void {
  element.addEventListener('click', event => {
    event.preventDefault();
    action();
  });
}

const KIND_LABEL: Record<ActivityChoice['kind'], string> = {
  story: 'Story', job: 'Job', errand: 'Errand', mentor: 'Mentor', consequence: 'Consequence',
};

export function createBubble(
  root: HTMLElement,
  words: Word[],
  onReply: (index: number) => void,
  onWord: (word: string) => void,
  onDismiss: () => void,
  audio: AudioManager,
  onAssist: (words: string[], reason: AssistReason) => void = () => {},
) {
  const byHanzi = new Map(words.filter(word => !word.bonus).map(word => [word.hanzi, word]));
  const bonusByHanzi = new Map(words.filter(word => word.bonus).map(word => [word.hanzi, word]));
  const wordInfo = (hanzi: string): Word | undefined => byHanzi.get(hanzi) ?? bonusByHanzi.get(hanzi);
  const element = document.createElement('section');
  element.id = 'dialogue-bubble';
  element.hidden = true;
  element.setAttribute('aria-label', 'Conversation');
  element.innerHTML = `
    <header class="bubble-header">
      <div class="npc-name"></div>
      <span class="speaking-indicator" aria-label="Speaking"><i></i><i></i><i></i></span>
    </header>
    <div class="bubble-copy">
      <div id="dialogue-line" lang="zh-Hans"></div>
      <div id="dialogue-pinyin"></div>
      <small id="dialogue-gloss" lang="en"></small>
    </div>
    <div id="dialogue-hint" hidden></div>
    <div id="audio-missing" role="status" hidden>Audio unavailable. Continue with text.</div>
    <div id="word-popup" hidden></div>
    <div class="bubble-tools">
      <button class="replay-button" type="button">↻ Replay</button>
      <button id="pinyin-toggle" type="button" aria-pressed="false">Pinyin</button>
    </div>
    <div id="reply-options" hidden></div>`;
  root.append(element);
  const name = element.querySelector<HTMLElement>('.npc-name')!;
  const line = element.querySelector<HTMLElement>('#dialogue-line')!;
  const pinyin = element.querySelector<HTMLElement>('#dialogue-pinyin')!;
  const gloss = element.querySelector<HTMLElement>('#dialogue-gloss')!;
  const hint = element.querySelector<HTMLElement>('#dialogue-hint')!;
  const missing = element.querySelector<HTMLElement>('#audio-missing')!;
  const popup = element.querySelector<HTMLElement>('#word-popup')!;
  const replay = element.querySelector<HTMLButtonElement>('.replay-button')!;
  const pinyinToggle = element.querySelector<HTMLButtonElement>('#pinyin-toggle')!;
  const replies = element.querySelector<HTMLElement>('#reply-options')!;
  let presentationKey: string | null = null;
  let activeAudioId: string | null = null;
  let replyTimer = 0;
  let touchPreviewIndex: number | null = null;
  let selectedReply: number | null = null;
  let committing = false;
  let selectReply: ((index: number) => void) | null = null;
  let saySelected: (() => void) | null = null;
  let currentExchangeId: string | null = null;
  let currentTestedWords: string[] = [];
  const assistedThisExchange = new Set<string>();

  function assistOnce(key: string, words: string[], reason: AssistReason): void {
    if (!words.length || !currentExchangeId) return;
    const tag = `${currentExchangeId}:${key}`;
    if (assistedThisExchange.has(tag)) return;
    assistedThisExchange.add(tag);
    onAssist(words, reason);
  }

  audio.subscribe(state => {
    element.classList.toggle('speaking', !element.hidden && state.playing);
  });

  function reset(): void {
    window.clearTimeout(replyTimer);
    element.hidden = true;
    element.classList.remove('below', 'offscreen', 'message');
    name.textContent = '';
    line.replaceChildren();
    line.hidden = false;
    pinyin.textContent = '';
    pinyin.hidden = false;
    gloss.textContent = '';
    gloss.hidden = false;
    hint.hidden = true;
    hint.textContent = '';
    missing.hidden = true;
    popup.hidden = true;
    popup.textContent = '';
    replay.disabled = false;
    replies.hidden = true;
    replies.replaceChildren();
    touchPreviewIndex = null;
    selectedReply = null;
    committing = false;
    selectReply = null;
    saySelected = null;
  }

  function renderLine(spokenLine: Line, newWords: Set<string>): void {
    line.replaceChildren();
    const candidates = [...new Set(spokenLine.words)]
      .sort((a, b) => b.length - a.length);
    const hanzi = spokenLine.hanzi;
    for (let offset = 0; offset < hanzi.length;) {
      const match = candidates.find(word => hanzi.startsWith(word, offset));
      if (!match) {
        line.append(hanzi[offset]);
        offset += 1;
        continue;
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `word-tap${newWords.has(match) ? ' new-word' : ''}`;
      button.textContent = match;
      button.ariaLabel = `Look up ${match}`;
      activate(button, () => {
        const word = wordInfo(match);
        onWord(match);
        if (currentTestedWords.includes(match)) assistOnce(`gloss:${match}`, [match], 'gloss');
        popup.textContent = word ? `${word.pinyin} · ${word.en}` : `${match} · gloss pending`;
        popup.hidden = false;
        const id = audio.word(match);
        if (id) void playAndMark(id);
        else markMissing();
      });
      line.append(button);
      offset += match.length;
    }
  }

  function markMissing(): void {
    missing.hidden = false;
    replay.disabled = true;
  }

  async function playAndMark(id: string, onStart?: () => void): Promise<PlayResult> {
    const result = await audio.play(id, { interrupt: true, onStart });
    if (result === 'missing') markMissing();
    return result;
  }

  activate(replay, () => {
    if (activeAudioId) void playAndMark(activeAudioId);
  });

  function setPinyinVisible(visible: boolean): void {
    pinyin.hidden = !visible;
    pinyinToggle.setAttribute('aria-pressed', String(visible));
    pinyinToggle.classList.toggle('active', visible);
    if (visible) assistOnce('pinyin', currentTestedWords, 'pinyin-default');
  }

  activate(pinyinToggle, () => {
    setPinyinVisible(pinyin.hidden);
  });
  document.addEventListener('ui-preferences-change', () => {
    if (!element.hidden) setPinyinVisible(document.documentElement.dataset.pinyin === 'true');
  });

  document.addEventListener('keydown', event => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (
      element.hidden
      || replies.hidden
      || document.querySelector('#ui-overlay:not([hidden]), #notebook-panel:not([hidden])')
      || target?.closest('#ui-overlay, #notebook-panel, input, select, textarea')
    ) return;
    if (/^[1-4]$/.test(event.key)) {
      event.preventDefault();
      selectReply?.(Number(event.key) - 1);
    } else if (event.key === 'Enter' && selectedReply !== null) {
      event.preventDefault();
      saySelected?.();
    }
  });

  return {
    element,
    render(frame: DialogueFrame | null, npc: Npc | undefined, newWords: Set<string>): void {
      if (!frame) {
        presentationKey = null;
        activeAudioId = null;
        reset();
        return;
      }
      const attempts = frame.attempts[frame.exchange.id] ?? 0;
      const assisted = attempts >= 2 && frame.exchange.hint;
      const spokenLine = assisted || frame.exchange.line;
      const key = `${frame.sceneId}:${frame.exchange.id}:${spokenLine.audio}:${attempts}`;
      if (key === presentationKey) return;
      presentationKey = key;
      if (currentExchangeId !== frame.exchange.id) {
        assistedThisExchange.clear();
        currentExchangeId = frame.exchange.id;
      }
      currentTestedWords = [...new Set(frame.exchange.tests ?? [])];
      reset();
      element.hidden = false;
      name.textContent = npc ? `${npc.name} · ${npc.label}` : frame.sceneId;
      renderLine(spokenLine, newWords);
      pinyin.textContent = spokenLine.pinyin;
      gloss.textContent = spokenLine.en;
      line.hidden = true;
      gloss.hidden = true;
      const defaultPinyin = document.documentElement.dataset.pinyin === 'true';
      pinyin.hidden = true;
      pinyinToggle.setAttribute('aria-pressed', String(defaultPinyin));
      pinyinToggle.classList.toggle('active', defaultPinyin);
      if (defaultPinyin) assistOnce('pinyin', currentTestedWords, 'pinyin-default');
      if (assisted) {
        assistOnce('hint', [...new Set(spokenLine.words)], 'hint');
        hint.textContent = `提示 · Hint: ${spokenLine.en}`;
      }
      const cards: HTMLButtonElement[] = [];
      const resolvedReplyAudio = frame.exchange.replies.map(reply => (
        reply.audio ? audio.resolve(reply.audio, frame.bindings) : null
      ));
      const previewReply = (index: number): void => {
        const id = resolvedReplyAudio[index];
        if (id) void playAndMark(id);
        else markMissing();
        cards.forEach((card, cardIndex) => card.classList.toggle('previewing', cardIndex === index));
      };
      selectReply = (index: number): void => {
        if (!cards[index] || committing) return;
        selectedReply = index;
        touchPreviewIndex = null;
        cards.forEach((card, cardIndex) => {
          const selected = cardIndex === index;
          card.classList.toggle('selected', selected);
          card.setAttribute('aria-pressed', String(selected));
        });
        replies.querySelector<HTMLButtonElement>('#say-reply')!.disabled = false;
        cards[index].focus();
      };
      frame.exchange.replies.forEach((reply, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'reply-button';
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', `Reply ${index + 1}: ${reply.hanzi}`);
        const number = document.createElement('b');
        number.textContent = String(index + 1);
        const hanzi = document.createElement('span');
        hanzi.textContent = reply.hanzi;
        hanzi.lang = 'zh-Hans';
        const copy = document.createElement('span');
        copy.className = 'reply-copy';
        copy.append(hanzi);
        if (reply.pinyin) {
          const pronunciation = document.createElement('small');
          pronunciation.className = 'reply-pinyin';
          pronunciation.textContent = reply.pinyin;
          copy.append(pronunciation);
        }
        if (reply.en) {
          const replyGloss = document.createElement('small');
          replyGloss.textContent = reply.en;
          replyGloss.lang = 'en';
          copy.append(replyGloss);
        }
        const speaker = document.createElement('span');
        speaker.className = 'reply-speaker';
        speaker.textContent = '▶';
        speaker.setAttribute('aria-hidden', 'true');
        button.append(number, copy, speaker);
        cards.push(button);
        button.addEventListener('pointerenter', event => {
          if (event.pointerType === 'mouse') previewReply(index);
        });
        button.addEventListener('pointerup', event => {
          event.preventDefault();
          if (event.pointerType === 'touch' || event.pointerType === 'pen') {
            if (touchPreviewIndex !== index) {
              touchPreviewIndex = index;
              previewReply(index);
              return;
            }
            selectReply?.(index);
            saySelected?.();
            return;
          }
          selectReply?.(index);
        });
        button.addEventListener('click', event => {
          if (event.detail !== 0) return;
          event.preventDefault();
          selectReply?.(index);
        });
        button.addEventListener('keydown', event => {
          if (event.key !== ' ') return;
          event.preventDefault();
          selectReply?.(index);
        });
        replies.append(button);
      });
      const say = document.createElement('button');
      say.id = 'say-reply';
      say.type = 'button';
      say.className = 'button-primary';
      say.textContent = 'Say selected reply';
      say.disabled = true;
      saySelected = (): void => {
        if (selectedReply === null || committing) return;
        committing = true;
        say.disabled = true;
        cards.forEach(card => { card.disabled = true; });
        const selected = selectedReply;
        const id = resolvedReplyAudio[selected];
        const settle = (): void => {
          replyTimer = window.setTimeout(() => onReply(selected), 150);
        };
        if (!id) {
          settle();
          return;
        }
        void playAndMark(id).then(settle);
      };
      activate(say, () => saySelected?.());
      replies.append(say);
      activeAudioId = audio.resolve(spokenLine.audio, frame.bindings);
      const reveal = (): void => {
        line.hidden = false;
        pinyin.hidden = !defaultPinyin;
        gloss.hidden = false;
        if (assisted) hint.hidden = false;
      };
      requestAnimationFrame(reveal);
      void playAndMark(activeAudioId, reveal).then(result => {
        reveal();
        const delay = result === 'completed' ? 150 : 0;
        replyTimer = window.setTimeout(() => {
          if (presentationKey === key) replies.hidden = false;
        }, delay);
      });
    },
    message(hanzi: string, en: string | undefined, npc: Npc | undefined, actions?: MessageAction[]): void {
      presentationKey = null;
      activeAudioId = null;
      reset();
      element.hidden = false;
      element.classList.add('message');
      replies.hidden = false;
      name.textContent = npc ? `${npc.name} · ${npc.label}` : '提示 · Notice';
      if (!npc) {
        element.style.left = '50%';
        element.style.top = '35%';
        element.classList.add('below');
      }
      line.append(hanzi);
      gloss.textContent = en ?? '';
      const resolved = actions ?? [{ label: '好 · OK', onClick: onDismiss }];
      for (const item of resolved) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `reply-button message-button${item.primary ? ' button-primary' : ''}`;
        button.textContent = item.label;
        activate(button, () => {
          reset();
          item.onClick();
        });
        replies.append(button);
      }
    },
    choices(npc: Npc, items: ActivityChoice[], onChoose: (id: string) => void, onCancel: () => void): void {
      presentationKey = null;
      activeAudioId = null;
      currentExchangeId = null;
      reset();
      element.hidden = false;
      element.classList.add('message');
      name.textContent = `${npc.name} · ${npc.label}`;
      line.hidden = true;
      pinyin.hidden = true;
      gloss.hidden = true;
      replies.hidden = false;
      for (const item of items) {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'reply-button choice-row';
        row.disabled = !item.available;
        const price = item.reward ? `+¥${item.reward}` : (item.price ? `−¥${item.price}` : 'free');
        const copy = document.createElement('span');
        copy.className = 'reply-copy';
        const title = document.createElement('span');
        title.textContent = `${KIND_LABEL[item.kind]} · ${price}${item.review ? ' · review' : ''}`;
        copy.append(title);
        if (!item.available && item.reason) {
          const reason = document.createElement('small');
          reason.textContent = item.reason;
          copy.append(reason);
        }
        row.append(copy);
        if (item.available) activate(row, () => { reset(); onChoose(item.id); });
        replies.append(row);
      }
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'reply-button message-button';
      cancel.textContent = 'Leave';
      activate(cancel, () => { reset(); onCancel(); });
      replies.append(cancel);
    },
    anchor(x: number, y: number, visible: boolean): void {
      const margin = 12;
      const gap = 12;
      const nameClearance = 30;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      const left = Math.min(
        Math.max(x, margin + width / 2),
        Math.max(margin + width / 2, innerWidth - margin - width / 2),
      );
      const roomAbove = y - gap - margin - nameClearance;
      const roomBelow = innerHeight - margin - y - gap;
      const below = roomAbove < height && roomBelow > roomAbove;
      const minTop = below ? margin + nameClearance : margin + nameClearance + height;
      const maxTop = below ? innerHeight - margin - height : innerHeight - margin;
      const desiredTop = below ? y + gap : y - gap;
      element.style.left = `${left}px`;
      element.style.top = `${Math.min(Math.max(desiredTop, minTop), Math.max(minTop, maxTop))}px`;
      element.classList.toggle('below', below);
      element.classList.toggle('offscreen', !visible);
    },
  };
}
