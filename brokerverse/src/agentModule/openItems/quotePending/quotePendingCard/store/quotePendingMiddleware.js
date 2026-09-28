import {
  GET_QUOTEPENDINGTABLE_DATA,
  GET_QUOTEPENDING_SEARCH,
} from "../../../../../redux/actionTypes";
import { openItemsThunk } from "../../../store/openItemRows";

export const getquotependingtableMiddleware = openItemsThunk(GET_QUOTEPENDINGTABLE_DATA, "quote");
export const getQuotependingSearchDataMiddleWare = openItemsThunk(GET_QUOTEPENDING_SEARCH, "quote");
