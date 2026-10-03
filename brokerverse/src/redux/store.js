import { configureStore, combineReducers } from "@reduxjs/toolkit";
import mainReducers from "./mainReducer";
import agentReducers from "./AgentReducer";
import logger from 'redux-logger';

const resetStoreActionType = "main/resetStore";

const rootReducer = combineReducers({
    ...mainReducers,
    ...agentReducers,
});

const resettableRootReducer = (state, action) => {
    if (action.type === resetStoreActionType) {
        state = undefined;
    }
    return rootReducer(state, action);
};

const store = configureStore({
    reducer: resettableRootReducer,
    middleware: (getDefaultMiddleware) => process.env.NODE_ENV === 'development' ? getDefaultMiddleware().concat(logger) : getDefaultMiddleware(),
});

export const resetStore = () => {
    store.dispatch({ type: resetStoreActionType });
};

export default store;
