import React from 'react';
import Svg, { Rect } from 'react-native-svg';

export type PixelBugProps = {
  size?: number;
  color?: string;
  accent?: string;
};

const PIXELS: Array<[number, number]> = [
  [7, 4], [8, 4], [7, 5], [8, 5], [7, 6], [8, 6], [7, 7], [8, 7],
  [7, 8], [8, 8], [7, 9], [8, 9], [7, 10], [8, 10],
  [7, 3], [8, 3],
  [6, 2], [9, 2], [5, 1], [10, 1],
  [5, 5], [10, 5], [4, 6], [11, 6], [5, 8], [10, 8],
  [4, 9], [11, 9], [5, 11], [10, 11],
];
const ACCENTS: Array<[number, number]> = [[7, 5], [8, 5], [7, 8], [8, 8]];

function isAccent(x: number, y: number): boolean {
  return ACCENTS.some(([ax, ay]) => ax === x && ay === y);
}

export function PixelBug({ size = 64, color = '#3a2618', accent = '#e8782c' }: PixelBugProps) {
  const px = size / 16;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {PIXELS.map(([x, y], i) => (
        <Rect
          key={i}
          x={x * px}
          y={y * px}
          width={px}
          height={px}
          fill={isAccent(x, y) ? accent : color}
        />
      ))}
    </Svg>
  );
}
