import "./utility/productionConsole";
import "./utility/sessionRefresh";
import "primeflex/primeflex.css"; // layout utilities (bundled first to keep the old cascade order; was loaded unpinned from unpkg)
import "./i18n";
import ReactDOM from "react-dom/client";
import "./index.scss";
import reportWebVitals from "./reportWebVitals";
import { BrowserRouter } from "react-router-dom";
import "@fontsource/nunito/400.css";
import "@fontsource/nunito/600.css";
import "@fontsource/nunito/700.css";
import "@fontsource/nunito/800.css";
import "./theme/bdoi/primereact-bdoi.css"; // BDOI theme (generated, see scripts/build-bdoi-theme.js)
import "primereact/resources/primereact.css"; // core css
import "primeicons/primeicons.css"; // icons
import { Provider } from "react-redux";
import store from "./redux/store";
import App from "./App";
// Last, so the BDOI shell, sign-in and component styles win over the component stylesheets.
import "./theme/bdoi/bdoi.scss";

// Lazy load your application component
// const LazyApp = lazy(() => import('./App'));

const Root = () => {
  // Render your application only after SCSS styles are loaded
  return (
    <BrowserRouter>
      <Provider store={store}>
        <App />
      </Provider>
    </BrowserRouter>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<Root />);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
