/**
 * Production builds must not write debugging output to the browser console: much of the legacy
 * code logs form values and API payloads. Warnings and errors are kept for support diagnostics.
 */
if (process.env.NODE_ENV === "production") {
  const noop = () => {};
  // eslint-disable-next-line no-console
  console.log = noop;
  // eslint-disable-next-line no-console
  console.info = noop;
  // eslint-disable-next-line no-console
  console.debug = noop;
}
