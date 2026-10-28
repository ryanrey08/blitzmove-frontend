import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersView } from "@/features/orders/orders-view";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <Suspense>
      <OrdersView />
    </Suspense>
  );
}
