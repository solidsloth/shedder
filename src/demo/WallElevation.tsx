// One wall, drawn in elevation looking at it from outside.
//
// Vertical position comes straight from the engine's elevBottom/elevHeight —
// this file never works out how high anything sits.

import { useState } from 'react';
import {
  formatInches,
  formatLength,
  type MemberRole,
  type WallFraming,
} from '../core/framing.ts';
import { DimLine, HatchDefs, Readout, type ReadoutValue } from './svg.tsx';

const CLS: Partial<Record<MemberRole, string>> = {
  'bottom-plate': 'plate',
  'top-plate': 'plate',
  'cap-plate': 'plate',
  'corner-nailer': 'nailer',
  header: 'header',
  sill: 'sill',
  'jack-stud': 'jack',
  'king-stud': 'king',
  cripple: 'cripple',
  stud: 'stud',
  'corner-stud': 'stud',
};

// Plates behind, then the pieces that sit in the wall, studs in front.
const ORDER: Partial<Record<MemberRole, number>> = {
  'bottom-plate': 0,
  'top-plate': 0,
  'cap-plate': 0,
  header: 1,
  sill: 1,
  'corner-nailer': 1,
  cripple: 2,
  'jack-stud': 2,
  stud: 3,
  'corner-stud': 3,
  'king-stud': 3,
};

export function WallElevation({ wall, scale }: { wall: WallFraming; scale: number }) {
  const [hover, setHover] = useState<ReadoutValue | null>(null);
  const { spec } = wall;
  const t = wall.thickness;
  const L = spec.length;
  const H = spec.height;

  const padL = 14;
  const padR = 14;
  const padT = 8;
  const dimBand = 46;
  const isButt = spec.role === 'butt';
  const w = L * scale + padL + padR + (isButt ? 2 * t * scale : 0);
  const originX = padL + (isButt ? t * scale : 0);
  const h = H * scale + padT + dimBand;
  const X = (v: number) => v * scale;

  const sorted = [...wall.members].sort((a, b) => (ORDER[a.role] ?? 9) - (ORDER[b.role] ?? 9));
  const centers = wall.studCenters;
  const dimY = X(H) + 18;
  const overallY = dimY + 22;

  return (
    <section>
      <div className="wallhead">
        <h3>{spec.name} wall</h3>
        <span className="meta">
          {spec.role === 'through' ? 'runs full length' : 'fits between the through walls'} ·{' '}
          {formatLength(L)} · {centers.length} studs
        </span>
      </div>
      <div className="drawing">
        <svg
          width={w}
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={`${spec.name} wall elevation`}
        >
          <HatchDefs />
          <g transform={`translate(${originX},${padT})`}>
            {sorted.map((m) => {
              const cls = CLS[m.role];
              const at =
                m.center !== undefined ? ` · center ${formatInches(m.center)} from left` : '';
              return (
                <rect
                  key={m.id}
                  x={X(m.x)}
                  y={X(H - m.elevBottom - m.elevHeight)}
                  width={Math.max(X(m.w), 1.5)}
                  height={X(m.elevHeight)}
                  className={cls}
                  onMouseEnter={
                    cls === 'plate'
                      ? undefined
                      : () =>
                          setHover({
                            label: m.label,
                            facts: [
                              ...(m.center !== undefined
                                ? [{ lead: 'center', value: formatInches(m.center) }]
                                : []),
                              { lead: 'cut', value: formatLength(m.length) },
                            ],
                            note: m.note,
                          })
                  }
                >
                  <title>{`${m.label} — ${formatLength(m.length)}${at}`}</title>
                </rect>
              );
            })}

            {/* rough openings, dashed, labelled inside the void */}
            {wall.openings.map((fo) => {
              const yTop = X(H - fo.roTop);
              const cx = X((fo.roLeft + fo.roRight) / 2);
              return (
                <g key={fo.spec.name}>
                  <rect
                    x={X(fo.roLeft)}
                    y={yTop}
                    width={X(fo.roRight - fo.roLeft)}
                    height={X(fo.roTop - fo.roBottom)}
                    className="ro"
                  />
                  <text x={cx} y={yTop + 14} className="rolabel">
                    {fo.spec.name}
                  </text>
                  <text x={cx} y={yTop + 26} className="rolabel">
                    {`RO ${formatInches(fo.roRight - fo.roLeft)} × ${formatInches(
                      fo.roTop - fo.roBottom,
                    )}`}
                  </text>
                </g>
              );
            })}

            {/* running dimension string across the stud centers */}
            {centers.map((c) => (
              <line key={c} x1={X(c)} y1={X(H)} x2={X(c)} y2={dimY + 4} className="witness" />
            ))}
            {centers.slice(1).map((c, i) => (
              <DimLine
                key={c}
                x1={X(centers[i]!)}
                x2={X(c)}
                y={dimY}
                label={formatInches(c - centers[i]!)}
              />
            ))}

            <line x1={0} y1={X(H)} x2={0} y2={overallY + 4} className="witness" />
            <line x1={X(L)} y1={X(H)} x2={X(L)} y2={overallY + 4} className="witness" />
            <DimLine x1={0} x2={X(L)} y={overallY} label={formatLength(L)} />
          </g>
        </svg>
        <Readout hint="Point at a stud for its exact center and cut length." value={hover} />
      </div>
    </section>
  );
}
