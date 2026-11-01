import { combineSlices, configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { baseApi } from "@/store/services/api";
import { authSlice } from "@/store/slices/authSlice";
import { notificationsSlice } from "@/store/slices/notificationsSlice";
import { uiSlice } from "@/store/slices/uiSlice";

const rootReducer = combineSlices(authSlice, uiSlice, notificationsSlice, baseApi);

/**
 * One store per browser tab, created by StoreProvider. A factory (rather than a
 * module singleton) keeps server renders from sharing state between requests.
 */
export function makeStore() {
  const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefault) => getDefault().concat(baseApi.middleware),
  });
  setupListeners(store.dispatch);
  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = AppStore["dispatch"];
