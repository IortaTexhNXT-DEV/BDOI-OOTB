import React from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate } from "react-router-dom";
import CreateProspectDialog from "../leadListing/CreateProspectDialog";
import useProspectStart, { prospectChosen } from "../leadListing/useProspectStart";

/**
 * A prospect form opened without the Create prospect choice (the side bar, a dashboard button, a link) first asks it:
 * new customer or existing client, then the line of business and product, or Skip - tag product later. The form of an
 * existing prospect, or of the product already chosen, opens at once.
 */
const NewProspectGate = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openProduct, skipProduct, productRequired } = useProspectStart();
  if (prospectChosen(location.state)) return children;
  return (
    <CreateProspectDialog
      visible
      onHide={() => navigate("/agent/leadlisting")}
      onProduct={(product, client) => openProduct(product, client, { replace: true })}
      onSkip={(client) => skipProduct(client, { replace: true })}
      productRequired={productRequired}
    />
  );
};

NewProspectGate.propTypes = {
  children: PropTypes.node.isRequired,
};

export default NewProspectGate;
