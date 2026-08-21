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
    this.loginStatusAlert = page.getByRole('status');
    
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

  async togglePasswordVisibility(show) {
    if (show) {
      await this.showPasswordBtn.click();
    } else {
      await this.hidePasswordBtn.click();
    }
  }
}