# BlitzMove Frontend

Next.js 15 (App Router) console for BlitzMove. See the root README for architecture and the full-stack setup.

```bash
npm install
cp .env.example .env.local   # API_URL=http://localhost:8000
npm run dev
npm run lint && npx tsc --noEmit && npm run build
```

The Laravel token lives in an httpOnly cookie. Browser code calls `/api/proxy/*` (`src/app/api/proxy`), which adds the Bearer header. Code layout: `src/app` (routes), `src/features` (screens per module), `src/components` (UI kit, layout, charts), `src/services` (API client), `src/hooks`.

Docker: `docker build -t blitzmove-frontend .` and run it with `API_URL` pointing at the API.

## State management (Redux Toolkit)

Two layers, each owning different data so nothing is stored twice:

| Kind of state | Where it lives |
| --- | --- |
| Shared client state: signed-in user, app-shell layout, toasts | Redux Toolkit store (`src/store`) |
| Server data fetched through RTK Query endpoints (today: account/profile) | RTK Query cache (`baseApi`, part of the same store) |
| Server data for the feature screens (orders, trips, fleet, reports…) | TanStack Query, as before (`src/services/resources.ts`, `src/features/*/api.ts`) |
| Form inputs, modals, filters, one-screen UI | Local component state / react-hook-form |

```
src/store/
├── index.ts               makeStore() with configureStore, RootState / AppDispatch types
├── hooks.ts               useAppDispatch, useAppSelector, useAppStore
├── provider.tsx           <StoreProvider>, mounted in src/components/providers.tsx (root layout)
├── slices/
│   ├── authSlice.ts       current user + signing-out flag; selectCurrentUser, selectPermissions
│   ├── uiSlice.ts         sidebar collapsed (desktop), mobile nav drawer open
│   └── notificationsSlice.ts  toast queue
└── services/
    ├── api.ts             baseApi (createApi) on top of src/services/api-client
    └── authApi.ts         updateProfile, updatePassword mutations
```

**Store.** `makeStore()` builds a store per browser tab (a factory, so server renders never share state). `StoreProvider` wraps the app above `QueryClientProvider`, so every page, including the auth pages, can use it.

**Auth.** The Laravel token stays in the httpOnly `bm_session` cookie and is never put in Redux or localStorage. The `(app)` server layout validates it with `GET /auth/me`; `AppShell` loads that user into `authSlice` before any page renders and keeps it in step after `router.refresh()`. `useCurrentUser()` / `usePermissions()` read from the slice (same API as before, the old React context is gone). Logging out (`useLogout`) calls `/api/auth/logout`; when the shell unmounts after a sign-out it clears the auth slice, the RTK Query cache and the TanStack Query cache, so no data from the previous user stays in memory. A 401 still does a full redirect to `/login?expired=1`.

**Toasts.** `useToast()` keeps its `notify(message, tone?)` signature; it dispatches `toastAdded` and removes the toast after 4.5 s. `<Toaster />` renders the queue.

### Using state in a component

```tsx
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { mobileNavClosed, selectSidebarCollapsed } from "@/store/slices/uiSlice";

const collapsed = useAppSelector(selectSidebarCollapsed); // re-renders only when this value changes
const dispatch = useAppDispatch();
dispatch(mobileNavClosed());
```

Select the smallest value you need; use `createSelector` for derived values (see `selectPermissions`) instead of storing them.

### Adding a slice

1. Create `src/store/slices/fooSlice.ts` with `createSlice({ name, initialState, reducers, selectors })` and export its actions and selectors.
2. Add it to `combineSlices(...)` in `src/store/index.ts`. `RootState` picks it up automatically.
3. Only add state that several components share. Keep it serializable (no class instances, Dates or functions).

### Adding an API endpoint (RTK Query)

`baseApi` sends requests through the existing api-client, so they go to `/api/proxy/*` with the session cookie, keep the 401 redirect, and fail with `{ status, message, errors }` (the API's message and Laravel field errors). URLs are paths relative to the API, never absolute.

```ts
// src/features/foo/fooApi.ts
import { baseApi } from "@/store/services/api";

export const fooApi = baseApi
  .enhanceEndpoints({ addTagTypes: ["Foo"] })
  .injectEndpoints({
    endpoints: (build) => ({
      getFoos: build.query<Paginated<Foo>, ListParams>({ query: (params) => ({ url: "foos", params }), providesTags: ["Foo"] }),
      createFoo: build.mutation<Resource<Foo>, Payload>({ query: (body) => ({ url: "foos", method: "POST", body }), invalidatesTags: ["Foo"] }),
    }),
  });
export const { useGetFoosQuery, useCreateFooMutation } = fooApi;
```

In a form, `await createFoo(values).unwrap()` throws that error object; `applyApiErrors` (src/features/shared.ts) maps it onto react-hook-form fields just like an `ApiError`. Only call endpoints that exist in blitzmove-backend (`routes/api.php`).

Moving a feature from TanStack Query to RTK Query: replace its `useQuery`/`useApiMutation` calls with injected endpoints, translate `invalidate: [["key"]]` into tags, and move the whole feature at once so the same data is never cached in both. File uploads with progress keep using `api.upload` directly.
