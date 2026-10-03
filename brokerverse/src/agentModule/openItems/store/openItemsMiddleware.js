import { createAsyncThunk } from "@reduxjs/toolkit";
import moment from "moment";
import {
  GET_UPCOMMING_OPEN_ITEMS_LIST,
  POST_UPCOMMING_OPEN_ITEMS_LIST,
} from "../../../redux/agentActionTypes";
import paymentsService from "../../../services/paymentsService";

const errorMessage = (error) => error?.message || "Something went wrong";

const toEventRow = (event) => ({
  ...event,
  date: moment(event.date).format("DD/MM/YYYY"),
});

/** Open-item summary and items plus the signed-in user's upcoming events. */
export const getOpenItemsListMiddleware = createAsyncThunk(
  GET_UPCOMMING_OPEN_ITEMS_LIST,
  async (_a, { rejectWithValue }) => {
    try {
      const [openItems, events] = await Promise.all([
        paymentsService.getOpenItems(),
        paymentsService.getEvents(),
      ]);
      return {
        summary: openItems?.summary || [],
        items: openItems?.items || [],
        events: events.map(toEventRow),
      };
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);

export const postOpenItemsListMiddleware = createAsyncThunk(
  POST_UPCOMMING_OPEN_ITEMS_LIST,
  async (payload, { rejectWithValue }) => {
    try {
      const event = await paymentsService.addEvent({
        date: moment(payload?.date).format("YYYY-MM-DD"),
        notes: payload?.notes,
        startTime: payload?.startTime || undefined,
        endTime: payload?.endTime || undefined,
      });
      return toEventRow(event);
    } catch (error) {
      return rejectWithValue(errorMessage(error));
    }
  }
);
