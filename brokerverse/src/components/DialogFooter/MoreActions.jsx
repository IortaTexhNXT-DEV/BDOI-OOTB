import React from "react";
import PropTypes from "prop-types";
import RowActions from "../RowActions";

/** The "More actions" menu of a dialog footer: [{ label, onClick, disabled, tooltip }] as one kebab menu. */
const MoreActions = ({ label, actions }) => (
  <RowActions label={label} actions={actions.map((a, i) => ({ code: `a${i}`, label: a.label, allowed: !a.disabled, blockedReason: a.disabled ? a.tooltip : undefined }))}
    onAction={(a) => actions[Number(a.code.slice(1))].onClick?.()} />
);

MoreActions.propTypes = {
  label: PropTypes.string.isRequired,
  actions: PropTypes.arrayOf(PropTypes.shape({ label: PropTypes.string, onClick: PropTypes.func, disabled: PropTypes.bool, tooltip: PropTypes.string })).isRequired,
};

export default MoreActions;
