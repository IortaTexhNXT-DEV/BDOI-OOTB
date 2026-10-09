import React, { useId } from "react";
import PropTypes from "prop-types";
import { Tooltip } from "primereact/tooltip";
import "./index.scss";

/**
 * A small information icon next to a page title with the page's explanation as its tooltip, in place of a paragraph
 * under the title: the screen opens on its figures and work, the explanation is there on hover or focus.
 */
const InfoTip = ({ text, className = "" }) => {
  const id = `bv-info-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  if (!text) return null;
  return (
    <>
      <Tooltip target={`#${id}`} position="bottom" showDelay={150} style={{ maxWidth: "28rem" }} />
      <i id={id} className={`pi pi-info-circle bv-info-tip ${className}`} data-pr-tooltip={text} tabIndex={0} role="img" aria-label={text} />
    </>
  );
};

InfoTip.propTypes = { text: PropTypes.node, className: PropTypes.string };

export default InfoTip;
