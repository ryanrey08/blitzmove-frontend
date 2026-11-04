import type { Metadata } from "next";
import { RolesView } from "@/features/roles/roles-view";

export const metadata: Metadata = { title: "Roles & Permissions" };

export default function RolesPage() {
  return <RolesView />;
}
