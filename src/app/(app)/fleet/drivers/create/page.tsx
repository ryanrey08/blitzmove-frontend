import type { Metadata } from "next";
import { DriverEditor } from "@/features/drivers/driver-editor";

export const metadata: Metadata = { title: "Add Driver" };

export default function Page() {
  return <DriverEditor />;
}
