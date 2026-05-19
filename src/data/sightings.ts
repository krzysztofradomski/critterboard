export type Sighting = {
  x: number;
  y: number;
  bug: string;
  size: number;
};

export const SIGHTINGS: Sighting[] = [
  { x: 32, y: 28, bug: '🦋', size: 1 },
  { x: 58, y: 22, bug: '🐞', size: 1 },
  { x: 70, y: 44, bug: '🐝', size: 2 },
  { x: 22, y: 62, bug: '🪲', size: 1 },
  { x: 48, y: 70, bug: '✨', size: 3 },
  { x: 80, y: 76, bug: '🦗', size: 1 },
  { x: 38, y: 50, bug: '🌿', size: 1 },
  { x: 62, y: 60, bug: '🦋', size: 2 },
];
