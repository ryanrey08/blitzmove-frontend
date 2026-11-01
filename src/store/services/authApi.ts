import { baseApi } from "@/store/services/api";
import { userUpdated } from "@/store/slices/authSlice";
import type { Resource, User } from "@/types/api";

export interface ProfileInput {
  name: string;
  email: string;
  job_title?: string | null;
  phone?: string | null;
}

export interface PasswordInput {
  current_password: string;
  password: string;
  password_confirmation: string;
}

/** Account endpoints of the signed-in user (PUT /auth/profile, PUT /auth/password). */
export const authApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    updateProfile: build.mutation<Resource<User>, ProfileInput>({
      query: (body) => ({ url: "auth/profile", method: "PUT", body }),
      // The API answers with the updated user, so the session state is patched without a refetch.
      async onQueryStarted(_input, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled.catch(() => ({ data: null }));
        if (data) dispatch(userUpdated(data.data));
      },
    }),
    updatePassword: build.mutation<{ message: string }, PasswordInput>({
      query: (body) => ({ url: "auth/password", method: "PUT", body }),
    }),
  }),
});

export const { useUpdateProfileMutation, useUpdatePasswordMutation } = authApi;
