import claimsService from "../../../../services/claimsService";
import {
  GET_AUDIT_TRAIL_REQUEST,
  GET_AUDIT_TRAIL_SUCCESS,
  GET_AUDIT_TRAIL_FAILURE,
  GET_CLAIM_DETAILS_REQUEST,
  GET_CLAIM_DETAILS_SUCCESS,
  GET_CLAIM_DETAILS_FAILURE,
} from "./auditTrailActionTypes";
import logger from "../../../../utility/logger";

// Get audit trail for a specific claim
export const getClaimAuditTrail = (claimId, sortOrder = "desc") => {
  return async (dispatch) => {
    dispatch({ type: GET_AUDIT_TRAIL_REQUEST });

    try {
      const result = await claimsService.getClaimAuditTrail(claimId, sortOrder);

      if (result.success) {
        // Handle nested response structure: backend returns { success: true, data: [...], total, sort }
        // Frontend service wraps it: { success: true, data: { success: true, data: [...], total, sort } }
        // Extract the array from result.data.data or fallback to result.data if it's already an array
        const auditTrailData = Array.isArray(result.data?.data)
          ? result.data.data
          : Array.isArray(result.data)
          ? result.data
          : [];
        dispatch({
          type: GET_AUDIT_TRAIL_SUCCESS,
          payload: auditTrailData,
        });

        // Also fetch claim details for header
        dispatch(getClaimDetails(claimId));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error("Error fetching audit trail:", error);
      dispatch({
        type: GET_AUDIT_TRAIL_FAILURE,
        payload: error.message,
      });
    }
  };
};

// Get claim details for header
export const getClaimDetails = (claimId) => {
  return async (dispatch) => {
    dispatch({ type: GET_CLAIM_DETAILS_REQUEST });

    try {
      const result = await claimsService.getClaimDetails(claimId);

      if (result.success) {
        dispatch({
          type: GET_CLAIM_DETAILS_SUCCESS,
          payload: result.data.data || result.data || {},
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      logger.error("Error fetching claim details:", error);
      dispatch({
        type: GET_CLAIM_DETAILS_FAILURE,
        payload: error.message,
      });
    }
  };
};
