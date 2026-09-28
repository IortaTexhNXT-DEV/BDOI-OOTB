import {
  GET_RENEWALREQUESTTABLE_DATA,
  GET_RENEWALREQUEST_SEARCH,
} from "../../../../../redux/actionTypes";
import { openItemsThunk } from "../../../store/openItemRows";

export const getrenewalrequesttableMiddleware = openItemsThunk(GET_RENEWALREQUESTTABLE_DATA, "renewal");
export const getrenewalrequestSearchDataMiddleWare = openItemsThunk(GET_RENEWALREQUEST_SEARCH, "renewal");
