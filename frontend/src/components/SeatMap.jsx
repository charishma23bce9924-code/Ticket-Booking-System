import React, { useMemo } from 'react';

const CATEGORY_COLORS = [
  { border: 'border-amber-500', dot: 'bg-amber-500', tint: 'bg-amber-50/60', ring: 'ring-amber-300' },
  { border: 'border-sky-500', dot: 'bg-sky-500', tint: 'bg-sky-50/60', ring: 'ring-sky-300' },
  { border: 'border-emerald-500', dot: 'bg-emerald-500', tint: 'bg-emerald-50/60', ring: 'ring-emerald-300' },
  { border: 'border-fuchsia-500', dot: 'bg-fuchsia-500', tint: 'bg-fuchsia-50/60', ring: 'ring-fuchsia-300' },
  { border: 'border-orange-500', dot: 'bg-orange-500', tint: 'bg-orange-50/60', ring: 'ring-orange-300' },
];

/**
 * Renders a seat map. `seats` is an array of:
 * { showSeatId, rowLabel, colNumber, category, status }
 * `selected` is a Set of showSeatIds currently selected by this user.
 * `eventType` ('CONCERT' | 'MOVIE' | other) switches between two distinct,
 * purpose-built layouts:
 *   - CONCERT: concentric curved rows sweeping around the stage, like an
 *     opera house or amphitheater — no per-seat chrome, just a clean arc.
 *   - MOVIE / default: straight rows, but grouped into clearly divided
 *     sections per seat category (Premium / Standard / etc.), each with
 *     its own label and a soft background tint, like a real cinema.
 */
