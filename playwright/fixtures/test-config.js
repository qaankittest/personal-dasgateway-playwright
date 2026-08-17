import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Single source of truth for the target environment. Change it here (or set
// BASE_URL in .env) and the Playwright baseURL + every route follow, including
// any path prefix the app is deployed under (e.g. /beta).
export const BASE_URL = (process.env.BASE_URL ?? 'https://dev.paymentoptions.com/beta').replace(
  /\/+$/,
  '',
);

const BASE_PATH = new URL(BASE_URL).pathname.replace(/\/$/, '');
const route = (p) => `${BASE_PATH}${p}`;

export const TEST_CONFIG = {
  credentials: {
    username: process.env.TEST_USERNAME ?? '',
    password: process.env.TEST_PASSWORD ?? '',
  },
  // Existing onboarded THIRDPARTY (reseller) login — used by the partner
  // suite that signs in and creates a referral-merchant application from
  // Sales Lead. Distinct from `credentials` because the partner is a real,
  // pre-onboarded reseller, not a GUEST being signed up by the test.
  partnerCredentials: {
    username: process.env.TEST_PARTNER_USERNAME ?? '',
    password: process.env.TEST_PARTNER_PASSWORD ?? '',
  },
  routes: {
    login: route('/login'),
    transactions: route('/transactions'),
    transactionDetails: (refId) => route(`/transactions/${refId}`),
    merchants: route('/accounts/merchants'),
    merchantDetails: (merchantId) => route(`/accounts/merchants/merchant-details/${merchantId}`),
    chooseAccountType: route('/choose-account-type'),
    signUp: route('/onboarding/sign-up'),
    onboarding: route('/onboarding'),
    salesLead: route('/onboarding/applications'),
    onboardingDetails: (applicationId) => route(`/onboarding/details/${applicationId}`),
    products: route('/products'),
    paybylink: (dasmid) => route(`/products/paybylink/${dasmid}`),
    subscription: (dasmid) => route(`/products/subscription/${dasmid}`),
    statements: route('/finance/statements'),
    statementDetail: (statementId) => route(`/finance/statements/${statementId}`),
    hashCard: route('/hashcard'),
  },
  // GUEST sign-up: the dev backend accepts a fixed verification OTP, and each
  // run registers a fresh GUEST under a unique email so it never collides.
  otp: process.env.TEST_OTP ?? '1234',
  guestEmailDomain: process.env.TEST_GUEST_EMAIL_DOMAIN ?? 'example.com',
  transactionCount: Number(process.env.TRANSACTION_COUNT ?? 20),
  merchantCount: Number(process.env.MERCHANT_COUNT ?? 10),
  statementCount: Number(process.env.STATEMENT_COUNT ?? 20),
  scroll: {
    maxAttempts: 80,
    stepPx: 800,
    settleMs: 250,
    idleAttemptsBeforeStop: 4,
  },
};

/** @typedef {'refund' | 'capture' | 'void' | 'dispute' | 'editStatus'} ActionButton */

/** @type {Record<ActionButton, RegExp>} */
export const ACTION_LABELS = {
  refund: /^refund$/i,
  capture: /^capture$/i,
  void: /^void$/i,
  dispute: /^dispute$/i,
  editStatus: /^edit\s*status$/i,
};
