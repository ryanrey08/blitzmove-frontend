import { redirect } from "next/navigation";

/** The live map is the GPS Tracking page itself; keep old links working. */
export default function Page() {
  redirect("/transportation/gps-tracking");
}
