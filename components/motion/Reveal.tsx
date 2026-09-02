"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ComponentProps, ElementType, ReactNode } from "react";

type Props = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: "div" | "li" | "section" | "figure" | "article" | "span";
} & Omit<ComponentProps<typeof motion.div>, "children">;

export default function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  as = "div",
  ...rest
}: Props) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as] as ElementType;

  return (
    <MotionTag
      className={className}
      // initial giữ nguyên trên cả server + client để tránh hydration mismatch;
      // reduce-motion chỉ rút gọn transition, không đổi cây render.
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={
        reduce
          ? { duration: 0 }
          : { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }
      }
      {...rest}
    >
      {children}
    </MotionTag>
  );
}
