import { describe, expect, it } from 'vitest';
import { createGame, type Game } from '../../src/engine';
import { phaseOne } from '../fixtures/engine';

const play = (game: Game, sceneId: string) => {
  game.start(sceneId);
  for (let guard = 0; guard < 400 && game.state().dialogue; guard++) {
    const task = game.state().pendingWorldTask;
    if (task) { game.completeWorldTask(task.taskId); continue; }
    const frame = game.state().dialogue!;
    const index = frame.exchange.replies.findIndex(reply => reply.correct === true);
    expect(index, `${frame.sceneId}/${frame.exchange.id} has no correct reply`).toBeGreaterThanOrEqual(0);
    game.reply(index);
  }
  expect(game.state().dialogue, `${sceneId} did not finish`).toBeNull();
};
const route: string[][] = [
  ['p1_arrival_00', 'p1_noodle_dishwasher_01', 'p1_noodle_dishwasher_02', 'p1_noodle_dishwasher_03', 'p1_mentor_negatives_01'],
  ['p1_warehouse_porter_01', 'p1_noodle_dishwasher_01', 'p1_noodle_dishwasher_02', 'p1_mentor_quantities_02'],
  ['p1_warehouse_porter_02', 'p1_delivery_directions_01', 'p1_delivery_names_02', 'p1_noodle_dishwasher_03'],
  ['p1_ask_time_01', 'p1_buy_fruit_01', 'p1_noodle_dishwasher_03', 'p1_pay_rent_01', 'p1_landlord_phone_01',
    'p1_cook_family_chat_01', 'p1_customer_people_chat_02', 'p1_mentor_address_03'],
  ['p1_warehouse_porter_01', 'p1_delivery_directions_01', 'p1_noodle_dishwasher_03', 'p1_study_at_home_01',
    'p1_room_evening_01', 'p1_weather_lunch_01'],
];

describe('GDD 5.4 worked ledgers on the canonical route', () => {
  it('matches the day 1 and day 5 tables', () => {
    const game = createGame(phaseOne(), { seed: 1 });
    const dawn: number[] = [], dusk: number[] = [];
    expect(game.state().wallet).toBe(20);
    for (const day of route) {
      dawn.push(game.state().wallet);
      for (const sceneId of day) {
        expect(game.availableScenes().map(scene => scene.id), `day ${game.state().day}`).toContain(sceneId);
        play(game, sceneId);
      }
      dusk.push(game.state().wallet);
      game.sleep();
    }
    // GDD 4 day table: start / end / next dawn per day.
    expect(dawn).toEqual([20, 45, 70, 113, 116]);
    expect(dusk).toEqual([47, 72, 115, 118, 148]);
    expect(game.state()).toMatchObject({ day: 6, wallet: 146, actionSlots: 4 });
    expect(game.state().progress.inventory).toMatchObject({ bus_ticket: 1, fruit_portion: 1 });
    expect(game.state().progress.mentorTopics).toEqual([
      'p1_mentor_negatives_01', 'p1_mentor_quantities_02', 'p1_mentor_address_03', 'p1_study_at_home_01',
    ]);
    expect(game.state().progress.completedOn.p1_wrong_bus_01).toBe(4);
  });
});
