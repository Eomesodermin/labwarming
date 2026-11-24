// Event rows: ids, senders and text. No event logic lives in the systems (design doc 6.2).
// Milestone 3 has the welcome email, the warm fridge, the grant decision and the Reviewer 2 letters.

import { TICKS_PER_DAY } from './balance';

export const PI_NAME = 'Prof. Quince';
export const REVIEWER_NAME = 'Reviewer 2';
export const FUNDER_NAME = 'Seedling Fund';

export interface EmailRow {
  id: string;
  from: string;
  subject: string;
  body: string;
}

export const EVENT_ROWS: Record<string, EmailRow> = {
  pi_welcome: {
    id: 'pi_welcome',
    from: PI_NAME,
    subject: 'Welcome to the team!',
    body: 'Welcome to the team! The lab is small but it has character. The fridge has the most character. Do great things.\n\nBest, W\nSent from my phone',
  },
  grant_award_seedling: {
    id: 'grant_award_seedling',
    from: FUNDER_NAME,
    subject: 'Seedling Grant: decision',
    body: 'We are pleased to inform you. (The rest of the email is three pages about reporting duties.)',
  },
};

/** The warm fridge: 13:00 on any day while the fridge is broken, at most once a day. */
export const FRIDGE_WARM = {
  id: 'fail_fridge_warm',
  /** 13:00 is five hours after the day starts at 08:00. */
  tickOfDay: Math.round((TICKS_PER_DAY / 10) * 5),
  text: 'The fridge is warm again. One bottle of media has gone cloudy. It is looking at you.',
} as const;
