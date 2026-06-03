// Blocked terms checked as substrings on a normalized (lowercase + common
// leetspeak replacements) version of the input. Kept deliberately short to
// avoid false positives — covers slurs and unambiguous profanity.
const BLOCKED_TERMS: string[] = [
  // F-word family
  'fuck', 'fvck', 'fucc',
  // S-word
  'shit',
  // C-words (slur & profanity)
  'cunt',
  // Racial / ethnic slurs
  'nigger', 'nigga',
  'faggot', 'fagot',
  'chink',
  'spick', 'spic',
  'wetback',
  'gook',
  'kike',
  'beaner',
  // Other slurs
  'retard',
  'tranny',
  // Sexual violence
  'rape',
  // Profanity
  'bitch',
  'whore',
  'slut',
  'asshole',
  'twat',
  'wanker',
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/!/g, 'i')
    .replace(/\+/g, 't');
}

export function isOffensiveName(name: string): boolean {
  const n = normalize(name);
  return BLOCKED_TERMS.some((term) => n.includes(term));
}
