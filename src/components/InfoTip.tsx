"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

type Props = {
  /** Plain-language explanation shown in the tip */
  text: string;
  /** Optional accessible name; defaults to "More info" */
  label?: string;
  className?: string;
};

/**
 * Tiny (i) control. Tip always opens BELOW the icon and portals to document.body
 * so overflow:hidden panels cannot clip it.
 */
export default function InfoTip({ text, label = "More info", className }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );
  const id = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  const updatePosition = () => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({
      top: r.bottom + 6,
      left: Math.min(
        Math.max(8 + 110, r.left + r.width / 2),
        window.innerWidth - 8 - 110
      ),
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, text]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    const onDoc = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (tipRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const tip =
    open &&
    coords &&
    typeof document !== "undefined" &&
    createPortal(
      <span
        ref={tipRef}
        id={id}
        role="tooltip"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="pointer-events-auto fixed z-[9999] w-max max-w-[min(260px,calc(100vw-16px))] -translate-x-1/2 rounded-lg border border-slate-500 bg-slate-950 px-2.5 py-1.5 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-slate-100 shadow-2xl shadow-black/70"
        style={{ top: coords.top, left: coords.left }}
      >
        {text}
      </span>,
      document.body
    );

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
        onMouseLeave={() => {
          // slight delay so cursor can reach the tip below
          window.setTimeout(() => {
            if (
              tipRef.current?.matches(":hover") ||
              rootRef.current?.matches(":hover")
            ) {
              return;
            }
            setOpen(false);
          }, 120);
        }}
        onFocus={() => setOpen(true)}
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-slate-500/80 bg-slate-900/90 text-[9px] font-bold leading-none text-cyan-300/95 hover:border-cyan-400 hover:text-cyan-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/50"
      >
        i
      </button>
      {tip}
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
