import type { GameHost } from '../host';

/** The ids of the last few notable events, added to every feedback note. */
export function trackRecentEvents(host: GameHost): () => string[] {
  const log: string[] = [];
  const add = (id: string): void => {
    log.push(id);
    if (log.length > 5) log.shift();
  };
  host.events.on((e) => {
    switch (e.type) {
      case 'JobCompleted':
        add(`job:${e.defId}`);
        break;
      case 'EmailReceived':
        add(`email:${e.kind}`);
        break;
      case 'EndOfDay':
        add(`end_of_day:${e.day}`);
        break;
      case 'Purchase':
        add(`purchase:${e.what}`);
        break;
      case 'CultureContaminated':
        add('culture_contaminated');
        break;
      case 'GrantAwarded':
        add(`grant:${e.grantId}`);
        break;
      default:
        break;
    }
  });
  return () => [...log];
}
