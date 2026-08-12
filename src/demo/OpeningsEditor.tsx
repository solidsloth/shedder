// Add, remove, and edit the doors and windows.

import type { WallName } from '../core/framing.ts';
import { NEW_DOOR, NEW_WINDOW, type OpeningRow } from './form.ts';

const WALLS: WallName[] = ['Front', 'Back', 'Left', 'Right'];

export function OpeningsEditor({
  openings,
  onChange,
}: {
  openings: OpeningRow[];
  onChange: (next: OpeningRow[]) => void;
}) {
  const patch = (i: number, part: Partial<OpeningRow>) =>
    onChange(openings.map((o, j) => (j === i ? { ...o, ...part } : o)));

  return (
    <>
      {openings.map((o, i) => (
        // Index keys are right here: these rows have no identity of their own
        // and their labels ("door 1") are positional anyway.
        <div className="opening" key={i}>
          <div className="ophead">
            <span className="eyebrow">
              {o.kind} {i + 1}
            </span>
            <button type="button" onClick={() => onChange(openings.filter((_, j) => j !== i))}>
              remove
            </button>
          </div>

          <div className="oprow">
            <select
              value={o.wall}
              aria-label={`${o.kind} ${i + 1} wall`}
              onChange={(e) => patch(i, { wall: e.target.value as WallName })}
            >
              {WALLS.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
            <select
              value={o.kind}
              aria-label={`${o.kind} ${i + 1} kind`}
              onChange={(e) => patch(i, { kind: e.target.value as OpeningRow['kind'] })}
            >
              <option value="door">door</option>
              <option value="window">window</option>
            </select>
          </div>

          <div className="oprow">
            <NumField label="RO width" value={o.width} onChange={(v) => patch(i, { width: v })} />
            <NumField label="RO height" value={o.height} onChange={(v) => patch(i, { height: v })} />
          </div>
          <div className="oprow">
            <NumField label="center" value={o.center} onChange={(v) => patch(i, { center: v })} />
            <NumField
              label="sill"
              value={o.sill}
              disabled={o.kind === 'door'}
              onChange={(v) => patch(i, { sill: v })}
            />
          </div>
        </div>
      ))}

      <div className="addrow">
        <button type="button" onClick={() => onChange([...openings, { ...NEW_DOOR }])}>
          + door
        </button>
        <button type="button" onClick={() => onChange([...openings, { ...NEW_WINDOW }])}>
          + window
        </button>
      </div>
    </>
  );
}

function NumField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label>
      {label}
      {/* Openings are an inch-scale dimension, not a foot-scale one. */}
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
