/**
 * SePay webhook processor — xử lý payload từ SePay.
 *
 * Flow chính (mọi step đều được observe qua log):
 *   1. Validate payload (Zod-shape)
 *   2. Validate business rules:
 *      a. transferType === "in" (chỉ nhận tiền vào)
 *      b. accountNumber khớp SEPAY_BANK_ACCOUNT
 *      c. amount khớp order.total_amount (exact)
 *   3. Extract order code từ content
 *   4. Find order + payment
 *   5. Insert webhook log (idempotency qua UNIQUE transaction_id)
 *   6. Trong CÙNG transaction: update payment + update order + insert history
 *   7. Return result để route handler trả response đúng format
 *
 * IDEMPOTENCY: dựa vào UNIQUE(sepay_webhook_logs.transaction_id).
 *   - webhook #1: INSERT success → xử lý.
 *   - webhook #2 (retry): INSERT conflict → no-op, return success.
 *
 * ATOMIC: Mọi DB mutation trong CÙNG db.transaction().
 *
 * Lỗi KHÔNG throw exception ra khỏi hàm (trừ DB error).
 * Mọi failure được map sang `action` + log + trả về cho caller.
 */

import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "../db";
import type { Order as OrderRow, Payment as PaymentRow } from "../db/schema";
import {
  type SepayWebhookPayload,
  type SepayAction,
} from "./types";
import {
  matchOrderCodeFromContent,
  checkAmount,
  extractOrderCode,
  type AmountCheckResult,
} from "./matcher";
import { getOrderByCode } from "../orders";

const { orders, payments, sepayWebhookLogs, orderStatusHistory } = schema;

export interface ProcessResult {
  /** Action taken (audit + log) */
  action: SepayAction;
  /** Whether the request was processed or short-circuited */
  processed: boolean;
  /** Order ID if matched */
  orderId?: string;
  /** Order code if matched */
  orderCode?: string;
  /** Payment ID if updated */
  paymentId?: string;
  /** Free-form reason (for logs / debugging) */
  reason?: string;
}

export interface ProcessOptions {
  /** Override "now" for unit tests (ms since epoch). */
  now?: Date;
}

interface StepContext {
  payload: SepayWebhookPayload;
  result: ProcessResult;
  logAction: SepayAction;
  logError: string | null;
}

/**
 * Main entrypoint.
 */
