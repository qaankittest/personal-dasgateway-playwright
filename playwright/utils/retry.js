/**
 * @typedef {object} RetryOpts
 * @property {number} [attempts]
 * @property {number} [delayMs]
 * @property {string} [label]
 */

/**
 * @param {() => Promise<any>} fn
 * @param {RetryOpts} [opts]
 */
export async function retry(fn, opts = {}) {
  const { attempts = 3, delayMs = 500, label = 'operation' } = opts;
  let lastErr;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts) await new Promise((r) => setTimeout(r, delayMs * i));
    }
  }
  throw new Error(
    `Retry failed [${label}] after ${attempts} attempts: ${lastErr?.message ?? lastErr}`
  );
}
