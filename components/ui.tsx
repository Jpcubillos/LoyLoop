import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-brand-500 text-white hover:bg-brand-600",
    secondary: "border border-line bg-white text-ink hover:bg-slate-50",
    ghost: "text-muted hover:bg-slate-100 hover:text-ink"
  };

  return (
    <button
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-line bg-white shadow-sm", className)}
      {...props}
    />
  );
}

export function Badge({
  className,
  tone = "blue",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "blue" | "green" | "amber" | "slate" }) {
  const tones = {
    blue: "bg-brand-50 text-brand-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-600"
  };

  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", tones[tone], className)}
      {...props}
    />
  );
}

export function SectionTitle({
  eyebrow,
  title,
  text
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold text-brand-600">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-normal text-ink md:text-4xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-muted">{text}</p>
    </div>
  );
}
