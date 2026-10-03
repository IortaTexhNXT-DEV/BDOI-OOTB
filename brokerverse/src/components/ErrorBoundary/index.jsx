import React from "react";
import { Button } from "primereact/button";
import "./index.scss";
import logger from "../../utility/logger";

/**
 * Catches rendering errors in a screen so one faulty screen shows a clear message instead of a blank
 * page, and the rest of the application (menu, top bar) keeps working.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    logger.error("Screen error", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="bv-state" role="alert">
        <i className="pi pi-exclamation-triangle bv-state__icon" aria-hidden="true" />
        <h2>Something went wrong on this screen</h2>
        <p>The rest of the system is working. Reload the screen, or choose another one from the menu.</p>
        <Button label="Reload screen" icon="pi pi-refresh" onClick={() => window.location.reload()} />
      </div>
    );
  }
}

export default ErrorBoundary;
