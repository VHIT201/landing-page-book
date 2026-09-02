"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";

/**
 * Đếm tăng khi cuộn tới. Giữ nguyên phần chữ (vd "+", "K") quanh số.
 */
export default function Counter({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -20% 0px" });
  const reduce = useReducedMotion();

  const match = value.match(/^(\D*)(\d[\d.,]*)(.*)$/);
  const prefix = match?.[1] ?? "";
  const target = match ? Number(match[2].replace(/[.,]/g, "")) : 0;
  const suffix = match?.[3] ?? "";

  // luôn khởi tạo 0 để server + client render giống nhau (tránh hydration mismatch)
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView || reduce || !match) {
      setN(target);
      return;
    }
    const dur = 1100;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduce, target, match]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {n.toLocaleString("vi-VN")}
      {suffix}
    </span>
  );
}
