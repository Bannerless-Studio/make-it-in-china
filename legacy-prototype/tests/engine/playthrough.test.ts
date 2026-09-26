import { expect, it } from 'vitest';
import { createGame, type GameEvents } from '../../src/engine';
import { phaseOne } from '../fixtures/engine';

it('plays p1_noodle_dishwasher_01 with one wrong reply', () => {
  const content = phaseOne();
  const sceneId = 'p1_noodle_dishwasher_01';
  const scene = content.scenes.find(item => item.id === sceneId)!;
  const initialWords = Object.fromEntries(scene.requires.map(word => [word, 'met' as const]));
  const game = createGame(content, { seed: 7, wallet: 20, initialWords, progress: { completedOn: { p1_arrival_00: 1 } } });
  const replies: GameEvents['reply'][] = [];
  game.on('reply', event => replies.push(event));
  game.start(sceneId);
  expect(game.state().actionSlots).toBe(3);
  expect(game.reply(1)).toBe(false);
  expect(game.state().dialogue!.sceneId).toBe(`${sceneId}_wrong`);
  expect(game.state().wallet).toBe(19);
  game.reply(0);
  expect(game.state().dialogue!.sceneId).toBe(sceneId);
  while (game.state().dialogue) game.reply(0);
  expect(game.state().wallet).toBe(27);
  expect(game.state().actionSlots).toBe(3);
  expect(game.state().words['杯子'].state).toBe('known');
  expect(game.state().words['碗'].state).toBe('known');
  expect(game.state().words['工作'].state).toBe('shaky');
  expect(replies.filter(reply => !reply.correct)).toHaveLength(1);
  expect(replies.flatMap(reply => reply.check ?? [])).toEqual(['count_and_table']);
  expect(game.state().dialogue).toBeNull();
  expect(game.events().slice(-2).map(event => event.type)).toEqual(['sceneEnd', 'activityEnd']);
});

it('gives evidence only to the tested words of an exchange', () => {
  const content = phaseOne();
  const scene = content.scenes.find(item => item.id === 'p1_noodle_dishwasher_01')!;
  const exchange = scene.exchanges[0];
  expect(exchange.tests).toEqual(['工作']);
  const game = createGame(content, { seed: 7, initialWords: Object.fromEntries(scene.requires.map(word => [word, 'met' as const])),
    progress: { completedOn: { p1_arrival_00: 1 } } });
  game.start('p1_noodle_dishwasher_01');
  expect(game.reply(exchange.replies.findIndex(reply => reply.correct))).toBe(true);
  expect(game.state().words['工作'].state).toBe('shaky');
  for (const word of ['你', '好', '我']) expect(game.state().words[word].state).toBe('met');
  // Met by exposure at scene start; the reply itself emits no evidence for them.
  const reasons = game.events().flatMap(event => event.type === 'word' && ['你', '好', '我'].includes(event.data.word) ? [event.data.reason] : []);
  expect(reasons).toEqual([]);
});

it('demotes only tested words on a wrong reply', () => {
  const content = phaseOne();
  const scene = content.scenes.find(item => item.id === 'p1_noodle_dishwasher_01')!;
  const game = createGame(content, { seed: 7, initialWords: Object.fromEntries([...scene.requires, '工作'].map(word => [word, 'known' as const])),
    progress: { completedOn: { p1_arrival_00: 1 } } });
  game.start('p1_noodle_dishwasher_01');
  game.reply(scene.exchanges[0].replies.findIndex(reply => reply.correct === false));
  expect(game.state().words['工作'].state).toBe('shaky');
  for (const word of ['你', '好', '我']) expect(game.state().words[word].state).toBe('known');
});
