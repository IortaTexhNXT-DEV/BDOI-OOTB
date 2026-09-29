import "./utility/sessionRefresh";
import { startTableNumericAlign } from "./utility/tableNumericAlign";
import "primeflex/primeflex.css"; // layout utilities, bundled first to keep the cascade order
import "./i18n";
import ReactDOM from "react-dom/client";
import "./index.scss";
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

const Root = () => {
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

startTableNumericAlign();
