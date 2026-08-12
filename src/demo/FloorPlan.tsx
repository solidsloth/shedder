// Floor framing, plan view looking down: x is the shed's width, y its depth.
// Skids draw first because they are underneath everything else.

import { useState } from 'react';
import {
  formatInches,
  formatLength,
  type FloorFraming,
  type MemberRole,
} from '../core/framing.ts';
import {
  CutsTable,
  DimLine,
  DimLineV,
  Readout,
  useWidth,
  type ReadoutValue,
} from './svg.tsx';

const CLS: Partial<Record<MemberRole, string>> = {
  skid: 'skid',
  'rim-joist': 'rim',
  joist: 'joist',
  blocking: 'block',
};
const ORDER: Partial<Record<MemberRole, number>> = {
  skid: 0,
  'rim-joist': 1,
  joist: 2,
  blocking: 3,
};

// Dimension bands, measured out from the edge of the plan. DimLine puts its
// text ABOVE its line and DimLineV to the LEFT of its line, so each band needs
// ~12px of clearance or the numbers land back on top of the framing.
const BAND1 = 22;
const BAND2 = 44;
const TEXT = 13;

export function FloorPlan({ floor }: { floor: FloorFraming }) {
  const [hover, setHover] = useState<ReadoutValue | null>(null);
  const [hostRef, hostWidth] = useWidth<HTMLDivElement>(760);

  const { width: W, depth: D } = floor.spec;
  const acrossDepth = floor.spec.joistAxis === 'depth';

  // The joist string takes the near band on whichever edge it runs along; that
  // edge's overall dimension moves out to the far one.
  const padL = (acrossDepth ? BAND1 : BAND2) + TEXT + 4;
  const padB = (acrossDepth ? BAND2 : BAND1) + TEXT + 4;
  const padR = 16;
  const padT = 14;
  const avail = Math.max(320, hostWidth - 20);
  const scale = Math.min(5, Math.max(1, (avail - padL - padR) / W));
  const w = W * scale + padL + padR;
  const h = D * scale + padT + padB;
  const X = (v: number) => v * scale;

  const sorted = [...floor.members].sort((a, b) => (ORDER[a.role] ?? 9) - (ORDER[b.role] ?? 9));
  const c = floor.joistCenters;

  // Skid run comes back out of the members so the UI never computes it.
  const skidRun = floor.members
    .filter((m) => m.role === 'skid' && m.center === floor.skidCenters[0])
    .reduce((s, m) => s + m.length, 0);

  const rows: [string, string][] = [
    ['Joist cut length', formatLength(floor.joistLength)],
    ['Joists', `${c.length} at ${floor.spec.spacing}" O.C.`],
    ['Clear span between skids', formatLength(floor.joistSpan)],
    [
      'Span table allows',
      floor.allowedSpan === undefined ? 'not listed — look it up' : formatLength(floor.allowedSpan),
    ],
    ['Skid run', formatLength(skidRun)],
    ['Deck above the skid bottoms', formatLength(floor.deckHeight)],
  ];
  if (floor.cantilever > 0) {
    rows.push(['Overhang past the outer skids', formatInches(floor.cantilever)]);
  }

  return (
    <section>
      <div className="wallhead">
        <h3>Floor plan</h3>
        <span className="meta">
          {floor.spec.skidCount} × {floor.spec.skidSize} skids · {floor.spec.joistSize} joists @{' '}
          {floor.spec.spacing}&quot; O.C. · {c.length} joists
        </span>
      </div>
      <div className="drawing">
        <div ref={hostRef}>
          <svg
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            role="img"
            aria-label="Floor framing plan"
          >
            <g transform={`translate(${padL},${padT})`}>
              {sorted.map((m) => (
                <rect
                  key={m.id}
                  x={X(m.x)}
                  y={X(m.y)}
                  width={Math.max(X(m.w), 1.5)}
                  height={Math.max(X(m.d), 1.5)}
                  className={CLS[m.role]}
                  onMouseEnter={() =>
                    setHover({
                      label: m.label,
                      facts: [
                        ...(m.center !== undefined
                          ? [{ lead: 'center', value: formatInches(m.center) }]
                          : []),
                        { lead: 'cut', value: formatLength(m.length) },
                        ...(m.treated ? [{ value: 'PT' }] : []),
                      ],
                      note: m.note,
                    })
                  }
                >
                  <title>{`${m.label} — ${formatLength(m.length)}`}</title>
                </rect>
              ))}

              {/* footprint outline — the walls land on this line */}
              <rect x={0} y={0} width={X(W)} height={X(D)} fill="none" stroke="#14171A" strokeWidth={1} />

              {acrossDepth ? (
                <>
                  {c.map((v) => (
                    <line
                      key={v}
                      x1={X(v)}
                      y1={X(D)}
                      x2={X(v)}
                      y2={X(D) + BAND1 + 4}
                      className="witness"
                    />
                  ))}
                  {c.slice(1).map((v, i) => (
                    <DimLine
                      key={v}
                      x1={X(c[i]!)}
                      x2={X(v)}
                      y={X(D) + BAND1}
                      label={formatInches(v - c[i]!)}
                    />
                  ))}
                  <DimLine x1={0} x2={X(W)} y={X(D) + BAND2} label={formatLength(W)} />
                  <DimLineV y1={0} y2={X(D)} x={-BAND1} label={formatLength(D)} />
                </>
              ) : (
                <>
                  {c.map((v) => (
                    <line
                      key={v}
                      x1={-BAND1 - 4}
                      y1={X(v)}
                      x2={0}
                      y2={X(v)}
                      className="witness"
                    />
                  ))}
                  {c.slice(1).map((v, i) => (
                    <DimLineV
                      key={v}
                      y1={X(c[i]!)}
                      y2={X(v)}
                      x={-BAND1}
                      label={formatInches(v - c[i]!)}
                    />
                  ))}
                  <DimLineV y1={0} y2={X(D)} x={-BAND2} label={formatLength(D)} />
                  <DimLine x1={0} x2={X(W)} y={X(D) + BAND1} label={formatLength(W)} />
                </>
              )}
            </g>
          </svg>
        </div>
        <Readout hint="Point at a piece for its cut length." value={hover} />
      </div>
      <CutsTable rows={rows} />
    </section>
  );
}
