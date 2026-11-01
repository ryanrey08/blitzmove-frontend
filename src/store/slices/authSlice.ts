import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { User } from "@/types/api";

/**
 * The signed-in user as validated by the server layout (GET auth/me). The session
 * token itself stays in the httpOnly cookie and never reaches the browser.
 */
interface AuthState {
  user: User | null;
  signingOut: boolean;
}

const initialState: AuthState = { user: null, signingOut: false };

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionLoaded(state, action: PayloadAction<User>) {
      state.user = action.payload;
      state.signingOut = false;
    },
    userUpdated(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    signOutStarted(state) {
      state.signingOut = true;
    },
    signOutFailed(state) {
      state.signingOut = false;
    },
    signedOut() {
      return initialState;
    },
  },
  selectors: {
    selectCurrentUser: (state) => state.user,
    selectSigningOut: (state) => state.signingOut,
  },
});

export const { sessionLoaded, userUpdated, signOutStarted, signOutFailed, signedOut } = authSlice.actions;
export const { selectCurrentUser, selectSigningOut } = authSlice.selectors;

/** Mirrors the API gates: manage-operations and manage-fleet. */
export const selectPermissions = createSelector([selectCurrentUser], (user) => ({
  canOperate: !!user?.permissions.manage_operations,
  canManageFleet: !!user?.permissions.manage_fleet,
}));
