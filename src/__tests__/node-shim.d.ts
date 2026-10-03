// The few Node APIs the tests use to read the committed pack files (vitest runs on Node).
// ponytail: not @types/node, whose globals would leak into the React Native app's types.
declare module 'node:fs' {
  export function readFileSync(path: string): Uint8Array;
  export function statSync(path: string): { size: number };
}

declare module 'node:crypto' {
  export function createHash(algorithm: string): { update(data: Uint8Array): { digest(encoding: 'hex'): string } };
}
