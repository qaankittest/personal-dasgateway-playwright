import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/auth/LoginPage.js';
import { TransactionsPage } from '../../pages/transactions/TransactionsPage.js';
import { TransactionDetailsPage } from '../../pages/transactions/TransactionDetailsPage.js';
import { TEST_CONFIG } from '../../fixtures/test-config.js';

/**
 * TEMP verification spec (delete after): confirms the Refund button is now
 * driven by the transaction-schema API's `remainingRefundAmount`, and that the
 * dedicated chargeback/transactionId call no longer fires on the details page.
 */
// Use the full Chromium build (installed) instead of the headless-shell.
test.use({ channel: 'chromium' });

test.describe('verify: refund button from schema API', () => {
  test('refund visibility tracks remainingRefundAmount; no chargeback call', async ({ page }) => {
    test.slow();

    const loginPage = new LoginPage(page);
    const transactionsPage = new TransactionsPage(page);
    const detailsPage = new TransactionDetailsPage(page);

    await loginPage.goto();
    await loginPage.login(TEST_CONFIG.credentials.username, TEST_CONFIG.credentials.password);

    await transactionsPage.goto();
    await transactionsPage.waitForInitialLoad();
    const rendered = await transactionsPage.loadAtLeast(15);
    expect(rendered, 'no rows rendered').toBeGreaterThan(0);
    const snaps = await transactionsPage.getRowSnapshots(Math.min(rendered, 15));
    const refIds = snaps.map((s) => s.refId).filter((r) => !!r);

    /**
     * @typedef {object} Obs
     * @property {string} refId
     * @property {boolean} schemaCalled
     * @property {boolean} chargebackCalled
     * @property {number | null} remaining
     * @property {boolean} refundVisible
     */

    /** @type {Obs[]} */
    const results = [];

    for (const refId of refIds.slice(0, 12)) {
      let schemaCalled = false;
      let chargebackCalled = false;
      /** @type {number | null} */
      let remaining = null;

      const onReq = (req) => {
        const u = req.url();
        if (u.includes('/transactions/transaction-schema/')) schemaCalled = true;
        if (u.includes('/chargeback/transactionId/')) chargebackCalled = true;
      };
      const onResp = async (resp) => {
        if (!resp.url().includes('/transactions/transaction-schema/')) return;
        try {
          const body = await resp.json();
          const v = body?.data?.remainingRefundAmount;
          remaining = typeof v === 'number' ? v : null;
        } catch {
          /* ignore non-JSON */
        }
      };

      page.on('request', onReq);
      page.on('response', onResp);

      await page.goto(TEST_CONFIG.routes.transactionDetails(refId), {
        waitUntil: 'domcontentloaded',
      });
      await detailsPage.waitForReady();
      // give the schema fetch + button gating a beat to settle
      await page.waitForTimeout(1500);
      const refundVisible = await detailsPage.isActionVisible('refund');

      page.off('request', onReq);
      page.off('response', onResp);

      results.push({ refId, schemaCalled, chargebackCalled, remaining, refundVisible });

      console.log(
        `[OBS] ${refId} schema=${schemaCalled} chargeback=${chargebackCalled} remaining=${remaining} refundBtn=${refundVisible}`
      );
    }

    // Invariants
    for (const r of results) {
      expect(r.chargebackCalled, `chargeback call fired for ${r.refId}`).toBe(false);
      expect(r.schemaCalled, `schema call missing for ${r.refId}`).toBe(true);
      // Refund visible ⇒ remaining > 0
      if (r.refundVisible) {
        expect(
          (r.remaining ?? 0) > 0,
          `refund visible but remaining=${r.remaining} for ${r.refId}`
        ).toBe(true);
      }
      // remaining 0/null ⇒ refund hidden
      if ((r.remaining ?? 0) <= 0) {
        expect(r.refundVisible, `remaining=${r.remaining} but refund shown for ${r.refId}`).toBe(
          false
        );
      }
    }

    const withRefund = results.filter((r) => r.refundVisible).length;
    const withRemaining = results.filter((r) => (r.remaining ?? 0) > 0).length;

    console.log(
      `[SUMMARY] rows=${results.length} schemaCalledAll=${results.every((r) => r.schemaCalled)} chargebackEver=${results.some((r) => r.chargebackCalled)} remaining>0=${withRemaining} refundVisible=${withRefund}`
    );
  });
});
