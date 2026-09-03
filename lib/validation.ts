import { z } from "zod";
import { ORDER_STATUSES, type OrderStatus } from "./db/schema";

const statusEnum = z.enum(
  [...ORDER_STATUSES] as [OrderStatus, ...OrderStatus[]],
);

// SĐT VN: 10 số bắt đầu 0, hoặc +84...
const phoneRe = /^(0\d{9}|\+84\d{9})$/;

const nameCode = (max: number) =>
  z.object({
    code: z.string().trim().min(1).max(20),
    name: z.string().trim().min(1).max(max),
  });

export const createOrderSchema = z.object({
  name: z.string().trim().min(2, "Tên quá ngắn").max(120),
  phone: z
    .string()
    .trim()
    .transform((s) => s.replace(/[\s.\-()]/g, ""))
    .pipe(z.string().regex(phoneRe, "Số điện thoại không hợp lệ")),
  quantity: z.coerce.number().int().min(1).max(20),

  province: nameCode(80),
  district: nameCode(80),
  ward: nameCode(80),
  addressDetail: z
    .string()
    .trim()
    .min(3, "Nhập số nhà, tên đường")
    .max(200),

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

export const lookupSchema = z.object({
  phone: z.string().trim().regex(/^\d{4}$/, "Nhập 4 số cuối điện thoại"),
});
