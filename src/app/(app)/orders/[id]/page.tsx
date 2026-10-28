import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetail } from "@/features/orders/order-detail";

export const metadata: Metadata = { title: "Order details" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <OrderDetail id={id} />;
}
