import { redirect } from "next/navigation";

/** The day planner is the Route Optimization page itself; keep old links working. */
export default function Page() {
  redirect("/transportation/route-optimization");
}
