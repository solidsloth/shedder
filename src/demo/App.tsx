import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  boardFeet,
  cutList,
  formatLength,
  layoutShed,
  shoppingList,
  type ShedFraming,
  type ShedSpec,
} from '../core/framing.ts';
import { INITIAL_FORM, toShedSpec, type Form } from './form.ts';
import { Controls, type SetField } from './Controls.tsx';
import { useTheme } from './theme.ts';
import { CornerDetail } from './CornerDetail.tsx';
import { CutList } from './CutList.tsx';
import { ShoppingList } from './ShoppingList.tsx';
import { FloorPlan } from './FloorPlan.tsx';
import { RoofSection } from './RoofSection.tsx';
import { WallElevation } from './WallElevation.tsx';
import { useWidth } from './svg.tsx';

const DEV_KEY = 'shedder:dev-form';

/**
 * Dev only. Editing the engine full-reloads the page (Fast Refresh can only
 * preserve state for component modules), which would otherwise throw away the
 * shed you were part-way through setting up. `import.meta.hot` is undefined in
 * a build, so this is dead code there and gets dropped.
 */
function loadForm(): Form {
  if (!import.meta.hot) return INITIAL_FORM;
  try {
    const saved = sessionStorage.getItem(DEV_KEY);
    // Spread over the defaults so a field added since the save still exists.
    return saved ? { ...INITIAL_FORM, ...JSON.parse(saved) } : INITIAL_FORM;
  } catch {
    return INITIAL_FORM;
  }
}

export function App() {
  const [form, setForm] = useState<Form>(loadForm);
  const set: SetField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const { theme, cycle } = useTheme();

  useEffect(() => {
    if (import.meta.hot) sessionStorage.setItem(DEV_KEY, JSON.stringify(form));
  }, [form]);

  // A half-typed dimension throws. Keep drawing the last good design and put
  // the message up top, rather than blanking the sheet mid-keystroke.
  const result = useMemo(() => {
    try {
      const spec = toShedSpec(form);
      return { spec, framing: layoutShed(spec), error: null as string | null };
    } catch (err) {
      return {
        spec: null,
        framing: null,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [form]);

  const lastGood = useRef<{ spec: ShedSpec; framing: ShedFraming } | null>(null);
  if (result.framing && result.spec) {
    lastGood.current = { spec: result.spec, framing: result.framing };
  }
  const shown = lastGood.current;

  const [wallsRef, wallsWidth] = useWidth<HTMLDivElement>(700);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[19rem_1fr]">
      <Controls
        form={form}
        set={set}
        theme={theme}
        cycleTheme={cycle}
        footprint={
          shown
            ? `${formatLength(shown.spec.width)} × ${formatLength(
                shown.spec.depth,
              )} × ${formatLength(shown.spec.wallHeight)} high`
            : '—'
        }
      />
      <main className="min-w-0 px-6 pt-6 pb-20 lg:px-9">
        {shown ? (
          <Sheet
            spec={shown.spec}
            framing={shown.framing}
            error={result.error}
            wallsRef={wallsRef}
            wallsWidth={wallsWidth}
          />
        ) : (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Check the dimensions</AlertTitle>
            <AlertDescription>{result.error}</AlertDescription>
          </Alert>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-[10px] font-semibold tracking-[0.14em] uppercase">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Sheet({
  spec,
  framing,
  error,
  wallsRef,
  wallsWidth,
}: {
  spec: ShedSpec;
  framing: ShedFraming;
  error: string | null;
  wallsRef: React.RefObject<HTMLDivElement | null>;
  wallsWidth: number;
}) {
  // Packing the order is the only genuinely expensive thing on this page, so it
  // is memoised on the framing rather than rerun on every keystroke.
  const { rows, order } = useMemo(() => {
    const cuts = cutList([
      ...(framing.floor ? [framing.floor] : []),
      ...framing.walls,
      ...(framing.roof ? [framing.roof] : []),
    ]);
    return { rows: cuts, order: shoppingList(cuts, { maxStock: spec.maxStock }) };
  }, [framing, spec.maxStock]);

  const studCount = framing.walls.reduce(
    (n, w) =>
      n +
      w.members.filter(
        (m) => m.role !== 'bottom-plate' && m.role !== 'top-plate' && m.role !== 'cap-plate',
      ).length,
    0,
  );
  const pieces = rows.reduce((n, r) => n + r.qty, 0);

  // One shared scale so the four walls stay visually comparable.
  const avail = Math.max(320, wallsWidth - 40);
  const longest = Math.max(...framing.walls.map((w) => w.spec.length));
  const scale = Math.min(6, Math.max(1.6, avail / (longest + 12)));

  return (
    <>
      <header className="mb-6">
        <h2 className="text-xl font-semibold tracking-tight tabular-nums">
          {formatLength(spec.width)} × {formatLength(spec.depth)} ×{' '}
          {formatLength(spec.wallHeight)} high
        </h2>
        <div className="mt-4 flex flex-wrap gap-x-10 gap-y-4 border-t pt-4">
          <Stat label="studs" value={studCount} />
          <Stat label="pieces" value={pieces} />
          <Stat label="board ft" value={boardFeet(rows).toFixed(0)} />
          <Stat label="stud length" value={formatLength(framing.walls[0]!.studLength)} />
          <Stat label="overall height" value={formatLength(framing.overallHeight)} />
        </div>
      </header>

      {(error || framing.warnings.length > 0) && (
        <div className="mb-6 flex flex-col gap-2.5">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>Check the dimensions</AlertTitle>
              <AlertDescription>
                {error} — still showing the last design that worked.
              </AlertDescription>
            </Alert>
          )}
          {framing.warnings.map((w) => (
            <Alert key={w}>
              <Info />
              <AlertDescription>{w}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* The drawing set. Everything inside `.sheet` keeps the drafting look. */}
      <div className="sheet rounded-lg border p-5 lg:p-6">
        {framing.floor && <FloorPlan floor={framing.floor} />}

        <div ref={wallsRef}>
          {framing.walls.map((wall) => (
            <WallElevation key={wall.spec.name} wall={wall} scale={scale} />
          ))}
        </div>

        {framing.roof && <RoofSection roof={framing.roof} />}

        <CornerDetail spec={spec} />
      </div>

      <ShoppingList order={order} />
      <CutList rows={rows} />
    </>
  );
}
