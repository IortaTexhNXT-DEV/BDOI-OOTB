// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Screen suites render whole pages (PrimeReact tables, dialogs, tabs). With one test file per core and other work on the
// machine a test takes several seconds and an answer more than a second to reach the screen, so the default limits
// (5 seconds a test, 1 second a wait) fail sound tests at random.
jest.setTimeout(20000);
configure({ asyncUtilTimeout: 5000 });

// PrimeReact writes its shared styles into the same <style> element on every component mount.
// jsdom re-parses the sheet each time and cannot parse its @layer block, so it also reports an
// error each time; on heavy screens that took several seconds per render. Skip identical
// rewrites, and drop the remaining parse reports while keeping every other console error.
const textContent = Object.getOwnPropertyDescriptor(Node.prototype, "textContent");
Object.defineProperty(HTMLStyleElement.prototype, "textContent", {
  configurable: true,
  get() { return textContent.get.call(this); },
  set(value) { if (textContent.get.call(this) !== value) textContent.set.call(this, value); },
});
const consoleError = console.error;
console.error = (first, ...rest) => {
  if (typeof first === "string" && first.startsWith("Error: Could not parse CSS stylesheet")) return;
  consoleError(first, ...rest);
};
