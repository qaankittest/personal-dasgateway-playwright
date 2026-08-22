// Test data for the forgot-password module — pure values, no network, no `page`.
//
// The validation strings are the app's **verbatim** wording, captured from the
// live dev app on 2026-08-22. They are pinned here rather than inlined in each
// spec so a copy change is a one-line edit, and so every spec asserts the same
// text. `Forgot_Password_Functional_Test_Cases.pdf` Open Point #1 asks the dev
// team to lock this wording — when it is confirmed, update this file.
import { uniqueEmail } from './uniq.js';

/** Exact validation copy rendered by the two forgot-password forms. */
export const FORGOT_PASSWORD_MESSAGES = {
  emailRequired: 'Email is required',
  emailInvalid: 'Invalid email',
  passwordRequired: 'Password is required',
  passwordTooShort: 'Password is too short - should be 14 characters minimum.',
  passwordComplexity:
    'Your password must include at least one number, one special character, one uppercase letter, and one lowercase letter.',
  passwordsMustMatch: 'Passwords must match',
  invalidOtp: 'Invalid OTP provided.',
};

/** The app's own password policy, as enforced by the reset form. */
export const PASSWORD_POLICY = { minLength: 14 };

/** TC_FP_004's invalid-format table. `abhilash@` and `abc 123@test.com` extend
 *  the PDF's list with the two shapes it implies (missing domain, embedded
 *  space). `abhilash@abhilash.com` from the PDF is omitted deliberately — it is
 *  a well-formed address, so the app accepts it and it belongs to TC_FP_007. */
export const INVALID_EMAILS = [
  'abhilash@test',
  'test@@test.com',
  'abc 123@test.com',
  'abhilash@',
  '@test.com',
  'plainstring',
];

/** Six digits that are valid in shape but will not match any issued code, so
 *  the reset always fails at `forgotPasswordVerify`. */
export const RANDOM_OTP = '123456';

/** A password that satisfies every rule the reset form enforces. */
export const VALID_PASSWORD = 'Abhilash@Test1234';

/** A second valid password, used to prove the mismatch rule. */
export const MISMATCHED_PASSWORD = 'Abhilash@Test5678';

/** 14+ chars but no uppercase, digit or symbol — length passes, complexity fails. */
export const WEAK_COMPLEXITY_PASSWORD = 'sdfghjhgfdfggh';

/** Meets complexity but is 8 chars — complexity passes, length fails. */
export const SHORT_PASSWORD = 'Abc@1234';

/**
 * A fresh, well-formed address for the happy-path request.
 *
 * Unique per call via `data/uniq.js`, on `mailinator.com` so a run never
 * repeatedly mails one real inbox. The endpoint answers 200 for registered and
 * unregistered addresses alike (a deliberate account-enumeration defence), so
 * the OTP step is reachable without seeding an account.
 *
 * @param {string} [domain]
 */
export function forgotPasswordEmail(domain = 'mailinator.com') {
  return uniqueEmail('po-e2e-fp', domain);
}
