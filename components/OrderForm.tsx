"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { site } from "@/content/site";
import AddressPicker, { type AddressValue } from "./AddressPicker";
import BookCover from "./BookCover";
import Reveal from "./motion/Reveal";

const barcode =
  "repeating-linear-gradient(90deg,#211e1a 0 2px,transparent 2px 5px,#211e1a 5px 6px,transparent 6px 11px,#211e1a 11px 14px,transparent 14px 16px,#211e1a 16px 17px,transparent 17px 22px)";

type OrderResult = { code: string; totalAmount: number };

export default function OrderForm() {
  const o = site.orderForm;
  const f = site.finalCta;
  const [result, setResult] = useState<OrderResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reduce = useReducedMotion();
  const done = result !== null;
  const addr = useRef<AddressValue>({
    province: null,
    district: null,
    ward: null,
    addressDetail: "",
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;

    const a = addr.current;
    if (!a.province || !a.district || !a.ward || a.addressDetail.trim().length < 3) {
      setError("Vui lòng chọn đầy đủ địa chỉ nhận hàng");
      return;
    }

    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      quantity: Number(fd.get("quantity") ?? 1),
      province: a.province,
      district: a.district,
      ward: a.ward,
      addressDetail: a.addressDetail,
      source:
        typeof window !== "undefined" ? window.location.pathname : undefined,
    };

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Gửi đơn thất bại, thử lại sau");
        return;
      }
      setResult({ code: data.code, totalAmount: data.totalAmount });
    } catch {
      setError("Mất kết nối, thử lại sau");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      id="dat-hang"
      className="relative overflow-hidden bg-navy py-24 sm:py-32"
    >
      <Reveal className="mx-auto max-w-4xl px-5 sm:px-8">
        <div className="relative grid rounded-lg bg-cream text-ink shadow-2xl shadow-black/40 md:grid-cols-[14rem_1fr]">
          {/* ---- CUỐNG VÉ ---- */}
          <div className="relative flex flex-col items-center gap-6 border-b border-dashed border-ink/25 p-8 md:border-b-0 md:border-r">
            {/* lỗ đục */}
            <span className="absolute right-[-13px] top-[-13px] hidden size-6 rounded-full bg-navy md:block" />
            <span className="absolute bottom-[-13px] right-[-13px] hidden size-6 rounded-full bg-navy md:block" />
            <span className="absolute left-1/2 top-[-13px] size-6 -translate-x-1/2 rounded-full bg-navy md:hidden" />
            <span className="absolute bottom-[-13px] left-1/2 size-6 -translate-x-1/2 rounded-full bg-navy md:hidden" />

            <p className="font-mono text-[10px] tracking-[0.35em] text-ink-faint">
              VÉ KHỞI HÀNH
            </p>

            <div className="w-24">
              <BookCover depth={16} float={false} />
            </div>

            <div className="text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                Giá vé
              </p>
              <p className="font-display text-2xl font-bold text-ink">
                {f.price}
              </p>
            </div>

            <div
              aria-hidden
              className="h-12 w-full opacity-80"
              style={{ backgroundImage: barcode }}
            />
            <p className="font-mono text-[10px] tracking-[0.2em] text-ink-faint">
              LC · 2024 · TP.HCM
            </p>
          </div>

          {/* ---- THÂN VÉ ---- */}
          <div className="p-8 sm:p-11">
            <AnimatePresence mode="wait" initial={false}>
              {done ? (
                <motion.div
                  key="done"
                  initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <span className="rotate-[-7deg] border-[3px] border-brass px-6 py-2 font-display text-2xl font-bold uppercase tracking-[0.2em] text-brass">
                    Đã lên đường
                  </span>
                  <p className="mt-7 font-mono text-sm uppercase tracking-[0.15em] text-ink-faint">
                    Mã đơn
                  </p>
                  <p className="font-display text-3xl font-bold text-ink">
                    {result?.code}
                  </p>
                  <p className="mt-4 max-w-sm leading-relaxed text-ink-soft">
                    Đơn <b>{result?.totalAmount.toLocaleString("vi-VN")}đ</b> đã
                    được ghi nhận. Chúng tôi sẽ gọi xác nhận trong 24 giờ.
                  </p>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  onSubmit={handleSubmit}
                  initial={reduce ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduce ? undefined : { opacity: 0 }}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink/15 pb-3">
                    <p className="font-display text-lg font-bold text-ink">
                      THE LIFECAR
                      <span className="ml-1 text-brass">
                        {site.brand.trademark}
                      </span>
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                      Một chỗ trên hành trình của bạn
                    </p>
                  </div>

                  <div className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                    <TicketField
                      idx="01"
                      label={o.fields.name}
                      name="name"
                      required
                      autoComplete="name"
                    />
                    <TicketField
                      idx="02"
                      label={o.fields.phone}
                      name="phone"
                      type="tel"
                      required
                      autoComplete="tel"
                      pattern="[0-9+ ]{8,}"
                    />
                    <AddressPicker
                      onChange={(v) => {
                        addr.current = v;
                      }}
                    />

                    <TicketField
                      idx="07"
                      label={o.fields.quantity}
                      name="quantity"
                      type="number"
                      defaultValue={1}
                      min={1}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="group mt-9 flex w-full items-center justify-center gap-3 bg-navy px-6 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white transition-colors duration-150 hover:bg-brass disabled:opacity-60"
                  >
                    {submitting ? "Đang gửi…" : "Xác nhận · Lên đường"}
                    {!submitting && (
                      <span className="transition-transform duration-150 group-hover:translate-x-1">
                        &rarr;
                      </span>
                    )}
                  </button>

                  {error && (
                    <p className="mt-3 text-center text-sm text-red-600">
                      {error}
                    </p>
                  )}

                  <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
                    {f.perks.join("  ·  ")}
                  </p>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function TicketField({
  idx,
  label,
  name,
  type = "text",
  ...rest
}: {
  idx: string;
  label: string;
  name: string;
  type?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
        <span className="font-mono text-brass">{idx}</span>
        {label}
      </span>
      <input
        name={name}
        type={type}
        className="mt-2 w-full border-0 border-b border-dashed border-ink/40 bg-transparent pb-1.5 text-base text-ink outline-none transition-colors focus:border-solid focus:border-brass"
        {...rest}
      />
    </label>
  );
}
