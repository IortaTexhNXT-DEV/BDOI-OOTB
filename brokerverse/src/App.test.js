import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { Provider } from "react-redux";
import "./i18n";
import store from "./redux/store";
import App from "./App";

// Signed out, the application opens on the sign-in screen (same wrappers as src/index.js).
test("renders the sign-in screen when signed out", async () => {
  window.localStorage.clear();
  global.fetch = jest.fn(() => Promise.resolve({ ok: false, status: 401, json: () => Promise.resolve({}) }));
  render(
    <BrowserRouter>
      <Provider store={store}>
        <App />
      </Provider>
    </BrowserRouter>
  );
  expect(await screen.findByText(/forgot password/i, {}, { timeout: 5000 })).toBeInTheDocument();
});
