import { log } from './logger.js';

/**
 * @typedef {object} InfiniteScrollOpts
 * @property {number} targetCount Target row count to load before stopping.
 * @property {import('@playwright/test').Locator} rowsLocator Locator that resolves to all currently rendered rows.
 * @property {import('@playwright/test').Locator} [scrollContainer] Scrollable container; falls back to window scroll.
 * @property {number} [stepPx] Step in px per scroll attempt.
 * @property {number} [settleMs] ms to wait between scrolls for new rows to render.
 * @property {number} [maxAttempts] Hard cap on scroll attempts.
 * @property {number} [idleAttemptsBeforeStop] Stop early if rendered count is unchanged for N consecutive attempts (end of data).
 */

/**
 * Scrolls until the table has rendered at least `targetCount` rows.
 * Returns the actual number rendered (may be less if the data set is smaller).
 *
 * @param {import('@playwright/test').Page} page
 * @param {InfiniteScrollOpts} opts
 * @returns {Promise<number>}
 */
export async function scrollUntilRowCount(page, opts) {
  const {
    targetCount,
    rowsLocator,
    scrollContainer,
    stepPx = 800,
    settleMs = 250,
    maxAttempts = 80,
    idleAttemptsBeforeStop = 4,
  } = opts;

  let lastCount = await rowsLocator.count();
  if (lastCount >= targetCount) return lastCount;

  let idleStreak = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const before = await rowsLocator.count();

    if (scrollContainer) {
      await scrollContainer.evaluate((el, step) => {
        el.scrollTop = el.scrollTop + step;
      }, stepPx);
    } else {
      await page.evaluate((step) => window.scrollBy(0, step), stepPx);
    }

    // Wait for the *next* row to attach rather than sleeping a fixed
    // `settleMs`. Two outcomes, both wanted:
    //   * a new row renders  -> resolves immediately (usually well under
    //     settleMs, so a long scroll is markedly faster than the old sleep),
    //   * nothing renders    -> rejects at settleMs, which IS the idle signal
    //     this loop is looking for. The rejection is expected control flow,
    //     not a swallowed failure: `count()` below is the actual measurement.
    await rowsLocator
      .nth(before)
      .waitFor({ state: 'attached', timeout: settleMs })
      .catch(() => {});

    const current = await rowsLocator.count();

    if (current >= targetCount) {
      log.info(`Infinite scroll reached target`, { target: targetCount, rendered: current });
      return current;
    }

    if (current === lastCount) {
      idleStreak += 1;
      if (idleStreak >= idleAttemptsBeforeStop) {
        log.warn(`Infinite scroll exhausted (no more rows loading)`, {
          target: targetCount,
          rendered: current,
        });
        return current;
      }
    } else {
      idleStreak = 0;
      lastCount = current;
    }
  }

  log.warn(`Infinite scroll hit max attempts`, { target: targetCount, rendered: lastCount });
  return lastCount;
}
