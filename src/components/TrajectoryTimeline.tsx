"use client";

type Props = {
  progress: number;
  playing: boolean;
  onProgressChange: (t: number) => void;
  onPlayingChange: (playing: boolean) => void;
  viewMode: "earth" | "solar";
  labelStart?: string;
  labelMid?: string;
  labelEnd?: string;
  disabled?: boolean;
  className?: string;
};

export default function TrajectoryTimeline({
  progress,
  playing,
  onProgressChange,
  onPlayingChange,
  viewMode,
  labelStart,
  labelMid,
  labelEnd,
  disabled,
  className,
}: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const start =
    labelStart ?? (viewMode === "earth" ? "Approach" : "Orbit start");
  const mid = labelMid ?? (viewMode === "earth" ? "Entry" : "¼ orbit");
  const end = labelEnd ?? (viewMode === "earth" ? "Impact zone" : "Full orbit");

  return (
    <div
      className={`border-t border-slate-800/80 bg-slate-950/95 px-3 py-2.5 ${
        disabled ? "opacity-50" : ""
      } ${className ?? ""}`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/90">
          Trajectory timeline
        </p>
        <p className="font-mono text-[10px] text-slate-500">{pct}%</p>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onPlayingChange(!playing)}
          className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-slate-600 px-3 text-sm font-medium text-slate-200 hover:border-cyan-600 hover:text-cyan-300 disabled:cursor-not-allowed"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "Pause" : "Play"}
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
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>{start}</span>
            <span>{mid}</span>
            <span>{end}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