export default function SeatMap({ seats, selected, onToggle, eventType }) {
  const rows = useMemo(() => {
    const grouped = {};
    for (const s of seats) {
      grouped[s.rowLabel] = grouped[s.rowLabel] || [];
      grouped[s.rowLabel].push(s);
    }
    Object.values(grouped).forEach((r) => r.sort((a, b) => a.colNumber - b.colNumber));
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [seats]);

  const categoryColorMap = useMemo(() => {
    const categories = [...new Set(seats.map((s) => s.category))].sort();
    const map = {};
    categories.forEach((cat, i) => { map[cat] = CATEGORY_COLORS[i % CATEGORY_COLORS.length]; });
    return map;
  }, [seats]);

  function seatState(s) {
    if (selected.has(s.showSeatId)) return 'selected';
    if (s.status === 'BOOKED') return 'booked';
    if (s.status === 'HELD') return 'held';
    return 'available';
  }

  const isConcert = (eventType || '').toUpperCase() === 'CONCERT';

  return (
    <div className="space-y-4">
      {isConcert ? (
        <CurvedStageMap rows={rows} categoryColorMap={categoryColorMap} seatState={seatState} onToggle={onToggle} selected={selected} />
      ) : (
        <SectionedTheaterMap rows={rows} categoryColorMap={categoryColorMap} seatState={seatState} onToggle={onToggle} selected={selected} />
      )}

      {/* Category legend */}
      <div className="flex items-center justify-center gap-4 pt-1 text-xs text-stone-600 flex-wrap">
        {Object.entries(categoryColorMap).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${color.dot}`} />
            <span>{cat}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 pt-2 text-xs text-stone-600 flex-wrap border-t border-stone-100 mt-1">
        <Legend swatch="seat-available" label="Available" />
        <Legend swatch="seat-selected" label="Your Selection" />
        <Legend swatch="seat-held" label="Held by others" />
        <Legend swatch="seat-booked" label="Booked" />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- *
 * CONCERT / OPERA — concentric curved rows around a stage, minimal chrome
 * ---------------------------------------------------------------------- */
function CurvedStageMap({ rows, categoryColorMap, seatState, onToggle }) {
  const numRows = rows.length;
  const height = Math.max(320, 150 + numRows * 34);

  return (
    <div>
      <div className="mx-auto w-2/3 h-2.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent rounded-full mb-1 shadow-sm" />
      <p className="text-center text-[11px] tracking-[0.3em] uppercase text-stone-400 mb-2">Stage</p>

      <div className="relative mx-auto" style={{ height, maxWidth: 640 }}>
        {rows.map(([rowLabel, rowSeats], r) => {
          const depth = numRows <= 1 ? 0 : r / (numRows - 1);
          const rowWidthPct = 38 + depth * 54; // fans out toward the back
          const rowY = 6 + depth * 88; // percent, top (stage) to bottom
          const curveAmp = 16 - depth * 6; // gentle bowl, flattens slightly toward the back
          const n = rowSeats.length;

          return (
            <React.Fragment key={rowLabel}>
              <span
                className="absolute text-[10px] text-stone-400 -translate-y-1/2"
                style={{ left: `${50 - rowWidthPct / 2 - 3.5}%`, top: `${rowY}%` }}
              >
                {rowLabel}
              </span>
              {rowSeats.map((s, i) => {
                const t = n <= 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1..1
                const xPct = 50 + t * (rowWidthPct / 2);
                const yPct = rowY + curveAmp * (t * t);
                const state = seatState(s);
                const color = categoryColorMap[s.category];
                return (
                  <button
                    key={s.showSeatId}
                    type="button"
                    title={`${rowLabel}${s.colNumber} · ${s.category} · ${s.status}`}
                    disabled={s.status === 'BOOKED' || (state === 'held' )}
                    onClick={() => onToggle(s)}
                    className={dotClasses(state, color)}
                    style={{
                      position: 'absolute',
                      left: `${xPct}%`,
                      top: `${yPct}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  />
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function dotClasses(state, color) {
  const base = 'w-3.5 h-3.5 rounded-full border transition-all cursor-pointer';
  if (state === 'selected') return `${base} bg-stone-900 border-stone-900 ring-2 ring-stone-400 scale-125`;
  if (state === 'booked') return `${base} bg-stone-300 border-stone-300 cursor-not-allowed`;
  if (state === 'held') return `${base} bg-amber-300 border-amber-400 cursor-not-allowed`;
  const ring = color?.ring || 'ring-brand-300';
  const border = color?.border || 'border-stone-300';
  return `${base} bg-white dark:bg-stone-200 ${border} hover:${ring} hover:ring-2 hover:scale-110`;
}

/* ---------------------------------------------------------------------- *
 * THEATER / CINEMA — straight rows, clearly divided into category sections
 * ---------------------------------------------------------------------- */
function SectionedTheaterMap({ rows, categoryColorMap, seatState, onToggle }) {
  function rowCategory(rowSeats) {
    const counts = {};
    rowSeats.forEach((s) => { counts[s.category] = (counts[s.category] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  const sections = [];
  let current = null;
  for (const [rowLabel, rowSeats] of rows) {
    const cat = rowCategory(rowSeats);
    if (!current || current.category !== cat) {
      current = { category: cat, rows: [] };
      sections.push(current);
    }
    current.rows.push([rowLabel, rowSeats]);
  }

  function seatClasses(s) {
    const state = seatState(s);
    if (state === 'selected') return 'seat seat-selected';
    if (state === 'booked') return 'seat seat-booked';
    if (state === 'held') return 'seat seat-held';
    return 'seat seat-available';
  }

  return (
    <div>
      <div className="mx-auto w-3/4 h-2 bg-gradient-to-r from-transparent via-stone-300 to-transparent rounded-full mb-1 shadow-sm" />
      <p className="text-center text-[11px] tracking-[0.3em] uppercase text-stone-400 mb-6">Screen</p>

      <div className="space-y-4">
        {sections.map((section, idx) => {
          const color = categoryColorMap[section.category];
          return (
            <div key={idx} className={`rounded-xl border border-stone-100 py-4 px-3 ${color?.tint || ''}`}>
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${color?.dot || 'bg-stone-400'}`} />
                <span className="text-[11px] uppercase tracking-widest text-stone-500 font-medium">{section.category}</span>
                <span className={`w-2 h-2 rounded-full ${color?.dot || 'bg-stone-400'}`} />
              </div>
              <div className="space-y-2">
                {section.rows.map(([rowLabel, rowSeats]) => (
                  <div key={rowLabel} className="flex items-center gap-2 justify-center">
                    <span className="w-4 text-xs text-stone-500">{rowLabel}</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {rowSeats.map((s) => (
                        <button
                          key={s.showSeatId}
                          type="button"
                          title={`${rowLabel}${s.colNumber} · ${s.category} · ${s.status}`}
                          disabled={s.status === 'BOOKED' || (s.status === 'HELD' && seatState(s) !== 'selected')}
                          className={seatClasses(s)}
                          onClick={() => onToggle(s)}
                        >
                          {s.colNumber}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Legend({ swatch, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`seat ${swatch} w-4 h-4`} />
      <span>{label}</span>
    </div>
  );
}
