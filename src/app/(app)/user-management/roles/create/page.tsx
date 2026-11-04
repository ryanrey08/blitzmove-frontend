import type { Metadata } from "next";
import { RoleEditor } from "@/features/roles/role-editor";

export const metadata: Metadata = { title: "Add Role" };

export default function Page() {
  return <RoleEditor />;
}
