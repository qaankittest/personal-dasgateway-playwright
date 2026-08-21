export class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    
    // Locators
    this.pageHeading = page.getByRole('paragraph').filter({ hasText: 'Sign in to Payment Options' });
    this.emailInput = page.getByRole('textbox', { name: 'Email Address' });
    this.passwordInput = page.getByRole('textbox', { name: 'Password' });
    this.signInBtn = page.getByRole('button', { name: 'Sign in' });
    
    // Links within root
    this.forgotPasswordLink = page.locator('#root').getByText('Forgot Password?');
    this.createAccountLink = page.locator('#root').getByText('Create an Account');
    
    // Alerts and Status messages
    this.emailRequiredAlert = page.getByRole('alert');

    // Toast notifications (react-hot-toast). Not a native dialog — the toaster
    // is a portal rendered outside `#root` (`[data-rht-toaster]`), each toast is
    // `role="status" aria-live="polite"` and auto-dismisses after a few seconds.
    // Scope through the container so a `role=status` elsewhere on the page can
    // never satisfy the assertion; `.first()` keeps stacked toasts out of strict
    // mode (the newest is rendered first).
    this.toaster = page.locator('[data-rht-toaster]');
    this.toast = this.toaster.getByRole('status').first();
    this.toastMessage = this.toast.locator('p');
    this.dismissToastBtn = this.toast.getByRole('button', { name: 'Dismiss notification' });
    
    // Password toggles
    this.showPasswordBtn = page.getByRole('button', { name: 'Show password' });
    this.hidePasswordBtn = page.getByRole('button', { name: 'Hide password' });
  }

  // Actions
  async goto() {
    await this.page.goto('https://dev.paymentoptions.com/beta/login');
  }

  async fillEmail(email) {
    await this.emailInput.fill(email);
  }

  async fillPassword(password) {
    await this.passwordInput.fill(password);
  }

  async submitLogin() {
    await this.signInBtn.click();
  }

  /**
   * The toast carrying a given message. Lets a spec assert presence and content
   * in one web-first `toBeVisible()` instead of chaining two checks against a
   * node that auto-dismisses out from under them.
   * @param {string|RegExp} text
   */
  toastWithText(text) {
    return this.toaster.getByRole('status').filter({ hasText: text }).first();
  }

  /** Close the current toast instead of waiting out its auto-dismiss timer. */
  async dismissToast() {
    await this.dismissToastBtn.click();
  }

  async togglePasswordVisibility(show) {
    if (show) {
      await this.showPasswordBtn.click();
    } else {
      await this.hidePasswordBtn.click();
    }
  }
}