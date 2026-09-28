import {
  GET_EXPIRINGTABLE_DATA,
  GET_EXPIRING_SEARCH,
} from "../../../../../redux/actionTypes";
import { openItemsThunk } from "../../../store/openItemRows";

export const getexpiringtableMiddleware = openItemsThunk(GET_EXPIRINGTABLE_DATA, "expiring");
export const getExpiringSearchDataMiddleWare = openItemsThunk(GET_EXPIRING_SEARCH, "expiring");
