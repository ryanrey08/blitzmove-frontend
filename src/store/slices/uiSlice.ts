import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/** App-shell layout state shared by the shell, sidebar and topbar. */
interface UiState {
  /** Desktop sidebar hidden; remembered per browser in localStorage by the shell. */
  sidebarCollapsed: boolean;
  /** Mobile navigation drawer open. */
  mobileNavOpen: boolean;
}

const initialState: UiState = { sidebarCollapsed: false, mobileNavOpen: false };

export const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    sidebarCollapsedSet(state, action: PayloadAction<boolean>) {
      state.sidebarCollapsed = action.payload;
    },
    mobileNavToggled(state) {
      state.mobileNavOpen = !state.mobileNavOpen;
    },
    mobileNavClosed(state) {
      state.mobileNavOpen = false;
    },
  },
  selectors: {
    selectSidebarCollapsed: (state) => state.sidebarCollapsed,
    selectMobileNavOpen: (state) => state.mobileNavOpen,
  },
});

export const { sidebarCollapsedSet, mobileNavToggled, mobileNavClosed } = uiSlice.actions;
export const { selectSidebarCollapsed, selectMobileNavOpen } = uiSlice.selectors;
