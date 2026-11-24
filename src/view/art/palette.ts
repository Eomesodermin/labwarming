// The 16 palette colours (design doc 7.2). Every sprite and UI colour comes from here.

export const PALETTE_HEX = {
  plum: '#4A3540',
  cocoa: '#7A5548',
  warmWood: '#C68B59',
  terracotta: '#D9734E',
  mustard: '#E8B04A',
  butter: '#F6D98B',
  cream: '#F3E3C3',
  paper: '#FFF6E5',
  sage: '#8FB996',
  moss: '#5E8C6A',
  teal: '#4E8C8A',
  sky: '#A7D3D8',
  dustyRose: '#D98C8C',
  berry: '#A8516E',
  stone: '#B8A99A',
  slate: '#6E6A78',
} as const;

export type PaletteName = keyof typeof PALETTE_HEX;

export const PALETTE: Record<PaletteName, number> = Object.fromEntries(
  Object.entries(PALETTE_HEX).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
) as Record<PaletteName, number>;
