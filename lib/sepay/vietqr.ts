/**
 * Sinh URL VietQR theo format của vietqr.app (miễn phí, không cần API key).
 *
 * Docs: https://sepay.vn/lap-trinh-cong-thanh-toan.html
 * Format: https://vietqr.app/img?bank=<code>&acc=<number>&template=<tpl>&amount=<vnd>&des=<content>
 *
 * Template: 'compact' (có logo ngân hàng + amount) hoặc 'qronly' (chỉ QR).
 */

export interface VietQrInput {
  bankCode: string; // VD: "MBBank"
  bankAccount: string; // VD: "0903252427"
  amount: number; // VND, integer
  content: string; // order code hoặc memo
  template?: "compact" | "qronly";
}

export function buildVietQrUrl(input: VietQrInput): string {
  const params = new URLSearchParams();
  params.set("bank", input.bankCode);
  params.set("acc", input.bankAccount);
  params.set("amount", String(Math.round(input.amount)));
  params.set("des", input.content);
  params.set("template", input.template ?? "compact");
  return `https://vietqr.app/img?${params.toString()}`;
}

/** Dữ liệu UI-friendly để frontend hiển thị QR + thông tin CK. */
export interface PaymentInstructions {
  bankCode: string;
  bankAccount: string;
  bankAccountName: string;
  content: string;
  amount: number;
  qrUrl: string;
}

export function buildPaymentInstructions(
  bank: { code: string; account: string; accountName: string },
  orderCode: string,
  amount: number,
): PaymentInstructions {
  return {
    bankCode: bank.code,
    bankAccount: bank.account,
    bankAccountName: bank.accountName,
    content: orderCode,
    amount,
    qrUrl: buildVietQrUrl({
      bankCode: bank.code,
      bankAccount: bank.account,
      amount,
      content: orderCode,
    }),
  };
}
