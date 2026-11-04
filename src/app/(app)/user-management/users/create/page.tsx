import type { Metadata } from "next";
import { UserEditor } from "@/features/users/user-editor";

export const metadata: Metadata = { title: "Add User" };

export default function Page() {
  return <UserEditor />;
}
