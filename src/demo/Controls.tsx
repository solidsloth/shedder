// The control panel. Every input is controlled; the parent owns the state.
//
// This is CHROME — sans-serif, shadcn components, modern spacing. The drawings
// it drives keep the drafting look. See the note at the top of style.css.

import type { ReactNode } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { NominalSize } from '../core/framing.ts';
import type { Form } from './form.ts';
import { OpeningsEditor } from './OpeningsEditor.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';
import type { Theme } from './theme.ts';

/** Narrow the setter to the field being set, so a typo is a compile error. */
export type SetField = <K extends keyof Form>(key: K, value: Form[K]) => void;

function Row({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_7.5rem] items-center gap-3">
      <Label htmlFor={id} className="text-[13px] font-normal text-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

function NumberField({
  id, label, value, min, step, onChange,
}: {
  id: string; label: string; value: string; min: number; step: number;
  onChange: (v: string) => void;
}) {
  return (
    <Row id={id} label={label}>
      <Input
        id={id}
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 tabular-nums"
      />
    </Row>
  );
}

function SelectField<T extends string>({
  id, label, value, options, onChange,
}: {
  id: string; label: string; value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <Row id={id} label={label}>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([v, text]) => (
            <SelectItem key={v} value={v}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Row>
  );
}

function Check({
  id, label, checked, onChange,
}: {
  id: string; label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="text-[13px] font-normal">
        {label}
      </Label>
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-relaxed text-muted-foreground">{children}</p>;
}

function Group({
  value, title, badge, children,
}: {
  value: string; title: string; badge?: ReactNode; children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="border-sidebar-border">
      <AccordionTrigger className="py-3 text-[13px] font-medium hover:no-underline">
        <span className="flex w-full items-center justify-between pr-2">
          {title}
          {badge}
        </span>
      </AccordionTrigger>
      <AccordionContent className="flex flex-col gap-3 pb-4">{children}</AccordionContent>
    </AccordionItem>
  );
}

/** `[value, label]` pairs. Lumber sizes label themselves; spacings gain a `"`. */
const sizes = (...v: NominalSize[]) => v.map((s) => [s, s] as [NominalSize, string]);
const inches = (...v: number[]) => v.map((n) => [String(n), `${n}"`] as [string, string]);

export function Controls({
  form, set, footprint, theme, cycleTheme,
}: {
  form: Form;
  set: SetField;
  /** The footprint echoed back in words, e.g. `12' × 8' × 8' high`. */
  footprint: string;
  theme: Theme;
  cycleTheme: () => void;
}) {
  return (
    <aside className="border-sidebar-border bg-sidebar text-sidebar-foreground max-h-screen overflow-y-auto border-r px-5 pt-6 pb-16 lg:sticky lg:top-0 lg:self-start">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-[15px] leading-none font-semibold tracking-tight">Shed framing</h1>
          <p className="text-muted-foreground mt-1.5 mb-3 text-[11px]">
            Floor, walls, roof &amp; cut list · v0.4
          </p>
        </div>
        <ThemeToggle theme={theme} cycle={cycleTheme} />
      </div>

      <Accordion
        type="multiple"
        defaultValue={['footprint', 'openings']}
        className="w-full"
      >
        <Group value="footprint" title="Footprint">
          <NumberField id="width" label="Width" value={form.width} min={24} step={12}
            onChange={(v) => set('width', v)} />
          <NumberField id="depth" label="Depth" value={form.depth} min={24} step={12}
            onChange={(v) => set('depth', v)} />
          <NumberField id="height" label="Wall height" value={form.height} min={48} step={12}
            onChange={(v) => set('height', v)} />
          <Hint>
            Inches, outside of framing. The arrows step by <b className="text-primary">1 ft</b>; type
            an odd number like <code className="bg-muted rounded px-1 py-0.5">102</code> for 8&#39;
            6&quot;.
            <span className="text-primary mt-1 block font-medium">= {footprint}</span>
          </Hint>
        </Group>

        <Group value="framing" title="Framing">
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
          <SelectField id="maxStock" label="Longest stick" value={form.maxStock}
            options={[
              ['192', "16'"],
              ['240', "20'"],
              ['144', "12'"],
            ] as const}
            onChange={(v) => set('maxStock', v)} />
          <div className="flex flex-col gap-2.5 pt-1">
            <Check id="doubleTop" label="Double top plate" checked={form.doubleTop}
              onChange={(v) => set('doubleTop', v)} />
            <Check id="treated" label="Treated bottom plate" checked={form.treated}
              onChange={(v) => set('treated', v)} />
          </div>
        </Group>

        <Group value="floor" title="Floor">
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
          <div className="pt-1">
            <Check id="treatedJoists" label="Treat joists too" checked={form.treatedJoists}
              onChange={(v) => set('treatedJoists', v)} />
          </div>
          <Hint>
            Skids carry the joists, so the <b className="text-primary">gap between skids</b> is the
            span that matters — not the shed&#39;s depth. Nothing below the skids is modelled:
            blocks, piers, gravel, and soil bearing are on you.
          </Hint>
        </Group>

        <Group value="roof" title="Roof">
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
          <Hint>
            Overhang in inches, stepping by 6&quot;. Common rafters only — no rake overhang or
            gable-end studs yet.
          </Hint>
        </Group>

        <Group
          value="openings"
          title="Openings"
          badge={
            form.openings.length > 0 ? (
              <Badge variant="secondary" className="ml-2 tabular-nums">
                {form.openings.length}
              </Badge>
            ) : null
          }
        >
          <OpeningsEditor openings={form.openings} onChange={(v) => set('openings', v)} />
          <Hint>
            Sizes are <b className="text-primary">rough openings</b>. Position is the RO center from
            the wall&#39;s left end, viewed from outside. Sill is the RO bottom above the floor.
          </Hint>
        </Group>
      </Accordion>
    </aside>
  );
}
