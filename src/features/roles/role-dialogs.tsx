"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormError, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useApiMutation } from "@/hooks/use-api-mutation";
import type { Role } from "@/types/api";
import { USER_KEYS, rolesService, usersService } from "../users/api";

/** Delete a custom role; users still holding it must be moved to another role first. */
export function DeleteRoleDialog({ role, onClose, onDeleted }: { role: Role | null; onClose: () => void; onDeleted?: () => void }) {
  const [target, setTarget] = useState("");
  const users = role?.users_count ?? 0;
  const options = useQuery({ queryKey: ["admin-user-options"], queryFn: () => usersService.options().then((r) => r.data), enabled: !!role && users > 0 });
  const remove = useApiMutation(() => rolesService.remove(role!.id, target ? Number(target) : undefined), {
    invalidate: USER_KEYS,
    onSuccess: () => {
      setTarget("");
      onClose();
      onDeleted?.();
    },
  });
  const close = () => {
    remove.reset();
    setTarget("");
    onClose();
  };

  return (
    <Modal
      open={!!role}
      onClose={close}
      title="Delete role"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={remove.isPending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => remove.mutate(undefined)} loading={remove.isPending} disabled={users > 0 && !target}>
            {users > 0 ? "Move users and delete" : "Delete role"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm text-ink-600">
        <FormError message={remove.error?.field("reassign_role_id") ?? remove.error?.field("role") ?? (remove.error && remove.error.status !== 422 ? remove.error.message : null)} />
        <p>
          Delete <strong>{role?.name}</strong>? This cannot be undone.
        </p>
        {users > 0 && (
          <Field label={`Move its ${users} user${users === 1 ? "" : "s"} to`} htmlFor="reassign-role" required hint="They get the new role's permissions right away.">
            <Select
              id="reassign-role"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Select a role"
              options={(options.data?.roles ?? []).filter((r) => r.id !== role?.id && r.assignable).map((r) => ({ value: String(r.id), label: r.name }))}
            />
          </Field>
        )}
      </div>
    </Modal>
  );
}
