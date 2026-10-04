import leadReducer from "../agentModule/leadModule/Store/leadReducer";
import paymentReducer from "../agentModule/paymentsModule/store/paymentReducer";
import policyDetailsReducer from "../agentModule/quoteModule/policyDetails/store/policyDetailsReducer";
import coverageDetailsReducer from "../agentModule/quoteModule/coverageDetails/store/coverageDetailsReducer";
import accessoriesReducer from "../agentModule/quoteModule/accessories/store/accessoriesReducer";
import orderSummaryReducer from "../agentModule/quoteModule/orderSummary/store/orderSummaryReducer";
import CustomerInfoReducer from "../agentModule/quoteModule/customerInfo/store/infoReducer";
import clientsReducers from "../agentModule/quoteModule/clientListing/store/clientsReducer";
import personalDetailsReducer from "../agentModule/endorsementModule/personalDetails/store/personalDetailsReducer";
import adjusterSubmissionReducers from "../agentModule/claimsModule/adjusterSubmission/store/adjusterSubmissionReducers";
import productConfiguratorReducer from "../module/ProductConfigurator/store/productConfiguratorSlice";

const agentReducers = {
  leadReducer,
  paymentReducer,
  policyDetailsReducer,
  coverageDetailsReducer,
  accessoriesReducer,
  orderSummaryReducer,
  clientsReducers,
  CustomerInfoReducer,
  personalDetailsReducer,
  adjusterSubmissionReducers,
  productConfiguratorReducer,
};
export default agentReducers;
