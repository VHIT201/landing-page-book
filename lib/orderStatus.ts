import type { OrderStatus } from "./db/schema";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Chờ thanh toán",
  paid: "Đã thanh toán",
  preparing: "Đang đóng gói",
  shipping: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã huỷ",
  refunded: "Hoàn tiền",
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  pending_payment: "bg-amber-100 text-amber-800",
  paid: "bg-blue-100 text-blue-800",
  preparing: "bg-indigo-100 text-indigo-800",
  shipping: "bg-violet-100 text-violet-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-neutral-200 text-neutral-600",
  refunded: "bg-rose-100 text-rose-800",
};

// tiến trình chính (không gồm cancelled/refunded)
export const STATUS_FLOW: OrderStatus[] = [
  "pending_payment",
  "paid",
  "preparing",
  "shipping",
  "delivered",
];
