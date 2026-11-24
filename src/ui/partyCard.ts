import { PARTY, PROMPTS } from '../content/facility';
import type { GameHost } from '../host';
import { formatPlayTime } from '../platform/feedback';
import { goalRows, staffRows } from '../sim/selectors';
import { PALETTE_HEX } from '../view/art/palette';
import { button, el, esc } from './dom';
import { openModal, whenFree } from './modal';

const CONFETTI = ['terracotta', 'mustard', 'sage', 'sky', 'dustyRose', 'berry', 'butter', 'teal'] as const;

function confetti(): string {
  const bits: string[] = [];
  for (let i = 0; i < 36; i++) {
    const colour = PALETTE_HEX[CONFETTI[i % CONFETTI.length] as keyof typeof PALETTE_HEX];
    const left = (i * 37) % 100;
    const delay = ((i * 13) % 20) / 10;
    const dur = 2.4 + ((i * 7) % 10) / 5;
    bits.push(`<i style="left:${left}%;background:${colour};animation-delay:${delay}s;animation-duration:${dur}s"></i>`);
  }
  return `<div class="confetti" aria-hidden="true">${bits.join('')}</div>`;
}

/** The group photo: the postdoc and the whole team in a row, Prof. Quince at the end, with a cake. */
function photoHtml(host: GameHost): string {
  const s = host.state;
  const people: Array<{ name: string; colour: keyof typeof PALETTE_HEX }> = [
    { name: s.playerName, colour: 'terracotta' },
    ...staffRows(s).map((r) => ({ name: r.name, colour: r.colour })),
    { name: 'Prof. Quince', colour: 'berry' },
  ];
  const figs = people
    .map((p) => `<div class="photo__who"><span class="photo__head"></span><span class="photo__body" style="background:${PALETTE_HEX[p.colour]}"></span><span class="photo__name">${esc(p.name)}</span></div>`)
    .join('');
  return `<div class="photo"><div class="photo__row">${figs}<div class="photo__cake" aria-label="cake"></div></div><div class="photo__caption">${esc(PARTY.caption)}</div></div>`;
}

/** The party card (once) and the two feedback prompts (once each). */
export function mountPartyCard(root: HTMLElement, host: GameHost, openNote: () => void): void {
  host.events.on((e) => {
    if (e.type === 'PartyStarted') {
      whenFree(() => {
        const modal = openModal(root, host, { title: PARTY.title });
        const s = host.state;
        const rows = goalRows(s)
          .map((r) => `<tr><th>${esc(r.text)}</th><td>${r.atSec !== null ? esc(formatPlayTime(r.atSec)) : '-'}</td></tr>`)
          .join('');
        const wrap = el('div', 'party', `${confetti()}<p class="party__line">${esc(PARTY.line)}</p>${photoHtml(host)}<table class="eod party__times">${rows}</table>`);
        const go = button('Keep playing', 'btn btn--primary', () => modal.close());
        const actions = el('div', 'modal__actions');
        actions.appendChild(go);
        modal.body.append(wrap, actions);
        go.focus();
      });
    } else if (e.type === 'FeedbackPrompt') {
      whenFree(() => {
        const modal = openModal(root, host, { title: 'A small favour', pause: false });
        const yes = button('Leave a note', 'btn btn--primary', () => {
          modal.close();
          openNote();
        });
        const no = button('Not now', 'btn', () => modal.close());
        const actions = el('div', 'modal__actions');
        actions.append(yes, no);
        modal.body.append(el('p', 'modal__hint', esc(PROMPTS.text)), actions);
      });
    }
  });
}
