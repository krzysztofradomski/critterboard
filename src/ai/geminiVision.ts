/**
 * Gemini vision classifier — cloud POC adapter.
 *
 * Implements VisionClassifier using Gemini's multimodal API so the
 * insect-ID flow works end-to-end before the on-device EfficientNetV2-S
 * model ships. Swap by flipping USE_GEMINI_VISION → false and
 * USE_NATIVE_VISION → true in src/ai/index.ts.
 *
 * Frame contract: Scan.tsx passes `photoUri: string | null`.
 * A null URI (simulator / no camera) returns [] → NoMatch flow.
 */

import * as FileSystem from 'expo-file-system';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText } from 'ai';

import { BUGS } from '@/data/bugs';
import type { Candidate, ClassifyOptions, VisionClassifier, VisionFrame } from '@/ai/vision';

// ── Prompt ──────────────────────────────────────────────────────────────────

const BUG_CATALOG = BUGS
  .map((b) => `  { "id": "${b.id}", "name": "${b.name}", "latin": "${b.latin}" }`)
  .join(',\n');

const IDENTIFY_PROMPT = `You are an expert entomologist assisting an insect-identification app called Critterboard.
Examine the photo and identify any insects visible.

Match ONLY against this catalog (use the exact id values):
[
${BUG_CATALOG}
]

Respond with ONLY a raw JSON array — no markdown fences, no prose. Format:
[{"bugId":"<id>","confidence":<float 0.0–1.0>}, ...]

Rules:
- Order candidates by confidence descending.
- At most 3 candidates.
- confidence 0.8–1.0 = highly confident; 0.5–0.8 = plausible; 0.2–0.5 = uncertain.
- If no catalog insect is visible, return [].
- Never invent ids outside the catalog.`;

// ── Helpers ──────────────────────────────────────────────────────────────────

function apiKey(): string {
  const k = process.env.GEMINI_API_KEY ?? process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!k) throw new Error('GEMINI_API_KEY or EXPO_PUBLIC_GEMINI_API_KEY is not set');
  return k;
}

function mimeFromUri(uri: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  const lower = uri.toLowerCase();
  if (lower.includes('.png')) return 'image/png';
  if (lower.includes('.webp')) return 'image/webp';
  return 'image/jpeg';
}

const KNOWN_IDS = new Set(BUGS.map((b) => b.id));

function parseCandidates(raw: string, topK: number): Candidate[] {
  // Strip markdown code fences in case the model ignores the no-fences rule
  const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(stripped) as unknown[];
  if (!Array.isArray(parsed)) return [];

  return (parsed as { bugId?: unknown; confidence?: unknown }[])
    .filter((c) => typeof c.bugId === 'string' && KNOWN_IDS.has(c.bugId) && typeof c.confidence === 'number')
    .map((c) => ({
      bugId: c.bugId as string,
      confidence: Math.min(1, Math.max(0, c.confidence as number)),
    }))
    .slice(0, topK);
}

// ── Adapter ──────────────────────────────────────────────────────────────────

export const geminiVisionClassifier: VisionClassifier = {
  async classify(frame: VisionFrame, opts?: ClassifyOptions): Promise<Candidate[]> {
    const topK = opts?.topK ?? 3;
    const photoUri = frame as string | null;

    if (!photoUri) return [];

    const base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const mimeType = mimeFromUri(photoUri);

    const google = createGoogleGenerativeAI({ apiKey: apiKey() });
    const { text } = await generateText({
      model: google('gemini-2.5-flash'),
      maxTokens: 256,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: base64, mimeType },
            { type: 'text', text: IDENTIFY_PROMPT },
          ],
        },
      ],
    });

    try {
      return parseCandidates(text, topK);
    } catch {
      return [];
    }
  },

  ready(): boolean {
    return Boolean(process.env.GEMINI_API_KEY ?? process.env.EXPO_PUBLIC_GEMINI_API_KEY);
  },
};