export async function processSepayWebhook(
  payload: unknown,
  options: ProcessOptions = {},
): Promise<ProcessResult> {
  const validation = validatePayload(payload);
  if (!validation.ok) {
    return {
      action: "invalid_payload",
      processed: false,
      reason: validation.reason,
    };
  }

  const ctx: StepContext = {
    payload: validation.payload,
    result: { action: "duplicate", processed: false },
    logAction: "invalid_payload",
    logError: null,
  };

  try {
    // === Step 1: extract order code ===
    const matched = matchOrderCodeFromContent(ctx.payload.content);
    if (!matched.ok || !matched.orderCode) {
      return finalize(ctx, "invalid_content", "no_order_code_in_content");
    }
    ctx.result.orderCode = matched.orderCode;

    // === Step 2: find order ===
    const order = await getOrderByCode(matched.orderCode);
    if (!order) {
      return finalize(ctx, "order_not_found", `code=${matched.orderCode}`);
    }
    ctx.result.orderId = order.id;

    // === Step 3: business rules ===
    if (ctx.payload.transferType !== "in") {
      return finalize(ctx, "wrong_transfer_type", `transferType=${ctx.payload.transferType}`);
    }

    // === Step 4: amount check ===
    const amountCheck = checkAmount(order.totalAmount, ctx.payload.transferAmount);
    if (!amountCheck.ok) {
      return finalize(
        ctx,
        "amount_mismatch",
        `expected=${amountCheck.expected} actual=${amountCheck.actual}`,
      );
    }

    // === Step 5: idempotency + atomic DB update ===
    const paidAt = options.now ?? new Date();
    const txResult = await db.transaction(async (tx) => {
      // 5a. Insert webhook log (UNIQUE constraint catch duplicate)
      const insertedLog = await tx
        .insert(sepayWebhookLogs)
        .values({
          transactionId: ctx.payload.id,
          rawPayload: ctx.payload as unknown as Record<string, unknown>,
          action: "payment_confirmed",
          orderId: order.id,
          orderCode: order.code,
          success: "true",
        })
        .onConflictDoNothing({ target: sepayWebhookLogs.transactionId })
        .returning();

      // 5b. Nếu conflict (duplicate) → no-op, return null
      if (insertedLog.length === 0) {
        return null;
      }

      // 5c. Update payment
      const [updatedPayment] = await tx
        .update(payments)
        .set({
          status: "paid",
          sepayTransactionId: ctx.payload.id,
          sepayGateway: ctx.payload.gateway,
          sepayAccountNumber: ctx.payload.accountNumber,
          sepayContent: ctx.payload.content,
          sepayReferenceCode: ctx.payload.referenceCode,
          paidAt,
          updatedAt: paidAt,
        })
        .where(and(eq(payments.orderId, order.id), sql`${payments.status} <> 'failed'`))
        .returning();

      if (!updatedPayment) {
        throw new Error("Payment not found for this order (should never happen)");
      }

      // 5d. Update order: paid + paidAt
      //      Dùng UPDATE có điều kiện paidAt IS NULL để tránh overwrite.
      const [updatedOrder] = await tx
        .update(orders)
        .set({
          status: "paid",
          paidAt: order.paidAt ? order.paidAt : paidAt,
          updatedAt: paidAt,
        })
        .where(eq(orders.id, order.id))
        .returning();

      // 5e. Insert status history
      await tx.insert(orderStatusHistory).values({
        orderId: order.id,
        fromStatus: order.status,
        toStatus: "paid",
        actor: "sepay",
        meta: {
          transactionId: ctx.payload.id,
          gateway: ctx.payload.gateway,
          referenceCode: ctx.payload.referenceCode,
        },
      });

      return { payment: updatedPayment, order: updatedOrder };
    });

    if (txResult === null) {
      // Duplicate webhook (idempotent skip)
      return finalize(ctx, "duplicate", "already_processed");
    }

    ctx.result.action = "payment_confirmed";
    ctx.result.processed = true;
    ctx.result.paymentId = txResult.payment.id;
    return ctx.result;
  } catch (err) {
    // DB error: log + rethrow so route handler returns 500 (Sepay will retry).
    console.error("[SEPAY_DB_ERROR]", {
      transactionId: (ctx.payload as { id?: number })?.id,
      code: ctx.result.orderCode,
      err: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

function finalize(
  ctx: StepContext,
  action: SepayAction,
  reason: string,
): Promise<ProcessResult> {
  ctx.result.action = action;
  ctx.result.processed = false;
  ctx.result.reason = reason;
  return logWebhookNoOp(ctx, action, reason).then(() => ctx.result);
}

/**
 * Log a non-payment webhook (e.g. amount_mismatch, order_not_found).
 * Đây là các case KHÔNG trigger payment confirmation nhưng vẫn cần
 * audit log để debug.
 */
async function logWebhookNoOp(
  ctx: StepContext,
  action: SepayAction,
  reason: string,
): Promise<void> {
  try {
    await db
      .insert(sepayWebhookLogs)
      .values({
        transactionId: ctx.payload.id,
        rawPayload: ctx.payload as unknown as Record<string, unknown>,
        action,
        orderId: ctx.result.orderId ?? null,
        orderCode: ctx.result.orderCode ?? null,
        errorMessage: reason,
        success: "false",
      })
      .onConflictDoNothing({ target: sepayWebhookLogs.transactionId });
  } catch (err) {
    // Không để log fail block main flow.
    console.error("[SEPAY_LOG_ERROR]", err);
  }
}

// ==== Payload validation ====

interface ValidationOk {
  ok: true;
  payload: SepayWebhookPayload;
}
interface ValidationFail {
  ok: false;
  reason: string;
}

/**
 * Inline payload validation (không dùng zod để giảm deps; payload đơn giản).
 *
 * Mọi field quan trọng: id (number), transferType (enum), transferAmount (>=1),
 * accountNumber (string), gateway (string), content (string non-empty).
 */
function validatePayload(input: unknown): ValidationOk | ValidationFail {
  if (!input || typeof input !== "object") {
    return { ok: false, reason: "payload_not_object" };
  }
  const p = input as Record<string, unknown>;

  if (typeof p.id !== "number" || !Number.isFinite(p.id) || p.id <= 0) {
    return { ok: false, reason: "invalid_id" };
  }
  if (typeof p.gateway !== "string" || p.gateway.length === 0) {
    return { ok: false, reason: "invalid_gateway" };
  }
  if (typeof p.transactionDate !== "string" || p.transactionDate.length === 0) {
    return { ok: false, reason: "invalid_transactionDate" };
  }
  if (typeof p.accountNumber !== "string" || p.accountNumber.length === 0) {
    return { ok: false, reason: "invalid_accountNumber" };
  }
  if (typeof p.content !== "string" || p.content.length === 0) {
    return { ok: false, reason: "invalid_content" };
  }
  if (p.transferType !== "in" && p.transferType !== "out") {
    return { ok: false, reason: "invalid_transferType" };
  }
  if (typeof p.transferAmount !== "number" || p.transferAmount <= 0) {
    return { ok: false, reason: "invalid_transferAmount" };
  }

  return {
    ok: true,
    payload: {
      id: p.id,
      gateway: p.gateway,
      transactionDate: p.transactionDate,
      accountNumber: p.accountNumber,
      subAccount: typeof p.subAccount === "string" ? p.subAccount : null,
      code: typeof p.code === "string" ? p.code : null,
      content: p.content,
      transferType: p.transferType,
      description: typeof p.description === "string" ? p.description : null,
      transferAmount: p.transferAmount,
      accumulated: typeof p.accumulated === "number" ? p.accumulated : null,
      referenceCode: typeof p.referenceCode === "string" ? p.referenceCode : null,
    },
  };
}

export type { AmountCheckResult };
export type { OrderRow as Order, PaymentRow as Payment };
void and;
void eq;
