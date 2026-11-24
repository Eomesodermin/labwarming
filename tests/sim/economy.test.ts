import { describe, expect, it } from 'vitest';
import { CORE_FUNDING, FRIDGE_REPAIR_COST, PAPER, PRESENTATION } from '../../src/content/economy';
import { DIRECTOR, EVENTS } from '../../src/content/events';
import { PLAYER_ID } from '../../src/sim/commands';
import { step } from '../../src/sim/step';
import { coldCapacity } from '../../src/sim/stock';
import { TICKS_PER_DAY } from '../../src/content/balance';
import { doJob, equip, newGame, rejections, run, stand } from './helpers';

describe('funds and the end of the day', () => {
  it('starts with 500 Funds and 0 Reputation', () => {
    const s = newGame();
    expect(s.funds).toBe(500);
    expect(s.reputation).toBe(0);
  });

  it('pays core funding at the end of each day and raises an EndOfDay event', () => {
    const s = newGame();
    s.flags['fridgeWarmDay'] = 1; // keep the warm fridge out of this test
    const events = run(s, TICKS_PER_DAY);
    expect(s.clock.day).toBe(2);
    expect(s.funds).toBe(500 + CORE_FUNDING);
    expect(events.filter((e) => e.type === 'EndOfDay')).toEqual([{ type: 'EndOfDay', day: 1, funding: CORE_FUNDING, salaries: [], salaryTotal: 0, covered: false, funds: 600 }]);
  });
});

describe('orders and the delivery bay', () => {
  it('costs 40 for kits, and the box appears at the bay after 30 s', () => {
    const s = newGame();
    step(s, [{ type: 'PlaceOrder', orderId: 'assayKitBox' }]);
    expect(s.funds).toBe(460);
    expect(s.orders).toHaveLength(1);
    run(s, 298);
    expect(s.boxes).toHaveLength(0);
    run(s, 3);
    expect(s.boxes).toEqual([expect.objectContaining({ orderId: 'assayKitBox', qty: 4 })]);
    expect(s.orders).toHaveLength(0);
  });

  it('rejects an order the player cannot afford, and an unknown order', () => {
    const s = newGame();
    s.funds = 39;
    expect(rejections(step(s, [{ type: 'PlaceOrder', orderId: 'assayKitBox' }]))).toEqual(['Needs 40 Funds']);
    expect(rejections(step(s, [{ type: 'PlaceOrder', orderId: 'nonsense' }]))).toEqual(['Unknown order']);
    expect(s.funds).toBe(39);
  });

  it('puts a box away in 6 s and adds the stock', () => {
    const s = newGame();
    s.boxes.push({ id: 'b1', orderId: 'flaskBox', qty: 6 });
    s.stock.cleanFlasks = 0;
    doJob(s, 'bay');
    expect(s.stock.cleanFlasks).toBe(6);
    expect(s.boxes).toHaveLength(0);
  });

  it('refuses with a reason when the broken fridge is full, and works once it is repaired', () => {
    const s = newGame();
    s.stock.media = 8; // the broken fridge holds 8
    s.boxes.push({ id: 'b1', orderId: 'assayKitBox', qty: 4 });
    s.stock.assayKits = 0;
    stand(s, 'bay');
    const refused = rejections(step(s, [{ type: 'Interact' }]));
    expect(refused).toHaveLength(1);
    expect(refused[0]).toMatch(/fridge is full/i);
    expect(refused[0]).toMatch(/Repair/);
    expect(s.boxes).toHaveLength(1);

    step(s, [{ type: 'RepairEquipment', equipmentId: equip(s, 'fridge').id }]);
    expect(coldCapacity(s)).toBe(16);
    doJob(s, 'bay');
    expect(s.stock.assayKits).toBe(4);
    expect(s.boxes).toHaveLength(0);
  });

  it('puts away what fits and leaves the rest in the box', () => {
    const s = newGame(); // 7 of 8 cold spaces used
    s.boxes.push({ id: 'b1', orderId: 'assayKitBox', qty: 4 });
    doJob(s, 'bay');
    expect(s.stock.assayKits).toBe(5);
    expect(s.boxes).toEqual([expect.objectContaining({ qty: 3 })]);
  });
});

