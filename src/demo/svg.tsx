// Drawing primitives shared by the four sheets.
//
// None of these know what a stud is — they take numbers already in screen
// space. Every framing dimension comes from the engine.

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

/**
 * Measures a container so a drawing can scale to the room it's actually given.
 * Replaces the old window-resize listener, which missed the sidebar folding
 * away at the 900px breakpoint.
 */
export function useWidth<T extends HTMLElement>(fallback = 760): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect.width ?? 0;
      if (next > 0) setWidth(next);
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/**
 * 45° hatch for pieces shown cut through: headers, nailers, the ridge board.
 *
 * The two colours are classes, not attributes, so the pattern retints with the
 * theme along with everything else on the sheet.
 */
export function HatchDefs() {
  return (
    <defs>
      <pattern
        id="hatch"
        width={5}
        height={5}
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width={5} height={5} className="hatch-ground" />
        <line x1={0} y1={0} x2={0} y2={5} className="hatch-rule" strokeWidth={1.4} />
      </pattern>
    </defs>
  );
}

/** Drafting dimension line: witness ticks plus the measurement in the run. */
export function DimLine({
  x1,
  x2,
  y,
  label,
}: {
  x1: number;
  x2: number;
  y: number;
  label?: string;
}) {
  return (
    <>
      <line x1={x1} y1={y} x2={x2} y2={y} className="dim" />
      {[x1, x2].map((x, i) => (
        <line key={i} x1={x - 3} y1={y + 3} x2={x + 3} y2={y - 3} className="dim" />
      ))}
      {label && x2 - x1 > 30 && (
        <text x={(x1 + x2) / 2} y={y - 4} className="dimtext">
          {label}
        </text>
      )}
    </>
  );
}

/**
 * The same line turned on its side, reading bottom-to-top.
 *
 * The rotation puts the text to the LEFT of its line rather than above it, so
 * callers need clearance on that side — see the dimension bands in FloorPlan.
 */
export function DimLineV({
  y1,
  y2,
  x,
  label,
}: {
  y1: number;
  y2: number;
  x: number;
  label?: string;
}) {
  const my = (y1 + y2) / 2;
  return (
    <>
      <line x1={x} y1={y1} x2={x} y2={y2} className="dim" />
      {[y1, y2].map((y, i) => (
        <line key={i} x1={x - 3} y1={y + 3} x2={x + 3} y2={y - 3} className="dim" />
      ))}
      {label && y2 - y1 > 30 && (
        <text x={x} y={my} dy={-4} className="dimtext" transform={`rotate(-90, ${x}, ${my})`}>
          {label}
        </text>
      )}
    </>
  );
}

/** One `lead <b>value</b>` pair in a readout strip. */
export interface Fact {
  lead?: string;
  value: string;
}

export interface ReadoutValue {
  label: string;
  facts: Fact[];
  note?: string;
}

/**
 * Lets you step through a drawing's pieces with the keyboard.
 *
 * Pointing at a piece fills the readout, but that was mouse-only — keyboard and
 * touch users got nothing at all. Now the drawing itself takes focus and the
 * arrow keys walk its pieces; Escape clears. The readout is a live region, so
 * a screen reader announces each piece as you land on it.
 */
export function useScan<T>(items: T[], describe: (item: T) => ReadoutValue) {
  const [value, setValue] = useState<ReadoutValue | null>(null);
  const at = useRef(-1);

  const show = (i: number) => {
    at.current = i;
    setValue(i < 0 ? null : describe(items[i]!));
  };
  const step = (delta: number) => {
    if (items.length) show((at.current + delta + items.length) % items.length);
  };

  return {
    value,
    /** Spread onto each drawn piece. */
    item: (i: number) => ({ onMouseEnter: () => show(i) }),
    /** Spread onto the <svg>. */
    svg: {
      tabIndex: 0,
      onKeyDown: (e: KeyboardEvent<SVGSVGElement>) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          step(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          step(-1);
        } else if (e.key === 'Escape') {
          show(-1);
        }
      },
      onBlur: () => show(-1),
    },
  };
}

/** The strip under a drawing that fills in as you point at pieces. */
export function Readout({ hint, value }: { hint: string; value: ReadoutValue | null }) {
  if (!value) {
    return (
      <div className="readout" role="status" aria-live="polite">
        <span>{hint}</span>
      </div>
    );
  }
  return (
    <div className="readout" role="status" aria-live="polite">
      <span>
        <b>{value.label}</b>
      </span>
      {value.facts.map((f, i) => (
        <span key={i}>
          {f.lead ? `${f.lead} ` : ''}
          <b>{f.value}</b>
        </span>
      ))}
      {value.note && <span>{value.note}</span>}
    </div>
  );
}

/** Two-column key/value table under a drawing — the roof and floor cut figures. */
export function CutsTable({ rows }: { rows: [string, string][] }) {
  return (
    <div className="detailrow" style={{ marginTop: 14 }}>
      <table className="cuts">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
