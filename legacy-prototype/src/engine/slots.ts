import type { Exchange, Scene, SlotPool } from '../content/types';
import { CommandError, ContentError, type Bindings, type GameContent, type GameState } from './types';
import { wordState } from './learner';

const fields = ['hanzi', 'pinyin', 'en'] as const;
const names = (text = '') => [...text.matchAll(/\{([^{}]+)\}/g)].map(match => match[1]);
const introducedBy = (exchange?: Exchange) => new Set(exchange?.introduces ?? []);
// TDD 6.1: a value is only offered when its fixed wrong alternative is offerable too.
export function alternativeIndex(pool: SlotPool, index: number): number {
  const ids = pool.values.map(value => value.id);
  const fixed: Record<string, string> = { front: 'back', back: 'front', inside: 'front' };
  const mapped = fixed[ids[index]];
  if (mapped !== undefined && ids.includes(mapped)) return ids.indexOf(mapped);
  if (pool.values.length === 2) return 1 - index;
  const paired = index ^ 1;
  return paired < pool.values.length ? paired : Math.max(0, index - 1);
}
const offerable = (state: GameState, introduced: Set<string>, value: SlotPool['values'][number]) =>
  value.words.every(word => wordState(state, word) !== 'unseen' || introduced.has(word));
function usable(state: GameState, pool: SlotPool, exchange?: Exchange) {
  const introduced = introducedBy(exchange);
  return pool.values.filter((value, index) => offerable(state, introduced, value) && offerable(state, introduced, pool.values[alternativeIndex(pool, index)]));
}
const eligible = (state: GameState, _scene: Scene, pool: SlotPool, exchange?: Exchange) => usable(state, pool, exchange);
const duplicate = (values: string[]) => new Set(values).size !== values.length;
export function validateScene(scene: Scene, content: GameContent, state?: GameState, visited = new Set<string>()) {
  if (state && scene.kind !== 'consequence') {
    if (scene.requires.some(word => wordState(state!, word) === 'unseen')) throw new CommandError(`Scene is locked: ${scene.id}`);
    if (['job', 'errand', 'mentor'].includes(scene.kind)) {
      if (state.actionSlots === 0) throw new CommandError(`No action slots for ${scene.id}`);
      state = { ...state, actionSlots: state.actionSlots - 1 };
    }
  }
  if (visited.has(scene.id)) return;
  visited = new Set(visited).add(scene.id);
  const bound = new Set<string>(), staticBindings: Record<string, string | undefined> = {};
  if (!scene.exchanges.length) throw new ContentError(`Empty scene: ${scene.id}`);
  if ([scene.cost, scene.reward].some(value => value !== undefined && (!Number.isFinite(value) || value < 0))) throw new ContentError(`Invalid money amount: ${scene.id}`);
  for (const exchange of scene.exchanges) {
    for (const [name, poolId] of Object.entries(exchange.slots ?? {})) {
      const pool = content.world.slotPools.find(item => item.id === poolId);
      if (!pool?.values.length) throw new ContentError(`Unknown/empty pool: ${poolId}`);
      const values = state ? eligible(state, scene, pool, exchange) : pool.values;
      if (!values.length) throw new ContentError(`No eligible values for ${poolId} in ${exchange.id}`);
      staticBindings[name] = values.every(value => value.hanzi === values[0].hanzi) ? values[0].hanzi : undefined;
      bound.add(name);
    }
    const rendered = exchange.replies.map(reply => reply.hanzi.replace(/\{([^{}]+)\}/g, (match, name: string) => staticBindings[name] ?? match));
    if (duplicate(rendered)) throw new ContentError(`Identical reply hanzi in ${exchange.id}`);
    for (const text of [exchange.line, ...exchange.replies]) for (const field of fields) {
      for (const name of names(text[field])) if (!bound.has(name)) throw new ContentError(`Unbound {${name}} in ${scene.id}/${exchange.id}`);
    }
    for (const target of [exchange.onWrong, ...exchange.replies.map(reply => reply.next)]) {
      if (!target) continue;
      if (target !== exchange.onWrong && scene.exchanges.some(item => item.id === target)) continue;
      const next = content.scenes.find(item => item.id === target);
      if (!next) throw new ContentError(`Unknown scene/route: ${target}`);
      if ((target === exchange.onWrong) !== (next.kind === 'consequence')) throw new ContentError(`Invalid consequence route: ${target}`);
      if (visited.has(next.id) && next.kind !== 'consequence') throw new ContentError(`Cyclic scene route: ${target}`);
      validateScene(next, content, state, visited);
    }
  }
  const paths = [{ index: 0, bound: new Set<string>() }], checked = new Set<string>();
  while (paths.length) {
    const path = paths.pop()!, exchange = scene.exchanges[path.index];
    if (!exchange) continue;
    for (const name of Object.keys(exchange.slots ?? {})) path.bound.add(name);
    const key = JSON.stringify([path.index, [...path.bound].sort()]);
    if (checked.has(key)) continue;
    checked.add(key);
    for (const text of [exchange.line, ...exchange.replies]) for (const field of fields) {
      for (const name of names(text[field])) if (!path.bound.has(name)) throw new ContentError(`Route skips binding {${name}} in ${exchange.id}`);
    }
    for (const reply of exchange.replies) {
      const index = reply.next ? scene.exchanges.findIndex(item => item.id === reply.next) : reply.correct ? path.index + 1 : path.index;
      if (index >= 0) paths.push({ index, bound: new Set(path.bound) });
    }
  }
}
const priority = (state: GameState, introduced: Set<string>, value: SlotPool['values'][number]): number => {
  if (value.words.some(word => wordState(state, word) === 'shaky')) return 0;
  if (value.words.some(word => wordState(state, word) === 'unseen' && introduced.has(word))) return 2;
  if (value.words.some(word => wordState(state, word) === 'met')) return 1;
  return 3;
};
function segment(hanzi: string, dictionary: string[]): string[] {
  const words: string[] = [];
  for (let index = 0; index < hanzi.length;) {
    const match = dictionary.find(word => hanzi.startsWith(word, index));
    if (!match) { index++; continue; }
    words.push(match); index += match.length;
  }
  return words;
}
export function fillExchange(state: GameState, scene: Scene, exchange: Exchange, bindings: Bindings, content: GameContent): Exchange {
  const slotNames = Object.keys(exchange.slots ?? {}).sort();
  const introduced = introducedBy(exchange);
  if (slotNames.length) {
    const pools = slotNames.map(name => {
      const pool = content.world.slotPools.find(item => item.id === exchange.slots![name]);
      if (!pool?.values.length) throw new ContentError(`Unknown/empty pool: ${exchange.slots![name]}`);
      return pool;
    });
    const options = pools.map(pool => usable(state, pool, exchange));
    options.forEach((values, index) => { if (!values.length) throw new ContentError(`No eligible values for ${pools[index].id} in ${exchange.id}`); });
    // Enumerate every permitted tuple instead of resampling: no random draw can miss a legal binding.
    let tuples: SlotPool['values'][number][][] = [[]];
    for (const values of options) tuples = tuples.flatMap(tuple => values.map(value => [...tuple, value]));
    const sharesPool = (left: number, right: number) => pools[left].id === pools[right].id;
    tuples = tuples.filter(tuple => tuple.every((value, index) =>
      tuple.every((other, otherIndex) => index === otherIndex || !sharesPool(index, otherIndex) || other.id !== value.id)));
    tuples = tuples.filter(tuple => !collides(scene, exchange, { ...bindings, ...Object.fromEntries(slotNames.map((name, index) => [name, tuple[index]])) }));
    if (!tuples.length) throw new ContentError(`No distinct slot values for ${exchange.id}`);
    const rank = (tuple: SlotPool['values'][number][]) => Math.min(...tuple.map(value => priority(state, introduced, value)));
    const best = Math.min(...tuples.map(rank));
    const choices = tuples.filter(tuple => rank(tuple) === best);
    state.rng = (Math.imul(state.rng, 1664525) + 1013904223) >>> 0;
    const pick = choices[Math.floor(state.rng / 4294967296 * choices.length)];
    slotNames.forEach((name, index) => { bindings[name] = structuredClone(pick[index]); });
  }
  const dictionary = [...(content.words ?? [])].map(word => word.hanzi).sort((left, right) => right.length - left.length);
  const fill = <T extends { hanzi: string; pinyin?: string; en?: string; words?: string[] }>(text: T): T => {
    const result = structuredClone(text);
    // Only placeholders this text actually renders contribute words; tags follow the filled text order.
    const used = [...new Set(fields.flatMap(field => names(text[field])))];
    for (const field of fields) if (text[field] !== undefined) result[field] = text[field]!.replace(/\{([^{}]+)\}/g, (_, name: string) => {
      if (!Object.hasOwn(bindings, name)) throw new ContentError(`Unbound {${name}} in ${exchange.id}`);
      return bindings[name][field];
    });
    result.words = dictionary.length ? segment(result.hanzi, dictionary) : [...(text.words ?? []), ...used.flatMap(name => bindings[name].words)];
    return result;
  };
  return { ...structuredClone(exchange), line: fill(exchange.line), replies: exchange.replies.map(fill) };
}
function collides(scene: Scene, exchange: Exchange, bindings: Bindings): boolean {
  // Inherited uses matter: a binding must not make a later answer ambiguous either.
  for (const later of scene.exchanges.slice(scene.exchanges.indexOf(exchange))) {
    if (later !== exchange && Object.keys(later.slots ?? {}).length) break;
    if (later.replies.some(reply => names(reply.hanzi).some(name => !Object.hasOwn(bindings, name)))) continue;
    if (duplicate(later.replies.map(reply => reply.hanzi.replace(/\{([^{}]+)\}/g, (_, name: string) => bindings[name].hanzi)))) return true;
  }
  return false;
}
