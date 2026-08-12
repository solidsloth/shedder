import { useEffect, useMemo, useRef, useState } from 'react';
import {
  boardFeet,
  cutList,
  formatLength,
  layoutShed,
  type ShedFraming,
  type ShedSpec,
} from '../core/framing.ts';
import { INITIAL_FORM, toShedSpec, type Form } from './form.ts';
import { Controls, type SetField } from './Controls.tsx';
import { CornerDetail } from './CornerDetail.tsx';
import { CutList } from './CutList.tsx';
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
    <div className="layout">
      <Controls
        form={form}
        set={set}
        footprint={
          shown
            ? `${formatLength(shown.spec.width)} × ${formatLength(
                shown.spec.depth,
              )} × ${formatLength(shown.spec.wallHeight)} high`
            : '—'
        }
      />
      <main>
        {shown ? (
          <Sheet spec={shown.spec} framing={shown.framing} error={result.error}
            wallsRef={wallsRef} wallsWidth={wallsWidth} />
        ) : (
          <div className="warn">
            <b>Check the dimensions.</b> {result.error}
          </div>
        )}
      </main>
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
  const rows = cutList([
    ...(framing.floor ? [framing.floor] : []),
    ...framing.walls,
    ...(framing.roof ? [framing.roof] : []),
  ]);
  const studCount = framing.walls.reduce(
    (n, w) =>
      n +
      w.members.filter(
        (m) =>
          m.role !== 'bottom-plate' && m.role !== 'top-plate' && m.role !== 'cap-plate',
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
      <div className="titleblock">
        <h2>
          {formatLength(spec.width)} × {formatLength(spec.depth)} ×{' '}
          {formatLength(spec.wallHeight)} high
        </h2>
        <div className="stat">
          studs <b>{studCount}</b>
        </div>
        <div className="stat">
          pieces <b>{pieces}</b>
        </div>
        <div className="stat">
          board ft <b>{boardFeet(rows).toFixed(0)}</b>
        </div>
        <div className="stat">
          stud length <b>{formatLength(framing.walls[0]!.studLength)}</b>
        </div>
        <div className="stat">
          overall height <b>{formatLength(framing.overallHeight)}</b>
        </div>
      </div>

      <div>
        {error && (
          <div className="warn">
            <b>Check the dimensions.</b> {error} — still showing the last design that worked.
          </div>
        )}
        {framing.warnings.map((w) => (
          <div className="warn" key={w}>
            <b>Note.</b> {w}
          </div>
        ))}
      </div>

      {framing.floor && <FloorPlan floor={framing.floor} />}

      <div ref={wallsRef}>
        {framing.walls.map((wall) => (
          <WallElevation key={wall.spec.name} wall={wall} scale={scale} />
        ))}
      </div>

      {framing.roof && <RoofSection roof={framing.roof} />}

      <CornerDetail spec={spec} />
      <CutList rows={rows} />
    </>
  );
}
