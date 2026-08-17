import { expect } from '@playwright/test';
import { selectDasFormOption } from '../../utils/dasForm.js';
import { log } from '../../utils/logger.js';

/**
 * POM for the create-plan drawer (`drawerRegistry: subscription-plan-create`,
 * `SubscriptionPlanDrawer` in create-only mode → `SubscriptionPlanForm`).
 *
 * Fields (DasForm, targeted by `id={field.name}`):
 *   - `#planName`        text input
 *   - `#billingCycleType` Select   (Daily … Annually)
 *   - `#ccy`             Select   (product currencies)
 *   - `#amount`          number input
 *   - `#comments`        textarea (optional)
 *
 * Footer submit is the "SUBMIT" button bound to `form="subscription-plan-form"`
 * (`subscription_plan_drawer.create_plan`). On success the drawer calls
 * `onMutationSuccess` (refreshes the plans list) and closes itself.
 */
export class SubscriptionPlanDrawer {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;
    this.planNameInput = page.locator('#planName');
    this.amountInput = page.locator('#amount');
    this.commentsInput = page.locator('#comments');
    // Footer button is bound to the form by id, so it submits even though it
    // sits outside the <form>. Matches the localized "SUBMIT" label.
    this.submitButton = page
      .getByRole('button', { name: /^submit$/i })
      .and(page.locator('[form="subscription-plan-form"]'))
      .first();
  }

  async waitForReady() {
    await expect(this.planNameInput).toBeVisible({ timeout: 15_000 });
  }

  /**
   * Fill the create-plan form from config. `planName` is passed explicitly
   * (not read from config) so the spec can inject a per-run unique name and
   * later select that exact plan in the subscription form.
   *
   * @param {import('../../fixtures/products/types.js').SubscriptionPlanConfig} config
   * @param {string} planName
   */
  async fillPlan(config, planName) {
    log.info('Subscription plan drawer — filling create form', {
      planName,
      billingCycle: config.billingCycle,
      currency: config.currency,
    });

    await this.planNameInput.fill(planName);
    await selectDasFormOption(this.page, 'billingCycleType', config.billingCycle);
    await selectDasFormOption(this.page, 'ccy', config.currency);
    await this.amountInput.fill(config.amount);

    if (config.comments) {
      await this.commentsInput.fill(config.comments);
    }
  }

  /**
   * Submit the form and resolve on the create-plan API response. The drawer
   * POSTs `entities/recurring/plan/createPlan`; the list refetch hits a
   * different path (`…/plan/list`), so matching the create path resolves on
   * the mutation alone. Returns the new plan's id when the response carries
   * one (best-effort — the spec proves success via the plan name instead).
   *
   * @returns {Promise<string>}
   */
  async submitAndAwait() {
    const responsePromise = this.page.waitForResponse(
      (res) =>
        /recurring\/plan\/createPlan/i.test(res.url()) &&
        res.request().method() === 'POST' &&
        res.ok(),
      { timeout: 30_000 }
    );

    await this.submitButton.click();

    const response = await responsePromise;
    const body = await response.json().catch(() => null);
    const newId = body?.data?.id ?? body?.data?.ID ?? body?.id ?? body?.ID ?? '';
    log.info('Subscription plan drawer — plan created', { newId });
    return newId;
  }
}
