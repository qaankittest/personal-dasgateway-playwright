import { test, expect } from '@playwright/test';
import { LoginPage } from './LoginPage.js'; // Note: include .js extension if your node environment requires it

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

  test('should show validation error when email is omitted', async () => {
    // Fill password but leave email empty
    await loginPage.fillPassword('dfggfdsdfggfdfghgfddfg');
    await loginPage.submitLogin();
    
    await expect(loginPage.emailRequiredAlert).toContainText('Email is required');
  });

  test('should show error for incorrect credentials', async () => {
    await loginPage.fillEmail('ankit@gmail.com');
    await loginPage.fillPassword('dfggfdsdfggfdfghgfddfg');
    await loginPage.submitLogin();
    
    await expect(loginPage.loginStatusAlert).toContainText('Incorrect username or password.');
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