import { useEffect, useState } from "react";
import claimsService from "../../services/claimsService";

/**
 * Claim number, policy holder and policy number for the header of the claim workflow pages (settlement, adjuster
 * submission, approval). The pages used to read them only from the Redux state left by the claim details screen, so
 * opened any other way (notification, link, refresh) the header said "Loading..." for ever; this loads the claim.
 * @param {string} claimId claim id or claim number from the route
 * @returns {{ claimNumber: string, policyHolderName: string, policyNumber: string, loaded: boolean }}
 */
const useClaimHeader = (claimId) => {
  const [header, setHeader] = useState({ claimNumber: "", policyHolderName: "", policyNumber: "", loaded: false });

  useEffect(() => {
    if (!claimId) return undefined;
    let active = true;
    claimsService.getClaimDetails(claimId).then((result) => {
      if (!active || !result?.success) return;
      const claim = result.data?.data || result.data || {};
      setHeader({
        claimNumber: claim.claimNumber || claim.claimRefId || "",
        policyHolderName: claim.policyHolderName || claim.clientName || claim.customerName || "",
        policyNumber: claim.policyNumber || claim.policy?.policyNumber || "",
        loaded: true,
      });
    });
    return () => {
      active = false;
    };
  }, [claimId]);

  return header;
};

export default useClaimHeader;
