import { z } from "zod";
import { ORDER_STATUSES, type OrderStatus } from "./db/schema";

const statusEnum = z.enum(
  [...ORDER_STATUSES] as [OrderStatus, ...OrderStatus[]],
);

// SĐT VN: 10 số bắt đầu 0, hoặc +84...
const phoneRe = /^(0\d{9}|\+84\d{9})$/;

export const createOrderSchema = z.object({
  name: z.string().trim().min(2, "Tên quá ngắn").max(120),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s.\-()]/g, ""))
    .pipe(z.string().regex(phoneRe, "Số điện thoại không hợp lệ")),
  address: z.string().trim().min(10, "Địa chỉ quá ngắn").max(400),
  quantity: z.coerce.number().int().min(1).max(20),
  source: z.string().trim().max(120).optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const updateOrderSchema = z.object({
  status: statusEnum.optional(),
  carrier: z.string().trim().max(80).nullish(),
  trackingNo: z.string().trim().max(120).nullish(),
  adminNote: z.string().trim().max(1000).nullish(),
});

export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