describe('fridge repair', () => {
  it('costs 150 Funds and fixes the fridge', () => {
    const s = newGame();
    const fridge = equip(s, 'fridge');
    expect(fridge.broken).toBe(true);
    step(s, [{ type: 'RepairEquipment', equipmentId: fridge.id }]);
    expect(fridge.broken).toBe(false);
    expect(s.funds).toBe(500 - FRIDGE_REPAIR_COST);
  });

  it('rejects a repair that cannot be paid or is not needed', () => {
    const s = newGame();
    const fridge = equip(s, 'fridge');
    s.funds = 100;
    expect(rejections(step(s, [{ type: 'RepairEquipment', equipmentId: fridge.id }]))).toEqual(['Needs 150 Funds']);
    s.funds = 500;
    step(s, [{ type: 'RepairEquipment', equipmentId: fridge.id }]);
    expect(rejections(step(s, [{ type: 'RepairEquipment', equipmentId: fridge.id }]))).toEqual(['Nothing to repair']);
  });
});

describe('the warm fridge', () => {
  it('emails at 13:00 and costs one media while the fridge is broken, once a day', () => {
    const s = newGame();
    const events = run(s, DIRECTOR.fridgeWarmTick + 5);
    expect(events.filter((e) => e.type === 'EmailReceived' && e.kind === 'fail_fridge_warm')).toHaveLength(1);
    expect(s.inbox.find((m) => m.kind === 'fail_fridge_warm')?.body).toBe(EVENTS['fail_fridge_warm']?.body);
    expect(s.stock.media).toBe(2);
    run(s, 50);
    expect(s.stock.media).toBe(2);
  });

  it('does not happen once the fridge is repaired', () => {
    const s = newGame();
    step(s, [{ type: 'RepairEquipment', equipmentId: equip(s, 'fridge').id }]);
    run(s, DIRECTOR.fridgeWarmTick + 5);
    expect(s.stock.media).toBe(3);
  });
});

describe('papers and Reviewer 2', () => {
  function write(s: ReturnType<typeof newGame>): void {
    s.data = Math.max(s.data, PAPER.data);
    doJob(s, 'desk', 'writePaper');
  }

  it('uses the paper Data cost and goes to review for 40 s, then paper 1 is accepted outright', () => {
    const s = newGame();
    s.data = PAPER.data + 10;
    doJob(s, 'desk', 'writePaper');
    expect(s.data).toBe(10);
    expect(s.papers).toHaveLength(1);
    expect(s.papers[0]?.status).toBe('review');
    expect(s.inbox.filter((m) => m.kind === 'paper_accepted')).toHaveLength(0);
    run(s, 395);
    expect(s.papers[0]?.status).toBe('review');
    run(s, 10);
    expect(s.papers[0]?.status).toBe('accepted');
    expect(s.funds).toBe(750);
    expect(s.reputation).toBe(10);
    const mail = s.inbox.find((m) => m.kind === 'paper_accepted');
    expect(mail?.body).toContain('Reviewer 2 was on holiday');
    expect(mail?.read).toBe(false);
  });

  it('paper 2 always comes back for a minor revision with the fixed line', () => {
    const s = newGame();
    s.papers.push({ id: 'p0', number: 1, status: 'accepted', reviewTicksLeft: 0 });
    s.stats.papersWritten = 1;
    write(s);
    run(s, 410);
    expect(s.papers[1]?.status).toBe('revise');
    expect(s.inbox.some((m) => m.body.includes('Reviewer 2: four pages.'))).toBe(true);
    expect(s.funds).toBe(500); // nothing paid yet
  });

  it('revising costs the revision Data, takes 8 s and then the paper is accepted', () => {
    const s = newGame();
    s.papers.push({ id: 'p1', number: 2, status: 'revise', reviewTicksLeft: 0 });
    s.data = PAPER.reviseData - 1;
    stand(s, 'desk');
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'revisePaper' }]))).toEqual([`Needs ${PAPER.reviseData} Data`]);
    s.data = PAPER.reviseData + 15;
    const job0 = step(s, [{ type: 'Interact', jobId: 'revisePaper' }]);
    void job0;
    run(s, 85);
    expect(s.data).toBe(15);
    expect(s.papers[0]?.status).toBe('accepted');
    expect(s.funds).toBe(750);
    expect(s.inbox.at(-1)?.body).toContain("'satisfied'");
  });

  it('from paper 3 on, outcomes are accepted or minor revision, and always from the seeded RNG', () => {
    const outcomes = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const s = newGame(seed);
      s.stats.papersWritten = 2;
      s.data = PAPER.data;
      doJob(s, 'desk', 'writePaper');
      run(s, 410);
      outcomes.add(s.papers[0]?.status ?? '');
    }
    expect([...outcomes].sort()).toEqual(['accepted', 'revise']);
  });

  it('needs the paper Data cost to write a paper', () => {
    const s = newGame();
    s.data = PAPER.data - 1;
    stand(s, 'desk');
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'writePaper' }]))).toEqual([`Needs ${PAPER.data} Data`]);
  });

  it('a presentation costs its Data and gives 8 Reputation', () => {
    const s = newGame();
    s.data = PRESENTATION.data;
    doJob(s, 'desk', 'makePresentation');
    expect(s.data).toBe(0);
    expect(s.reputation).toBe(8);
    expect(s.presentations).toBe(1);
  });
});

