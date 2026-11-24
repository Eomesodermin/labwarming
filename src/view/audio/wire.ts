import type { GameHost } from '../../host';
import { sound } from './sound';

/**
 * Turns what happens in the sim into sounds. Events cover most of it. A few things the sim never
 * announces (money arriving, a media bottle, a piece being placed) are noticed by comparing the
 * state a few times a second.
 */
export function wireSound(host: GameHost): void {
  host.events.on((e) => {
    switch (e.type) {
      case 'JobCompleted':
        sound.play('pop');
        break;
      case 'SweetSpot':
        if (e.hit) sound.play('ding');
        break;
      case 'EmailReceived':
        sound.play('ping');
        break;
      case 'GoalReached':
        sound.play('goal');
        break;
      case 'PartyStarted':
        sound.play('party');
        break;
      case 'CultureReady':
        sound.play('ding');
        break;
      case 'BoxDelivered':
        sound.play('knock');
        break;
      case 'StaffHired':
        sound.play('ping');
        break;
      case 'PaperReviewed':
        if (e.status === 'accepted') sound.play('chaching');
        break;
      case 'CommandRejected':
        sound.play('nope');
        break;
      default:
        break;
    }
  });

  let funds = host.state.funds;
  let media = host.state.stock.media;
  let placed = signature(host);
  let state = host.state;
  setInterval(() => {
    const s = host.state;
    if (s !== state) {
      // A new game or a loaded one: start comparing from here.
      state = s;
      funds = s.funds;
      media = s.stock.media;
      placed = signature(host);
      return;
    }
    if (s.funds > funds) sound.play('chaching');
    funds = s.funds;
    if (s.stock.media > media) sound.play('bottle');
    media = s.stock.media;
    const sig = signature(host);
    if (sig !== placed) sound.play('place');
    placed = sig;
  }, 120);
}

/** A cheap fingerprint of where everything stands, to notice a piece being placed, moved or sold. */
function signature(host: GameHost): string {
  const s = host.state;
  const eq = Object.values(s.equipment)
    .map((q) => `${q.id}:${q.x},${q.y},${q.rot},${q.tier}`)
    .join(';');
  const plots = Object.values(s.plots)
    .map((p) => (p.owned ? '1' : '0'))
    .join('');
  return `${eq}|${plots}`;
}
