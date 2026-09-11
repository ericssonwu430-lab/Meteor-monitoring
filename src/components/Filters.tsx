"use client";

import { LabelWithInfo } from "@/components/InfoTip";
import { TIPS } from "@/lib/glossary";

type Props = {
  minIp: number;
  onMinIpChange: (v: number) => void;
};

const PRESETS = [
  { label: "All", value: 0 },
  { label: "≥ 1e-6", value: 1e-6 },
  { label: "≥ 1e-4", value: 1e-4 },
  { label: "≥ 0.1%", value: 0.001 },
  { label: "≥ 1%", value: 0.01 },
];

export default function Filters({ minIp, onMinIpChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <LabelWithInfo
        tip={TIPS.minImpactProb}
        className="text-xs uppercase tracking-wider text-slate-400"
      >
        Min impact prob
      </LabelWithInfo>
      {PRESETS.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={() => onMinIpChange(p.value)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            minIp === p.value
              ? "bg-cyan-500 text-slate-950"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
