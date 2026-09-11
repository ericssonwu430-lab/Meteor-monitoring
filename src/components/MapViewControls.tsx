"use client";

type Props = {
  showPlanets: boolean;
  showFireballs: boolean;
  onShowPlanetsChange: (v: boolean) => void;
  onShowFireballsChange: (v: boolean) => void;
  className?: string;
};

export default function MapViewControls({
  showPlanets,
  showFireballs,
  onShowPlanetsChange,
  onShowFireballsChange,
  className,
}: Props) {
  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-950/90 px-2.5 py-2 shadow-lg shadow-black/30 backdrop-blur ${className ?? ""}`}
      role="group"
      aria-label="Map view options"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
        View
      </span>
      <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 text-xs text-slate-200">
        <input
          type="checkbox"
          className="h-4 w-4 accent-cyan-500"
          checked={showPlanets}
          onChange={(e) => onShowPlanetsChange(e.target.checked)}
          aria-label="Show other planets on the map"
        />
        Planets
      </label>
      <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 text-xs text-slate-200">
        <input
          type="checkbox"
          className="h-4 w-4 accent-cyan-500"
          checked={showFireballs}
          onChange={(e) => onShowFireballsChange(e.target.checked)}
          aria-label="Show fireball events on the map"
        />
        Fireballs
      </label>
    </div>
  );
}
