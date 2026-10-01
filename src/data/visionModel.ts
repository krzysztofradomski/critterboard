/**
 * The on-device species-ID model. One place for its user-facing name and
 * facts so Brains, Credits, licences, the GBIF export and the "no match"
 * screen can never disagree. `id` is the model file shipped in the region
 * pack (packs/models/<id>.pte); `sizeMb` is that file.
 */
export const VISION_MODEL = {
  name: 'BugNet',
  id: 'eu-1k-commercial-v1',
  sizeMb: 88,
  species: 1000,
} as const;

/** Name + exact model id, for places that cite the model (exports, licences). */
export const VISION_MODEL_LABEL = `${VISION_MODEL.name} ${VISION_MODEL.id}`;
