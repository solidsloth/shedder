// The control panel. Every input is controlled; the parent owns the state.

import type { ReactNode } from 'react';
import type { NominalSize } from '../core/framing.ts';
import type { Form } from './form.ts';
import { OpeningsEditor } from './OpeningsEditor.tsx';

/** Narrow the setter to the field being set, so a typo is a compile error. */
export type SetField = <K extends keyof Form>(key: K, value: Form[K]) => void;

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  step,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  min: number;
  step: number;
  onChange: (v: string) => void;
}) {
  return (
    <Field id={id} label={label}>
      <input
        id={id}
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <Field id={id} label={label}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map(([v, text]) => (
          <option key={v} value={v}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}

function Check({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="check">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

/** `[value, label]` pairs. Lumber sizes label themselves; spacings gain a `"`. */
const sizes = (...v: NominalSize[]) => v.map((s) => [s, s] as [NominalSize, string]);
const inches = (...v: number[]) => v.map((n) => [String(n), `${n}"`] as [string, string]);

export function Controls({
  form,
  set,
  footprint,
}: {
  form: Form;
  set: SetField;
  /** The footprint echoed back in words, e.g. `12' × 8' × 8' high`. */
  footprint: string;
}) {
  return (
    <aside>
      <h1>Shed framing</h1>
      <div className="sub">Floor, walls, roof &amp; cut list · v0.4</div>

      <fieldset>
        <legend className="eyebrow">Footprint</legend>
        <NumberField id="width" label="Width" value={form.width} min={24} step={12}
          onChange={(v) => set('width', v)} />
        <NumberField id="depth" label="Depth" value={form.depth} min={24} step={12}
          onChange={(v) => set('depth', v)} />
        <NumberField id="height" label="Wall height" value={form.height} min={48} step={12}
          onChange={(v) => set('height', v)} />
        <p className="hint">
          Inches, outside of framing. The arrows step by <b>1 ft</b>; type an odd number like{' '}
          <code>102</code> for 8&#39; 6&quot;. <b>= {footprint}</b>
        </p>
      </fieldset>

      <fieldset>
        <legend className="eyebrow">Framing</legend>
        <SelectField id="studSize" label="Stud size" value={form.studSize}
          options={sizes('2x4', '2x6')} onChange={(v) => set('studSize', v)} />
        <SelectField id="spacing" label="Spacing O.C." value={form.spacing}
          options={inches(16, 24)} onChange={(v) => set('spacing', v)} />
        <SelectField id="cornerType" label="Corner" value={form.cornerType}
          options={[
            ['two-stud', 'Two-stud'],
            ['three-stud', 'Three-stud'],
            ['four-stud', 'Four-stud'],
          ] as const}
          onChange={(v) => set('cornerType', v)} />
        <SelectField id="throughWalls" label="Long walls run" value={form.throughWalls}
          options={[
            ['front-back', 'Front & back full'],
            ['left-right', 'Sides full'],
          ] as const}
          onChange={(v) => set('throughWalls', v)} />
        <Check id="doubleTop" label="Double top plate" checked={form.doubleTop}
          onChange={(v) => set('doubleTop', v)} />
        <Check id="treated" label="Treated bottom plate" checked={form.treated}
          onChange={(v) => set('treated', v)} />
        <SelectField id="maxStock" label="Longest stick" value={form.maxStock}
          options={[
            ['192', "16'"],
            ['240', "20'"],
            ['144', "12'"],
          ] as const}
          onChange={(v) => set('maxStock', v)} />
      </fieldset>

      <fieldset>
        <legend className="eyebrow">Floor</legend>
        <SelectField id="floorType" label="Type" value={form.floorType}
          options={[
            ['skid', 'Skid floor'],
            ['none', 'None (on a slab)'],
          ] as const}
          onChange={(v) => set('floorType', v)} />
        <SelectField id="joistAxis" label="Joists run" value={form.joistAxis}
          options={[
            ['depth', 'across the depth'],
            ['width', 'across the width'],
          ] as const}
          onChange={(v) => set('joistAxis', v)} />
        <SelectField id="joistSize" label="Joist size" value={form.joistSize}
          options={sizes('2x6', '2x8', '2x10', '2x12')} onChange={(v) => set('joistSize', v)} />
        <SelectField id="joistSpacing" label="Spacing O.C." value={form.joistSpacing}
          options={inches(16, 24)} onChange={(v) => set('joistSpacing', v)} />
        <SelectField id="skidSize" label="Skid size" value={form.skidSize}
          options={sizes('4x4', '4x6', '6x6')} onChange={(v) => set('skidSize', v)} />
        <NumberField id="skidCount" label="Skids" value={form.skidCount} min={2} step={1}
          onChange={(v) => set('skidCount', v)} />
        <NumberField id="skidInset" label="Skid inset" value={form.skidInset} min={0} step={6}
          onChange={(v) => set('skidInset', v)} />
        <NumberField id="blockingRows" label="Blocking rows" value={form.blockingRows} min={0} step={1}
          onChange={(v) => set('blockingRows', v)} />
        <Check id="treatedJoists" label="Treat joists too" checked={form.treatedJoists}
          onChange={(v) => set('treatedJoists', v)} />
        <p className="hint">
          Skids carry the joists, so the <b>gap between skids</b> is the span that matters — not the
          shed&#39;s depth. Nothing below the skids is modelled: blocks, piers, gravel, and soil
          bearing are on you.
        </p>
      </fieldset>

      <fieldset>
        <legend className="eyebrow">Roof</legend>
        <SelectField id="roofType" label="Type" value={form.roofType}
          options={[
            ['gable', 'Gable'],
            ['shed', 'Shed (mono)'],
            ['none', 'None'],
          ] as const}
          onChange={(v) => set('roofType', v)} />
        <SelectField id="pitch" label="Pitch (rise/12)" value={form.pitch}
          options={([2, 3, 4, 5, 6, 8, 12] as const).map((n) => [String(n), `${n}/12`] as const)}
          onChange={(v) => set('pitch', v)} />
        <SelectField id="spanAxis" label="Rafters cross" value={form.spanAxis}
          options={[
            ['depth', 'the depth'],
            ['width', 'the width'],
          ] as const}
          onChange={(v) => set('spanAxis', v)} />
        <SelectField id="rafterSize" label="Rafter size" value={form.rafterSize}
          options={sizes('2x4', '2x6', '2x8', '2x10', '2x12')}
          onChange={(v) => set('rafterSize', v)} />
        <SelectField id="rafterSpacing" label="Spacing O.C." value={form.rafterSpacing}
          options={inches(16, 24)} onChange={(v) => set('rafterSpacing', v)} />
        <NumberField id="overhang" label="Eave overhang" value={form.overhang} min={0} step={6}
          onChange={(v) => set('overhang', v)} />
        <p className="hint">
          Overhang in inches, stepping by 6&quot;. Common rafters only — no rake overhang or
          gable-end studs yet.
        </p>
      </fieldset>

      <fieldset>
        <legend className="eyebrow">Openings</legend>
        <OpeningsEditor openings={form.openings} onChange={(v) => set('openings', v)} />
        <p className="hint">
          Sizes are <b>rough openings</b>. Position is the RO center from the wall&#39;s left end,
          viewed from outside. Sill is the RO bottom above the floor.
        </p>
      </fieldset>
    </aside>
  );
}
