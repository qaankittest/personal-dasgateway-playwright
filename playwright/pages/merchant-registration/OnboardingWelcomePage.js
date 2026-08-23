import { escapeRegExp } from '../../utils/dasForm.js';

/**
 * Step 4 — what a brand-new merchant lands on: `/onboarding?step=business`,
 * with the welcome banner stacked over the business form.
 *
 * Observed against the live dev app (2026-08-23):
 *   - the "WELCOME TO PAYMENT OPTIONS" panel is a `role="dialog"`, not a
 *     screen, and it renders a few seconds *after* the redirect — the portal
 *     shell paints first, so readiness has to wait on the dialog itself;
 *   - CONTINUE swaps the banner's body for the instruction step ("Please fill
 *     in the information under each section below.") carrying START NOW and a
 *     close control named "Close welcome banner". That second panel is **not
 *     exposed as a `dialog`** — scoping its locators through `getByRole
 *     ('dialog')` finds nothing — so they hang off the page instead;
 *   - START NOW dismisses the banner entirely and leaves the Business Details
 *     section in front of the user;
 *   - the onboarding form behind it is out of scope here — its field-level
 *     validation belongs to the onboarding suite;
 *   - the banner's copy is **CSS-uppercased**: the screen reads "WELCOME TO
 *     PAYMENT OPTIONS" and "CONTINUE" while the DOM holds "Welcome to Payment
 *     Options" and "Continue". Text locators here match case-insensitively for
 *     that reason — the same trap the account form's CLICK TO VERIFY EMAIL ID
 *     button sets.
 *
 * Locators and actions only — every assertion lives in the spec.
 */
export class OnboardingWelcomePage {
  /** @param {import('@playwright/test').Page} page */
  constructor(page) {
    this.page = page;

    // ---- the banner ------------------------------------------------------
    this.dialog = page.getByRole('dialog');
    this.heading = this.dialog.getByText(/^welcome to payment options$/i);
    this.subHeading = this.dialog.getByText(/we will need the following to get you started/i);
    this.continueButton = this.dialog.getByRole('button', { name: /continue/i });

    // ---- the instruction step -------------------------------------------
    // Page-scoped, not dialog-scoped: this panel drops the `dialog` role.
    this.instruction = page.getByText(/please fill in the information under each section below/i);
    this.instructionBody = page.getByText(/continue from where you left off/i);
    this.startNowButton = page.getByRole('button', { name: /start now/i });
    this.closeBannerButton = page.getByRole('button', { name: 'Close welcome banner' });

    // ---- the form behind it ----------------------------------------------
    this.businessDetailsSection = page.getByText(/^business details$/i).first();
    this.applicationRefId = page.getByText(/application ref id/i);
    this.companyTypeField = page.getByText('Company Type', { exact: false }).first();

    // The market the application was registered under, carried through from the
    // Country chosen on the account form. A DasForm Select, so `#fieldName`
    // (SKILL §8) — the same id the registration form uses for its own Country.
    this.businessLocationField = page.locator('#businessLocation');

    // Address block fields whose presence is market-dependent — Japan asks for
    // a Postcode, Hong Kong does not.
    this.postcodeField = page.getByText(/^postcode/i).first();
    this.cityField = page.getByText(/^city/i).first();
  }

  // ---- dynamic locators -------------------------------------------------

  /** One of the three information cards, by its title.
   * @param {string} title @returns {import('@playwright/test').Locator} */
  card(title) {
    return this.dialog.getByText(new RegExp(`^${escapeRegExp(title)}$`, 'i'));
  }

  /** A card's body copy. @param {string} body
   * @returns {import('@playwright/test').Locator} */
  cardBody(body) {
    return this.dialog.getByText(new RegExp(`^${escapeRegExp(body)}$`, 'i'));
  }

  /**
   * A labelled field in the onboarding form behind the banner. The upload
   * fields carry no `id`, and their labels are the only stable hook — which is
   * what makes them usable as the market fingerprint: Hong Kong asks for one
   * combined registration document where Japan asks for two separate ones.
   *
   * @param {string} label
   * @returns {import('@playwright/test').Locator}
   */
  formField(label) {
    return this.page.getByText(new RegExp(escapeRegExp(label), 'i')).first();
  }

  // ---- navigation -------------------------------------------------------

  /** Readiness gate — a wait, not a verification. The banner trails the
   *  redirect by a few seconds, so this waits longer than a repaint. */
  async waitForReady() {
    await this.heading.waitFor({ state: 'visible', timeout: 45_000 });
  }

  // ---- actions ----------------------------------------------------------

  async continueToInstructions() {
    await this.continueButton.click();
  }

  async startNow() {
    await this.startNowButton.click();
    await this.startNowButton.waitFor({ state: 'hidden' });
  }

  async closeBanner() {
    await this.closeBannerButton.click();
    await this.closeBannerButton.waitFor({ state: 'hidden' });
  }
}
