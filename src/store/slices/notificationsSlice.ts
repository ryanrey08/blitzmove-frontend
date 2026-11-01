import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type ToastTone = "success" | "error";

export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

/** Toast messages shown in the corner of every page. */
export const notificationsSlice = createSlice({
  name: "notifications",
  initialState: [] as Toast[],
  reducers: {
    toastAdded: {
      reducer(state, action: PayloadAction<Toast>) {
        state.push(action.payload);
      },
      prepare(message: string, tone: ToastTone = "success") {
        return { payload: { id: Date.now() + Math.random(), message, tone } };
      },
    },
    toastDismissed(state, action: PayloadAction<number>) {
      return state.filter((toast) => toast.id !== action.payload);
    },
  },
  selectors: {
    selectToasts: (state) => state,
  },
});

export const { toastAdded, toastDismissed } = notificationsSlice.actions;
export const { selectToasts } = notificationsSlice.selectors;
