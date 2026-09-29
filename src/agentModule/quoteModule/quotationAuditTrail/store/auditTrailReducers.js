import {
  GET_QUOTATION_AUDIT_TRAIL_REQUEST,
  GET_QUOTATION_AUDIT_TRAIL_SUCCESS,
  GET_QUOTATION_AUDIT_TRAIL_FAILURE,
  GET_QUOTATION_DETAILS_REQUEST,
  GET_QUOTATION_DETAILS_SUCCESS,
  GET_QUOTATION_DETAILS_FAILURE,
} from "./auditTrailActionTypes";

const initialState = {
  auditTrailData: [],
  quotationDetails: {},
  loading: false,
  error: null,
};

const quotationAuditTrailReducers = (state = initialState, action) => {
  switch (action.type) {
    case GET_QUOTATION_AUDIT_TRAIL_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case GET_QUOTATION_AUDIT_TRAIL_SUCCESS:
      return {
        ...state,
        loading: false,
        auditTrailData: action.payload,
        error: null,
      };

    case GET_QUOTATION_AUDIT_TRAIL_FAILURE:
      return {
        ...state,
        loading: false,
        auditTrailData: [],
        error: action.payload,
      };

    case GET_QUOTATION_DETAILS_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case GET_QUOTATION_DETAILS_SUCCESS:
      return {
        ...state,
        loading: false,
        quotationDetails: action.payload,
        error: null,
      };

    case GET_QUOTATION_DETAILS_FAILURE:
      return {
        ...state,
        loading: false,
        quotationDetails: {},
        error: action.payload,
      };

    default:
      return state;
  }
};

export default quotationAuditTrailReducers;
