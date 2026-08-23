import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/login/LoginPage.js';
import { uniqueEmail } from '../../data/uniq.js';

test.describe('Login Page Tests', () => {
  let loginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.goto();
  });

  test('should display all required static elements on load', async () => {
    await expect(loginPage.pageHeading).toBeVisible();
    await expect(loginPage.signInBtn).toBeVisible();
    await expect(loginPage.forgotPasswordLink).toBeVisible();
    await expect(loginPage.createAccountLink).toBeVisible();
  });

  test('should show error for incorrect credentials', async ({ page }) => {
    // A fresh address every run — hammering one fixed account trips the
    // "locked due to multiple failed login attempts" rule, which then swaps the
    // toast text and fails this test for 60 minutes. (This is what the comment
    // always claimed; the address was hardcoded until 2026-08-24, and a day of
    // repeated runs duly locked it out.)
    await loginPage.fillEmail(uniqueEmail('po-e2e-nosuchuser'));
    await loginPage.fillPassword('Test12345678999@#');
    await loginPage.submitLogin();


    // The failure surfaces as a react-hot-toast notification, not a browser
    // dialog — a `role="status"` node in the `[data-rht-toaster]` portal. The
    // locator carries the expected message, so this web-first `toBeVisible()`
    // retries until a toast saying exactly that is on screen.
    await expect(loginPage.toastWithText('Incorrect username or password.')).toBeVisible();
    // Then pin the wording exactly — `toHaveText` is exact where the `hasText`
    // filter above is a substring match, so this also proves nothing extra was
    // appended to the message.
    await expect(loginPage.toastMessage).toHaveText('Incorrect username or password.');
    await expect(page).toHaveURL(/\/beta\/login/);

    await loginPage.dismissToast();
    await expect(loginPage.toast).toBeHidden();
  });

  test('should toggle password visibility', async () => {
    await loginPage.fillPassword('Test@gmail.com');
    
    // Show password
    await loginPage.togglePasswordVisibility(true);
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'text'); 
    
    // Hide password
    await loginPage.togglePasswordVisibility(false);
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password'); 
  });

  test('should accept valid credentials and match aria snapshot', async ({ page }) => {
    await loginPage.fillEmail('ankit.ambale@paymentoptions.com');
    await loginPage.fillPassword('Test12345678@#');
    await loginPage.togglePasswordVisibility(true); 
    
    // Verifying UI layout matches expectations just before submit
    await expect(page.locator('#root')).toMatchAriaSnapshot(`
      - button "English (UK)"
      - paragraph: Sign in to Payment Options
      - textbox "Email Address": ankit.ambale@paymentoptions.com
      - textbox "Password": Test12345678@#
      - button "Hide password"
      - button "Sign in"
      - link "Forgot Password?":
        - /url: /beta/forgot-password
      - link "Create an Account":
        - /url: /beta/choose-account-type
    `);
    
    await loginPage.submitLogin();
  });
});