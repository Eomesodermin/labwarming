import { PAYROLL } from '../content/staff';
import type { GameState } from './types';

/**
 * Why a purchase cannot be made, or null. Rooms, equipment and hires need Funds that are not
 * negative (design doc 5.3). Only orders may go on while Funds are negative.
 */
export function spendBlocker(state: GameState, price: number): string | null {
  if (price <= 0) return null;
  if (state.funds < 0) return 'Funds are negative. Rooms, equipment and hires wait until the lab is back in the black';
  if (state.funds < price) return `Needs ${price} Funds`;
  return null;
}

/** Orders still work when Funds are negative, down to the same floor that salaries stop at. */
export function orderBlocker(state: GameState, price: number): string | null {
  if (state.funds >= price) return null;
  if (state.funds < 0 && state.funds - price >= PAYROLL.floor) return null;
  if (state.funds < 0) return `Funds are at the limit of ${PAYROLL.floor}. Orders wait until Funds recover`;
  return `Needs ${price} Funds`;
}
