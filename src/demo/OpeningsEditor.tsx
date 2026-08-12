// Add, remove, and edit the doors and windows.

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <div className="flex flex-col gap-2.5">
      {openings.map((o, i) => (
        // Index keys are right here: these rows have no identity of their own
        // and their labels ("door 1") are positional anyway.
        <div key={i} className="bg-card rounded-md border p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
              {o.kind} {i + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive size-6"
              aria-label={`Remove ${o.kind} ${i + 1}`}
              onClick={() => onChange(openings.filter((_, j) => j !== i))}
            >
              <X className="size-3.5" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Select value={o.wall} onValueChange={(v) => patch(i, { wall: v as WallName })}>
              <SelectTrigger size="sm" className="w-full" aria-label={`${o.kind} ${i + 1} wall`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WALLS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {w}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={o.kind}
              onValueChange={(v) => patch(i, { kind: v as OpeningRow['kind'] })}
            >
              <SelectTrigger size="sm" className="w-full" aria-label={`${o.kind} ${i + 1} kind`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="door">door</SelectItem>
                <SelectItem value="window">window</SelectItem>
              </SelectContent>
            </Select>

            <NumField id={`ro-w-${i}`} label="RO width" value={o.width}
              onChange={(v) => patch(i, { width: v })} />
            <NumField id={`ro-h-${i}`} label="RO height" value={o.height}
              onChange={(v) => patch(i, { height: v })} />
            <NumField id={`ro-c-${i}`} label="center" value={o.center}
              onChange={(v) => patch(i, { center: v })} />
            <NumField id={`ro-s-${i}`} label="sill" value={o.sill} disabled={o.kind === 'door'}
              onChange={(v) => patch(i, { sill: v })} />
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" className="flex-1"
          onClick={() => onChange([...openings, { ...NEW_DOOR }])}>
          <Plus className="size-3.5" /> door
        </Button>
        <Button type="button" variant="outline" size="sm" className="flex-1"
          onClick={() => onChange([...openings, { ...NEW_WINDOW }])}>
          <Plus className="size-3.5" /> window
        </Button>
      </div>
    </div>
  );
}

function NumField({
  id, label, value, disabled, onChange,
}: {
  id: string; label: string; value: string; disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label
        htmlFor={id}
        className="text-muted-foreground text-[10px] font-medium tracking-[0.06em] uppercase"
      >
        {label}
      </Label>
      {/* Openings are an inch-scale dimension, not a foot-scale one. */}
      <Input
        id={id}
        type="number"
        min={0}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 tabular-nums"
      />
    </div>
  );
}
