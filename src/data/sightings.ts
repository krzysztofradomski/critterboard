export type Sighting = {
  x: number;
  y: number;
  /** Real species id from `BUGS` — drives the marker icon/colour and click-through. */
  bugId: string;
  size: number;
};

/**
 * Curated demo cluster of real Central-European species (ids mirror `BUGS`).
 * Each marker derives its emoji/name/colour from the species record and links
 * to that insect's detail screen.
 */
export const SIGHTINGS: Sighting[] = [
  { x: 32, y: 28, bugId: "brim", size: 1 }, // Common Brimstone 🦋
  { x: 58, y: 22, bugId: "lady", size: 1 }, // Seven-spot Ladybird 🐞
  { x: 70, y: 44, bugId: "hcat", size: 2 }, // Honey Bee 🐝
  { x: 22, y: 62, bugId: "stag", size: 1 }, // Stag Beetle 🪲
  { x: 48, y: 70, bugId: "bdam", size: 3 }, // Common Blue Damselfly 🪰
  { x: 80, y: 76, bugId: "rchf", size: 1 }, // Rose Chafer 🪲
  { x: 38, y: 50, bugId: "gshb", size: 1 }, // Green Shield Bug 🪲
  { x: 62, y: 60, bugId: "harl", size: 2 }, // Harlequin Ladybird 🐞
];