describe('the Seedling Grant', () => {
  it('needs 1 accepted paper', () => {
    const s = newGame();
    stand(s, 'desk');
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'writeGrant' }]))[0]).toMatch(/needs 1 accepted paper/);
    s.papers.push({ id: 'p1', number: 1, status: 'review', reviewTicksLeft: 99 });
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'writeGrant' }]))[0]).toMatch(/needs 1 accepted paper/);
  });

  it('is sent in 20 s and pays 1,200 plus 5 Reputation 30 s later with an email', () => {
    const s = newGame();
    s.papers.push({ id: 'p1', number: 1, status: 'accepted', reviewTicksLeft: 0 });
    doJob(s, 'desk', 'writeGrant');
    expect(s.grants['seedling']?.status).toBe('applied');
    expect(s.funds).toBe(500);
    run(s, 305);
    expect(s.grants['seedling']?.status).toBe('awarded');
    expect(s.funds).toBe(1700);
    expect(s.reputation).toBe(5);
    expect(s.inbox.some((m) => m.kind === 'grant_award')).toBe(true);
  });

  it('cannot be applied for twice', () => {
    const s = newGame();
    s.papers.push({ id: 'p1', number: 1, status: 'accepted', reviewTicksLeft: 0 });
    doJob(s, 'desk', 'writeGrant');
    stand(s, 'desk');
    expect(rejections(step(s, [{ type: 'Interact', jobId: 'writeGrant' }]))).toEqual(['Every open grant has an application in']);
  });
});

describe('the inbox', () => {
  it('starts with the welcome email, unread, and marking it read sticks', () => {
    const s = newGame();
    expect(s.inbox).toHaveLength(1);
    expect(s.inbox[0]?.kind).toBe('pi_welcome');
    expect(s.inbox[0]?.read).toBe(false);
    step(s, [{ type: 'MarkEmailRead', emailId: s.inbox[0]?.id ?? '' }]);
    expect(s.inbox[0]?.read).toBe(true);
  });

  it('keeps the player where they were while jobs run', () => {
    const s = newGame();
    s.data = PRESENTATION.data;
    doJob(s, 'desk', 'makePresentation');
    expect(s.agents[PLAYER_ID]?.jobId).toBeNull();
  });
});

describe('clicking a station with a menu', () => {
  it('does not start a job on arrival, it announces the station instead', () => {
    const s = newGame();
    s.data = 100;
    const desk = equip(s, 'desk');
    const events = run(s, 400, [{ type: 'SetPlayerTarget', x: desk.x, y: desk.y, stationId: desk.id }]);
    expect(s.agents[PLAYER_ID]?.jobId).toBeNull();
    expect(events.filter((e) => e.type === 'StationReached')).toEqual([{ type: 'StationReached', stationId: desk.id }]);
  });

  it('still starts the first job at an ordinary station', () => {
    const s = newGame();
    const hood = equip(s, 'hood');
    run(s, 45, [{ type: 'SetPlayerTarget', x: hood.x, y: hood.y, stationId: hood.id }]);
    expect(s.agents[PLAYER_ID]?.jobId).not.toBeNull();
  });
});
