export const log = {
  info: (msg, meta) => console.log(`[E2E] ${msg}${meta ? ` ${JSON.stringify(meta)}` : ''}`),
  warn: (msg, meta) => console.warn(`[E2E][WARN] ${msg}${meta ? ` ${JSON.stringify(meta)}` : ''}`),
  fail: (msg, meta) => console.error(`[E2E][FAIL] ${msg}${meta ? ` ${JSON.stringify(meta)}` : ''}`),
};
