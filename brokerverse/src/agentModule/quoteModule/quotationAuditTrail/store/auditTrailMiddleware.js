import quotationService from "../../../../services/quotationService";
import {
  GET_QUOTATION_AUDIT_TRAIL_REQUEST,
  GET_QUOTATION_AUDIT_TRAIL_SUCCESS,
  GET_QUOTATION_AUDIT_TRAIL_FAILURE,
  GET_QUOTATION_DETAILS_REQUEST,
  GET_QUOTATION_DETAILS_SUCCESS,
  GET_QUOTATION_DETAILS_FAILURE,
} from "./auditTrailActionTypes";

// Get audit trail for a specific quotation
export const getQuotationAuditTrail = (quotationId, sortOrder = "desc") => {
  return async (dispatch) => {
    dispatch({ type: GET_QUOTATION_AUDIT_TRAIL_REQUEST });

    try {
      const result = await quotationService.getQuotationAuditTrail(
        quotationId,
        sortOrder
      );

      if (result.success) {
        console.log("Audit trail data received:", result.data);
        dispatch({
          type: GET_QUOTATION_AUDIT_TRAIL_SUCCESS,
          payload: result.data.data || result.data || [],
        });

        // Also fetch quotation details for header
        dispatch(getQuotationDetails(quotationId));
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error fetching audit trail:", error);
      dispatch({
        type: GET_QUOTATION_AUDIT_TRAIL_FAILURE,
        payload: error.message,
      });
    }
  };
};

// Get quotation details for header
export const getQuotationDetails = (quotationId) => {
  return async (dispatch) => {
    dispatch({ type: GET_QUOTATION_DETAILS_REQUEST });

    try {
      const result = await quotationService.getQuotationById(quotationId);

      if (result.success) {
        console.log("Quotation details received:", result.data);
        dispatch({
          type: GET_QUOTATION_DETAILS_SUCCESS,
          payload: result.data.data || result.data || {},
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error fetching quotation details:", error);
      dispatch({
        type: GET_QUOTATION_DETAILS_FAILURE,
        payload: error.message,
      });
    }
  };
};
