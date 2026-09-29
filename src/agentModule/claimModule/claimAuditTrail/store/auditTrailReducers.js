import {
  GET_AUDIT_TRAIL_REQUEST,
  GET_AUDIT_TRAIL_SUCCESS,
  GET_AUDIT_TRAIL_FAILURE,
  GET_CLAIM_DETAILS_REQUEST,
  GET_CLAIM_DETAILS_SUCCESS,
  GET_CLAIM_DETAILS_FAILURE,
} from "./auditTrailActionTypes";

const initialState = {
  auditTrailData: [],
  claimDetails: {},
  loading: false,
  error: null,
};

const auditTrailReducers = (state = initialState, action) => {
  switch (action.type) {
    case GET_AUDIT_TRAIL_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case GET_AUDIT_TRAIL_SUCCESS:
      return {
        ...state,
        loading: false,
        auditTrailData: action.payload,
        error: null,
      };

    case GET_AUDIT_TRAIL_FAILURE:
      return {
        ...state,
        loading: false,
        auditTrailData: [],
        error: action.payload,
      };

    case GET_CLAIM_DETAILS_REQUEST:
      return {
        ...state,
        loading: true,
        error: null,
      };

    case GET_CLAIM_DETAILS_SUCCESS:
      return {
        ...state,
        loading: false,
        claimDetails: action.payload,
        error: null,
      };

    case GET_CLAIM_DETAILS_FAILURE:
      return {
        ...state,
        loading: false,
        claimDetails: {},
        error: action.payload,
      };

    default:
      return state;
  }
};

export default auditTrailReducers;
