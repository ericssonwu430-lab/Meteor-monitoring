"use client";

import type { LodMode } from "@/components/EarthGlobe";

export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 1.5, 2.5] as const;
export type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

type Props = {
  progress: number;
  playing: boolean;
  onProgressChange: (t: number) => void;
  onPlayingChange: (playing: boolean) => void;
  playbackSpeed?: PlaybackSpeed;
  onPlaybackSpeedChange?: (speed: PlaybackSpeed) => void;
  lodMode?: LodMode;
  labelStart?: string;
  labelMid?: string;
  labelEnd?: string;
  /** 0–1 position of wall-clock "now" within first-obs → impact (null if outside). */
  nowProgress?: number | null;
  /** When scrubbed time is near wall-clock now. */
  nearNow?: boolean;
  /** Optional caption under the bar (Sentry span vs live Horizons). */
  caption?: string;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
};

function formatSpeed(s: number): string {
  if (s === 1) return "1×";
  return `${s}×`;
}

export default function TrajectoryTimeline({
  progress,
  playing,
  onProgressChange,
  onPlayingChange,
  playbackSpeed = 1,
  onPlaybackSpeedChange,
  lodMode = "earth",
  labelStart,
  labelMid,
  labelEnd,
  nowProgress = null,
  nearNow = false,
  caption,
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
  const nowPct =
    nowProgress != null && Number.isFinite(nowProgress)
      ? Math.min(1, Math.max(0, nowProgress)) * 100
      : null;

  return (
    <div
      className={`${
        disabled ? "opacity-50" : ""
      } ${className ?? ""}`}
    >
      {/* Time bar */}
      <div
        className={`${compact ? "px-2 py-1.5" : "px-3 py-2"} border-t border-slate-800/80 bg-slate-950/95`}
      >
        {!compact && (
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90">
              Trajectory
            </p>
            <p className="font-mono text-[10px] text-slate-500">{pct}%</p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (!playing && progress >= 0.99) {
                // Already at end of time bar — restart from the start
                onProgressChange(0);
              }
              onPlayingChange(!playing);
            }}
            className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-slate-600 px-2.5 text-sm font-medium text-slate-200 hover:border-cyan-600 hover:text-cyan-300 disabled:cursor-not-allowed"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "⏸" : "▶"}
          </button>

          <div className="min-w-0 flex-1">
            <div className="relative">
              {nowPct != null && (
                <div
                  className="pointer-events-none absolute top-1/2 z-0 h-3 w-px -translate-y-1/2 bg-lime-400/70"
                  style={{ left: `calc(${nowPct}% - 0.5px)` }}
                  title="Now (UTC)"
                  aria-hidden
                />
              )}
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
                className="traj-range relative z-10 w-full cursor-pointer disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex justify-between gap-1 text-[10px] text-slate-500">
              <span className="min-w-0 truncate font-mono tabular-nums">{start}</span>
              <span className="shrink-0 font-mono text-slate-600">
                {mid ? (
                  <span className="inline-flex items-center gap-1">
                    {nearNow && (
                      <span className="rounded bg-lime-500/20 px-1 text-[9px] font-semibold uppercase tracking-wide text-lime-300">
                        live
                      </span>
                    )}
                    {mid}
                  </span>
                ) : (
                  `${pct}%`
                )}
              </span>
              <span className="min-w-0 truncate text-right font-mono tabular-nums">
                {end}
              </span>
            </div>
            {caption && (
              <p className="mt-1 text-[10px] leading-snug text-slate-500">
                {caption}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Speed bar — always directly under the time bar */}
      {onPlaybackSpeedChange && (
        <div className="flex flex-wrap items-center gap-1.5 border border-t-0 border-slate-700/80 bg-slate-900 px-2 py-2 sm:px-3">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
            Speed
          </span>
          {PLAYBACK_SPEEDS.map((s) => {
            const active = playbackSpeed === s;
            return (
              <button
                key={s}
                type="button"
                disabled={disabled}
                onClick={() => onPlaybackSpeedChange(s)}
                className={`min-h-9 min-w-[3rem] rounded-lg px-2.5 font-mono text-xs tabular-nums transition ${
                  active
                    ? "bg-cyan-500 font-semibold text-slate-950"
                    : "border border-slate-600 bg-slate-950 text-slate-200 hover:border-cyan-500 hover:text-cyan-200"
                } disabled:cursor-not-allowed`}
                aria-label={`Playback speed ${formatSpeed(s)}`}
                aria-pressed={active}
              >
                {formatSpeed(s)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
