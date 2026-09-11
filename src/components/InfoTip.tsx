"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

type Props = {
  /** Plain-language explanation shown in the tip */
  text: string;
  /** Optional accessible name; defaults to "More info" */
  label?: string;
  className?: string;
};

/**
 * Tiny (i) control. Hover (desktop) or tap (mobile) shows a brief definition.
 */
export default function InfoTip({ text, label = "More info", className }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={rootRef}
      className={`relative inline-flex align-middle ${className ?? ""}`}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-500/80 bg-slate-900/90 text-[9px] font-bold leading-none text-cyan-300/95 hover:border-cyan-400 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
      >
        i
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-max max-w-[220px] -translate-x-1/2 rounded-lg border border-slate-600 bg-slate-950 px-2.5 py-1.5 text-left text-[10px] font-normal normal-case leading-snug tracking-normal text-slate-200 shadow-xl shadow-black/50"
        >
          {text}
        </span>
      )}
    </span>
  );
}

type LabelProps = {
  children: ReactNode;
  tip: string;
  tipLabel?: string;
  className?: string;
  as?: "span" | "p" | "dt" | "h3" | "h2";
};

/** Label text + trailing (i) tip, kept on one line when possible. */
export function LabelWithInfo({
  children,
  tip,
  tipLabel,
  className,
  as = "span",
}: LabelProps) {
  const Tag = as;
  return (
    <Tag className={`inline-flex max-w-full items-center gap-1 ${className ?? ""}`}>
      <span className="min-w-0 truncate">{children}</span>
      <InfoTip text={tip} label={tipLabel} />
    </Tag>
  );
}
