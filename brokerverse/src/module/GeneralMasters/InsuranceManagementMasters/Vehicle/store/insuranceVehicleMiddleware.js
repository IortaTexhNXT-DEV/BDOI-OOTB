import mastersService, { searchText } from "../../../../../services/mastersService";
import masterThunk from "../../../common/masterThunk";
import {
  GET_INSURANCE_VEHICLE_LIST,
  GET_INSURANCE_VEHICLE_SEARCH_LIST,
  PATCH_INSURANCE_VEHICLE_DATA,
  POST_INSURANCE_VEHICLE_DATA,
} from "../../../../../redux/actionTypes";

const TYPE = "vehicle";

export const getInsuranceVehicleMiddleWare = masterThunk(GET_INSURANCE_VEHICLE_LIST, (params) =>
  mastersService.list(TYPE, params));

export const postInsuranceVehicleMiddleWare = masterThunk(POST_INSURANCE_VEHICLE_DATA, (values) =>
  mastersService.create(TYPE, values));

export const patchInsuranceVehicleMiddleWare = masterThunk(PATCH_INSURANCE_VEHICLE_DATA, async (values) => {
  await mastersService.update(TYPE, values.id, values);
  return mastersService.list(TYPE);
});

export const getSearchInsuranceVehicleMiddleware = masterThunk(GET_INSURANCE_VEHICLE_SEARCH_LIST, (query) =>
  mastersService.list(TYPE, { search: searchText(query) }));
