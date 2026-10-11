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
