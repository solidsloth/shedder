// Roof cross-section, looking along the ridge at one rafter.
//
// Every outline here is a polygon the engine already worked out, birdsmouth
// included. The section frame has y UP; SVG has y down, so there is exactly one
// flip, at the group level.

import { useState } from 'react';
import { formatInches, formatLength, type RoofFraming } from '../core/framing.ts';
import { CutsTable, HatchDefs, Readout, useWidth, type ReadoutValue } from './svg.tsx';

export function RoofSection({ roof }: { roof: RoofFraming }) {
  const [hover, setHover] = useState<ReadoutValue | null>(null);
  const [hostRef, hostWidth] = useWidth<HTMLDivElement>(760);
  const c = roof.cuts;

  const pad = 26;
  const dimBand = 30;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of roof.profiles) {
    xs.push(p.minX, p.maxX);
    ys.push(p.minY, p.maxY);
  }
  for (const r of roof.plateSections) {
    xs.push(r.x, r.x + r.w);
    ys.push(r.y, r.y + r.h);
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const avail = Math.max(320, hostWidth - 20);
  const scale = Math.min(5, Math.max(1.2, avail / (maxX - minX + 24)));
  const w = (maxX - minX) * scale + pad * 2;
  const h = (maxY - minY) * scale + pad * 2 + dimBand;
  const originX = pad - minX * scale;
  const originY = pad + maxY * scale;
  const peakY = -roof.peakHeight * scale;

  const rows: [string, string][] = [
    ['Rafter stock length', formatLength(c.rafterLength)],
    ['Run (to bearing)', formatLength(c.run)],
    ['Rise over that run', formatLength(c.rise)],
    ['Pitch angle', `${c.pitchAngle.toFixed(2)}°`],
    ['Plumb cut length', formatInches(c.plumbCutLength)],
    ['Birdsmouth seat', formatInches(c.seatDepth)],
    ['Birdsmouth heel', formatInches(c.heelPlumb)],
    ['Notch depth (max 1/3)', `${formatInches(c.notchDepth)} of ${formatInches(c.maxNotchDepth)}`],
    ['Peak above wall top', formatLength(roof.peakHeight)],
  ];
  if (roof.wallHeightDelta !== undefined) {
    rows.push(['High wall taller by', formatLength(roof.wallHeightDelta)]);
  }

  return (
    <section>
      <div className="wallhead">
        <h3>Roof section</h3>
        <span className="meta">
          {roof.spec.type} · {roof.spec.pitch}/12 · {roof.spec.rafterSize} @ {roof.spec.spacing}
          &quot; O.C. · {roof.members.filter((m) => m.role === 'rafter').length} rafters
        </span>
      </div>
      <div className="drawing">
        <div ref={hostRef}>
          <svg
            width={w}
            height={h}
            viewBox={`0 0 ${w} ${h}`}
            role="img"
            aria-label="Roof cross-section"
          >
            <HatchDefs />
            <g transform={`translate(${originX},${originY}) scale(${scale},${-scale})`}>
              {roof.plateSections.map((r, i) => (
                <rect
                  key={`plate-${i}`}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  className="plateb"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              {roof.ridgeSection && (
                <rect
                  x={roof.ridgeSection.x}
                  y={roof.ridgeSection.y}
                  width={roof.ridgeSection.w}
                  height={roof.ridgeSection.h}
                  className="ridgeb"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {roof.profiles.map((p) => (
                <polygon
                  key={p.label}
                  points={p.points.map((q) => `${q.x},${q.y}`).join(' ')}
                  className="rafter"
                  vectorEffect="non-scaling-stroke"
                  onMouseEnter={() =>
                    setHover({
                      label: p.label,
                      facts: [
                        { lead: 'cut', value: formatLength(c.rafterLength) },
                        { lead: 'plumb cut', value: formatInches(c.plumbCutLength) },
                        {
                          lead: 'seat',
                          value: `${formatInches(c.seatDepth)} × heel ${formatInches(c.heelPlumb)}`,
                        },
                      ],
                    })
                  }
                >
                  <title>{`${p.label} — ${formatLength(c.rafterLength)} overall`}</title>
                </polygon>
              ))}
              {/* wall faces, as a reference line each side */}
              {[0, roof.spec.span].map((x) => (
                <line
                  key={x}
                  x1={x}
                  y1={minY}
                  x2={x}
                  y2={maxY}
                  className="ghost"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>

            {/* peak height, outside the flipped group so the text stays upright */}
            <g transform={`translate(${originX},${originY})`}>
              <line x1={0} y1={0} x2={0} y2={peakY} className="dim" />
              {[0, peakY].map((y) => (
                <line key={y} x1={-4} y1={y} x2={4} y2={y} className="dim" />
              ))}
              <text x={6} y={peakY / 2} className="dimtext" textAnchor="start">
                peak {formatLength(roof.peakHeight)}
              </text>
            </g>
          </svg>
        </div>
        <Readout hint="Point at a rafter for its cuts." value={hover} />
      </div>
      <CutsTable rows={rows} />
    </section>
  );
}
