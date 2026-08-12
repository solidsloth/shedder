// Corner post, plan view — how the studs meet where two walls come together.

import { ACTUAL, cornerPost, type CornerType, type ShedSpec } from '../core/framing.ts';
import { HatchDefs } from './svg.tsx';

const COPY: Record<CornerType, React.ReactNode> = {
  'two-stud': (
    <>
      <p>
        <b>Two-stud (L) corner.</b> One stud in each wall, nailed into an L. Least lumber, biggest
        insulation cavity, nothing to nail interior finish to in the corner.
      </p>
      <p>Fine for a shed you are leaving unfinished inside.</p>
    </>
  ),
  'three-stud': (
    <>
      <p>
        <b>Three-stud corner.</b> Adds a stud laid flat against the interior face of the through
        wall. It projects past the side wall to give interior sheathing a full nailing edge.
      </p>
      <p>The usual default. Costs one extra stud per corner.</p>
    </>
  ),
  'four-stud': (
    <>
      <p>
        <b>Four-stud corner.</b> Doubled corner stud plus the flat nailer — a solid post at each
        corner.
      </p>
      <p>Stiffest and the easiest to hang a heavy door off. Uses the most lumber and leaves the
        smallest cavity.</p>
    </>
  ),
};

export function CornerDetail({ spec }: { spec: ShedSpec }) {
  const t = ACTUAL[spec.studSize].width;
  const s = ACTUAL[spec.studSize].thickness;
  const view = 15;
  const scale = 13;
  const pad = 16;
  const size = view * scale + pad * 2;
  const X = (v: number) => v * scale;

  return (
    <section>
      <div className="wallhead">
        <h3>Corner detail</h3>
        <span className="meta">{spec.cornerType.replace('-', ' ')} · plan view · 4 corners</span>
      </div>
      <div className="drawing detailrow">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="Corner post plan detail"
        >
          <HatchDefs />
          <g transform={`translate(${pad},${pad})`}>
            {/* wall envelopes */}
            <rect x={0} y={0} width={X(view)} height={X(t)} fill="#fff" stroke="#A6ADA6" />
            <rect x={0} y={0} width={X(t)} height={X(view)} fill="#fff" stroke="#A6ADA6" />

            {/* through wall: local x along the wall is the building's x */}
            {cornerPost('through', spec.cornerType, t, s).map((p, i) => (
              <rect
                key={`through-${i}`}
                x={X(p.x)}
                y={X(p.y)}
                width={X(p.w)}
                height={X(p.d)}
                className={p.flat ? 'nailer' : 'stud'}
              />
            ))}
            {/* butt wall end stud: its local x runs along the building's y, starting t in */}
            {cornerPost('butt', spec.cornerType, t, s).map((p, i) => (
              <rect
                key={`butt-${i}`}
                x={X(p.y)}
                y={X(t + p.x)}
                width={X(p.d)}
                height={X(p.w)}
                className="stud"
              />
            ))}

            <text x={X(view) - 2} y={X(t) + 12} className="note" textAnchor="end">
              through wall →
            </text>
            <text x={X(t) + 6} y={X(view) - 2} className="note">
              ↑ butt wall
            </text>
          </g>
        </svg>
        <div className="legendtext">{COPY[spec.cornerType]}</div>
      </div>
    </section>
  );
}
