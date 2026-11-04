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

const SUPER_ADMIN = "super-admin";

/**
 * Permission helpers built from the signed-in user's role (`module.action` slugs from
 * GET auth/me). They only shape the UI; the API checks every request itself.
 */
export const selectPermissions = createSelector([selectCurrentUser], (user) => {
  const granted = new Set(user?.permissions ?? []);
  const superAdmin = user?.role?.slug === SUPER_ADMIN && !!user.role.is_active;
  const hasPermission = (permission: string) => superAdmin || granted.has(permission);
  /** True when the user holds any of the given permissions (a single slug or a list). */
  const can = (permission: string | readonly string[]) =>
    typeof permission === "string" ? hasPermission(permission) : permission.some(hasPermission);
  const hasRole = (slug: string) => user?.role?.slug === slug;
  return { can, hasPermission, hasRole, isSuperAdmin: superAdmin, permissions: [...granted] };
});
