import { expect } from '@playwright/test';
import { ACTION_LABELS } from '../../fixtures/test-config.js';

/** @typedef {import('../../fixtures/test-config.js').ActionButton} ActionButton */

/**
 * @typedef {object} ActionVisibility
 * @property {boolean} refund
 * @property {boolean} capture
 * @property {boolean} void
 * @property {boolean} dispute
 * @property {boolean} editStatus
 */

export class TransactionDetailsPage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
  }

  async waitForReady() {
    await expect(this.page).toHaveURL(/\/transactions\/[^/]+/);
    const spinner = this.page.locator('svg.animate-spin').first();
    await expect(spinner).toHaveCount(0, { timeout: 30_000 });
  }

  /**
   * @param {ActionButton} action
   * @returns {import('@playwright/test').Locator}
   */
  #button(action) {
    const testId = this.page.getByTestId(`action-${action}`);
    const byRole = this.page.getByRole('button', { name: ACTION_LABELS[action] });
    return testId.or(byRole).first();
  }

  /** @returns {Promise<ActionVisibility>} */
  async getActionVisibility() {
    return {
      refund: await this.isActionVisible('refund'),
      capture: await this.isActionVisible('capture'),
      void: await this.isActionVisible('void'),
      dispute: await this.isActionVisible('dispute'),
      editStatus: await this.isActionVisible('editStatus'),
    };
  }

  /**
   * @param {ActionButton} action
   * @returns {Promise<boolean>}
   */
  async isActionVisible(action) {
    const btn = this.#button(action);
    if ((await btn.count()) === 0) return false;
    return btn.isVisible();
  }

  /**
   * @param {ActionButton} action
   * @returns {Promise<boolean>}
   */
  async isActionEnabled(action) {
    const btn = this.#button(action);
    if ((await btn.count()) === 0) return false;
    return btn.isEnabled();
  }
}
