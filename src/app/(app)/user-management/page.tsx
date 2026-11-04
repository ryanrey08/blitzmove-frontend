import { redirect } from "next/navigation";

export default function UserManagementIndex() {
  redirect("/user-management/users");
}
