"use client";

import type { LodMode } from "@/components/EarthGlobe";
import { LabelWithInfo } from "@/components/InfoTip";
import { TIPS } from "@/lib/glossary";

type Props = {
  progress: number;
  playing: boolean;
  onProgressChange: (t: number) => void;
  onPlayingChange: (playing: boolean) => void;
  lodMode?: LodMode;
  labelStart?: string;
  labelMid?: string;
  labelEnd?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
};

export default function TrajectoryTimeline({
  progress,
  playing,
  onProgressChange,
  onPlayingChange,
  lodMode = "earth",
  labelStart,
  labelMid,
  labelEnd,
  disabled,
  className,
  compact,
}: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const solarish = lodMode === "solar" || lodMode === "blend";
  const start =
    labelStart ?? (solarish ? "Orbit start" : "Approach");
  const end =
    labelEnd ??
    (solarish ? "Full orbit" : "Impact zone");
  const mid = labelMid;

  return (
    <div
      className={`${compact ? "px-2 py-1.5" : "px-3 py-2"} border-t border-slate-800/80 bg-slate-950/95 ${
        disabled ? "opacity-50" : ""
      } ${className ?? ""}`}
    >
      {!compact && (
        <div className="mb-1 flex items-center justify-between gap-2">
          <LabelWithInfo
            tip={TIPS.trajectory}
            className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90"
          >
            Trajectory
          </LabelWithInfo>
          <p className="font-mono text-[10px] text-slate-500">{pct}%</p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPlayingChange(!playing)}
          className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-slate-600 px-2.5 text-sm font-medium text-slate-200 hover:border-cyan-600 hover:text-cyan-300 disabled:cursor-not-allowed"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "⏸" : "▶"}
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={1000}
            step={1}
            disabled={disabled}
            value={Math.round(progress * 1000)}
            onChange={(e) => {
              onPlayingChange(false);
              onProgressChange(parseInt(e.target.value, 10) / 1000);
            }}
            aria-label="Scrub trajectory"
            className="traj-range w-full cursor-pointer disabled:cursor-not-allowed"
          />
          <div className="flex justify-between gap-1 text-[10px] text-slate-500">
            <span className="min-w-0 truncate font-mono tabular-nums">{start}</span>
            <span className="shrink-0 font-mono text-slate-600">
              {mid ? mid : `${pct}%`}
            </span>
            <span className="min-w-0 truncate text-right font-mono tabular-nums">
              {end}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
