import { describe, expect, it } from 'vitest';
import { createGame, CommandError } from '../../src/engine';
import { content, scene } from '../fixtures/engine';

describe('learner evidence and notebook', () => {
  it('meets words only when they appear, recording their first sentence', () => {
    const game = createGame(content(scene({ introduces: ['杯子', '茶'] })));
    expect(game.state().words['杯子']).toBeUndefined(); game.start('job');
    expect(game.state().words['杯子']).toEqual({ state: 'met', lastSeen: 1, firstSeen: { location: 'shop', sentence: '杯子', audio: 'cup' } });
    expect(game.state().words['茶']).toBeUndefined();
  });
  it('moves met to shaky to known on separate correct replies', () => {
    const game = createGame(content()); game.start('job'); game.reply(0);
    expect(game.state().words['杯子'].state).toBe('shaky'); game.start('job'); game.reply(0);
    expect(game.state().words['杯子'].state).toBe('known');
  });
  it('does not double-count repeated tags in one reply', () => {
    const data = content(); data.scenes[0].exchanges[0].line.words = ['杯子', '杯子'];
    const game = createGame(data); game.start('job'); game.reply(0);
    expect(game.state().words['杯子'].state).toBe('shaky');
  });
  it('wrong replies move known down to shaky', () => {
    const game = createGame(content(), { initialWords: { 杯子: 'known' } }); game.start('job'); game.reply(1);
    expect(game.state().words['杯子'].state).toBe('shaky');
  });
  it('pinyin taps lower evidence but never remove a met word', () => {
    const game = createGame(content(), { initialWords: { 杯子: 'known' } });
    game.tapWord('杯子'); expect(game.state().words['杯子'].state).toBe('shaky');
    game.tapWord('杯子'); game.tapWord('杯子'); expect(game.state().words['杯子'].state).toBe('met');
    expect(game.events().at(-1)?.data).toMatchObject({ reason: 'tap' });
  });
  it('rejects taps on unseen words without mutating state', () => {
    const game = createGame(content()), before = game.state();
    expect(() => game.tapWord('茶')).toThrow(CommandError); expect(game.state()).toEqual(before);
  });
  it('decays known words at three days, leaving met and unseen unchanged', () => {
    const game = createGame(content(), { initialWords: { 杯子: 'known', 茶: 'met', 水: 'unseen' } });
    game.sleep(); game.sleep(); expect(game.state().words['杯子'].state).toBe('known'); game.sleep();
    expect(game.state().words['杯子'].state).toBe('shaky'); expect(game.state().words['茶'].state).toBe('met');
    expect(game.state().words['水'].state).toBe('unseen');
  });
  it('supports configurable decay and resets lastSeen on exposure', () => {
    const game = createGame(content(), { decayDays: 2, initialWords: { 杯子: 'known' } });
    game.sleep(); game.start('job'); game.reply(0); game.sleep();
    expect(game.state().words['杯子'].state).toBe('known'); game.sleep(); expect(game.state().words['杯子'].state).toBe('shaky');
    expect(game.state().words['杯子'].lastSeen).toBe(2);
  });
  it('gates scenes on every required word being at least met', () => {
    const data = content(scene({ id: 'locked', requires: ['杯子', '茶'] }), scene());
    const game = createGame(data, { initialWords: { 茶: 'met' } });
    expect(game.availableScenes().map(item => item.id)).toEqual(['job']); expect(() => game.start('locked')).toThrow(CommandError);
    game.start('job'); game.reply(0); expect(game.availableScenes().map(item => item.id)).toContain('locked');
  });
});
