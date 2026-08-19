// Unique-value helpers — one source of truth for "make this record collide with
// nothing", per the data-factory skill.
//
// Every value carries the same `runId` prefix plus a per-call counter, so:
//   * two workers running in the same millisecond cannot collide (a bare
//     `Date.now()` can, and the suite previously had four separate
//     `Date.now()`-based schemes that each could),
//   * leftover records from a run are greppable by their shared runId.
//
// Set RUN_ID in the environment to pin the prefix across a distributed run.
import { randomUUID } from 'node:crypto';

/** Shared per-process prefix. Includes the worker index so parallel workers
 *  can never mint the same suffix even within the same millisecond. */
export const runId =
  process.env.RUN_ID ??
  `${randomUUID().slice(0, 8)}${process.env.TEST_WORKER_INDEX ?? '0'}`;

let counter = 0;

/** Monotonic, collision-free suffix: `<runId>-<n>`. */
export function uniqueSuffix() {
  counter += 1;
  return `${runId}-${counter}`;
}

/** Upper-case, alphanumeric-only token — for fields that reject punctuation
 *  (business names, reference codes). */
export function uniqueToken() {
  return uniqueSuffix().replace(/-/g, '').toUpperCase();
}

/** @param {string} [prefix] */
export function uniqueName(prefix = 'AUTO') {
  return `${prefix}-${uniqueSuffix()}`;
}

/** @param {string} [prefix] @param {string} [domain] */
export function uniqueEmail(prefix = 'po-e2e', domain = 'example.com') {
  return `${prefix}-${uniqueSuffix()}@${domain}`;
}

/** Digits-only value for phone / registration-number style fields.
 *  @param {number} [length] */
export function uniqueDigits(length = 10) {
  const digits = `${Date.now()}${counter++}`.replace(/\D/g, '');
  return digits.slice(-length).padStart(length, '9');
}
