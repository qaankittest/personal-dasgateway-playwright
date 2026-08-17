import { expect } from '@playwright/test';
import { log } from './logger.js';

/** @typedef {import('../fixtures/test-config.js').ActionButton} ActionButton */
/** @typedef {import('../pages/transactions/TransactionDetailsPage.js').ActionVisibility} ActionVisibility */

/** @type {ActionButton[]} */
const ALL_ACTIONS = ['refund', 'capture', 'void', 'dispute', 'editStatus'];

/** Common assertions: visible buttons must be enabled; capture and void are mutually exclusive.
 *
 * @param {import('../pages/transactions/TransactionDetailsPage.js').TransactionDetailsPage
 *   | import('../pages/transactions/TransactionDrawerPage.js').TransactionDrawerPage} surface
 * @param {ActionVisibility} visibility
 * @param {number} rowIndex
 * @param {string | null} refId
 * @param {'drawer' | 'details'} surfaceLabel
 */
async function assertSurface(surface, visibility, rowIndex, refId, surfaceLabel) {
  for (const action of ALL_ACTIONS) {
    if (!visibility[action]) continue;
    const enabled = await surface.isActionEnabled(action);
    expect(
      enabled,
      `[${surfaceLabel}] Row #${rowIndex} (${refId}): "${action}" is visible but disabled`
    ).toBe(true);
  }

  if (visibility.capture && visibility.void) {
    throw new Error(
      `[${surfaceLabel}] Row #${rowIndex} (${refId}): capture AND void both visible — selector logic conflict`
    );
  }
}

/**
 * @param {import('../pages/transactions/TransactionDetailsPage.js').TransactionDetailsPage} detailsPage
 * @param {number} rowIndex
 * @param {string | null} refId
 * @returns {Promise<ActionVisibility>}
 */
export async function validateRowActions(detailsPage, rowIndex, refId) {
  const visibility = await detailsPage.getActionVisibility();
  log.info(`[details] Row #${rowIndex}`, { refId, ...visibility });
  await assertSurface(detailsPage, visibility, rowIndex, refId, 'details');
  return visibility;
}

/**
 * @param {import('../pages/transactions/TransactionDrawerPage.js').TransactionDrawerPage} drawer
 * @param {number} rowIndex
 * @param {string | null} refId
 * @returns {Promise<ActionVisibility>}
 */
export async function validateDrawerActions(drawer, rowIndex, refId) {
  const visibility = await drawer.getActionVisibility();
  log.info(`[drawer] Row #${rowIndex}`, { refId, ...visibility });
  await assertSurface(drawer, visibility, rowIndex, refId, 'drawer');
  return visibility;
}

/**
 * Drawer header and details page both consume `selectTransactionActions`.
 * Visibility must agree across surfaces — any divergence indicates a UI bug.
 *
 * @param {ActionVisibility} drawer
 * @param {ActionVisibility} details
 * @param {number} rowIndex
 * @param {string | null} refId
 */
export function assertSurfacesAgree(drawer, details, rowIndex, refId) {
  const diffs = ALL_ACTIONS.filter((a) => drawer[a] !== details[a]);
  expect(
    diffs,
    `Row #${rowIndex} (${refId}): drawer vs details disagree on [${diffs.join(', ')}] — ` +
      `drawer=${JSON.stringify(drawer)}, details=${JSON.stringify(details)}`
  ).toEqual([]);
}
