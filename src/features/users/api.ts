import { api } from "@/services/api-client";
import type { ListParams, ManagedUser, Paginated, PermissionModule, Resource, Role, UserOptions, UserStatus } from "@/types/api";

type Payload = Record<string, unknown>;

export const USERS_PATH = "/user-management/users";
export const ROLES_PATH = "/user-management/roles";

/** Query keys that change when users or roles change. */
export const USER_KEYS = [["admin-users"], ["admin-user"], ["admin-user-options"], ["admin-roles"], ["admin-role"]];

/** User Management API (/admin/users). */
export const usersService = {
  list: (params: ListParams = {}) => api.get<Paginated<ManagedUser> & { counts: Partial<Record<UserStatus, number>> }>("admin/users", params),
  get: (id: number) => api.get<Resource<ManagedUser> & { permissions: PermissionModule[] }>(`admin/users/${id}`),
  options: (userId?: number) => api.get<{ data: UserOptions }>("admin/users/options", userId ? { user_id: userId } : undefined),
  create: (data: Payload) => api.post<Resource<ManagedUser>>("admin/users", data),
  update: (id: number, data: Payload) => api.put<Resource<ManagedUser>>(`admin/users/${id}`, data),
  setStatus: (id: number, status: UserStatus) => api.patch<Resource<ManagedUser>>(`admin/users/${id}/status`, { status }),
  resetPassword: (id: number, data: { mode: "link" | "set"; password?: string; password_confirmation?: string }) =>
    api.post<{ message: string }>(`admin/users/${id}/reset-password`, data),
  remove: (id: number) => api.delete<{ message: string }>(`admin/users/${id}`),
};

/** Role Management API (/admin/roles, /admin/permissions). */
export const rolesService = {
  list: (params: ListParams = {}) => api.get<Paginated<Role>>("admin/roles", params),
  get: (id: number) => api.get<Resource<Role> & { users: ManagedUser[] }>(`admin/roles/${id}`),
  create: (data: Payload) => api.post<Resource<Role>>("admin/roles", data),
  update: (id: number, data: Payload) => api.put<Resource<Role>>(`admin/roles/${id}`, data),
  savePermissions: (id: number, permissions: string[]) => api.put<Resource<Role>>(`admin/roles/${id}/permissions`, { permissions }),
  remove: (id: number, reassignRoleId?: number) =>
    api.delete<{ message: string }>(`admin/roles/${id}${reassignRoleId ? `?reassign_role_id=${reassignRoleId}` : ""}`),
  permissions: () => api.get<{ data: PermissionModule[] }>("admin/permissions"),
};

export const USER_STATUS: Record<UserStatus, { label: string; tone: "green" | "gray" | "red" }> = {
  active: { label: "Active", tone: "green" },
  inactive: { label: "Inactive", tone: "gray" },
  suspended: { label: "Suspended", tone: "red" },
};
