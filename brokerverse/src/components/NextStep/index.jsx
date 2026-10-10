import React from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";
import { Button } from "primereact/button";
import "./index.scss";

/**
 * The step that follows in a transaction, shown where a screen would otherwise leave the user without guidance (a
 * policy booked: collect the premium; a receipt posted: remit to the insurer). Each action is a link to the screen
 * of that step, with the record it starts from in `to` (path and query) and optional router `state`.
 */
const NextStep = ({ title, text, actions = [], className = "" }) => {
  const navigate = useNavigate();
  if (!actions.length && !text) return null;
  return (
    <div className={`bv-next-step ${className}`} role="note">
      <i className="pi pi-directions bv-next-step__icon" aria-hidden="true" />
      <div className="bv-next-step__body">
        <span className="bv-next-step__title">{title}</span>
        {text && <span className="bv-next-step__text">{text}</span>}
      </div>
      <div className="bv-next-step__actions">
        {actions.map((a, i) => (
          <Button key={a.key || a.label} label={a.label} icon={a.icon || "pi pi-arrow-right"} iconPos="right" size="small" outlined={i > 0}
            onClick={() => (a.onClick ? a.onClick() : navigate(a.to, a.state ? { state: a.state } : undefined))} />
        ))}
      </div>
    </div>
  );
};

NextStep.propTypes = {
  title: PropTypes.node.isRequired,
  text: PropTypes.node,
  actions: PropTypes.arrayOf(PropTypes.shape({
    key: PropTypes.string,
    label: PropTypes.string.isRequired,
    to: PropTypes.string,
    state: PropTypes.object,
    icon: PropTypes.string,
    onClick: PropTypes.func,
  })),
  className: PropTypes.string,
};

export default NextStep;
