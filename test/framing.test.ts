import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTUAL,
  boardFeet,
  cutList,
  defaultFloor,
  defaultShed,
  defaultWallSpec,
  deeperSize,
  defaultRoof,
  formatInches,
  formatLength,
  headerSizeFor,
  layoutFloor,
  layoutRoof,
  layoutShed,
  layoutWall,
  maxJoistSpan,
  parseLength,
  splicePlate,
} from '../src/core/framing.ts';

// ── Units ────────────────────────────────────────────────────────────────────

test('formatInches reduces fractions', () => {
  assert.equal(formatInches(13.375), '13-3/8"');
  assert.equal(formatInches(0.5), '1/2"');
  assert.equal(formatInches(16), '16"');
  assert.equal(formatInches(91.5), '91-1/2"');
});

test('formatLength splits into feet and inches', () => {
  assert.equal(formatLength(92.625), "7' 8-5/8\"");
  assert.equal(formatLength(96), "8'");
  assert.equal(formatLength(11.25), '11-1/4"');
});

test('parseLength accepts the ways people actually type dimensions', () => {
  assert.equal(parseLength('8'), 8);
  assert.equal(parseLength("8'"), 96);
  assert.equal(parseLength("8' 6\""), 102);
  assert.equal(parseLength('12ft'), 144);
  assert.equal(parseLength('92-5/8"'), 92.625);
  assert.equal(parseLength(96), 96);
});

// ── Stud length ──────────────────────────────────────────────────────────────

test('stud length subtracts bottom plate and both top plates', () => {
  const w = layoutWall(defaultWallSpec({ name: 'W', length: 96, height: 96 }));
  assert.equal(w.studLength, 96 - 4.5);

  const single = layoutWall(
    defaultWallSpec({ name: 'W', length: 96, height: 96, doubleTopPlate: false }),
  );
  assert.equal(single.studLength, 96 - 3);
});

// ── Stud layout ──────────────────────────────────────────────────────────────

test('field stud centers land on exact multiples of the spacing', () => {
  const w = layoutWall(defaultWallSpec({ name: 'W', length: 144, spacing: 16 }));
  const field = w.members.filter((m) => m.role === 'stud').map((m) => m.center!);
  for (const c of field) {
    assert.equal(c % 16, 0, `stud at ${c}" is not on a 16" multiple`);
  }
  // 4' sheathing seams must land on a stud center.
  for (const seam of [48, 96]) {
    assert.ok(field.includes(seam), `no stud at the ${seam}" sheathing seam`);
  }
});

test('24" O.C. still puts studs under the sheathing seams', () => {
  const w = layoutWall(defaultWallSpec({ name: 'W', length: 144, spacing: 24 }));
  const field = w.members.filter((m) => m.role === 'stud').map((m) => m.center!);
  assert.ok(field.includes(48));
  assert.ok(field.includes(96));
});

test('butt walls shift their layout so seams line up around the corner', () => {
  const t = ACTUAL['2x4'].width; // 3.5
  const w = layoutWall(
    defaultWallSpec({
      name: 'Left',
      role: 'butt',
      length: 96 - 2 * t,
      cornerInset: t,
      layoutReference: 'building-corner',
    }),
  );
  const field = w.members.filter((m) => m.role === 'stud').map((m) => m.center!);
  // Measured from the building corner, every center is still a 16" multiple.
  for (const c of field) {
    assert.equal((c + t) % 16, 0, `stud at ${c}" is off layout from the building corner`);
  }
});

test('no two full-height members overlap in plan', () => {
  const w = layoutWall(defaultWallSpec({ name: 'W', length: 144, cornerType: 'four-stud' }));
  const verticals = w.members
    .filter((m) => m.role === 'stud' || m.role === 'corner-stud' || m.role === 'corner-nailer')
    .sort((a, b) => a.x - b.x);
  for (let i = 1; i < verticals.length; i++) {
    const prev = verticals[i - 1];
    const cur = verticals[i];
    const xOverlap = cur.x < prev.x + prev.w - 1e-9;
    const yOverlap = cur.y < prev.y + prev.d - 1e-9 && prev.y < cur.y + cur.d - 1e-9;
    assert.ok(!(xOverlap && yOverlap), `${prev.id} and ${cur.id} occupy the same space`);
  }
});

// ── Corners ──────────────────────────────────────────────────────────────────

test('corner type controls how many studs land at each corner', () => {
  const counts: Record<string, number> = {};
  for (const cornerType of ['two-stud', 'three-stud', 'four-stud'] as const) {
    const shed = layoutShed(defaultShed({ cornerType }));
    // Count pieces at one corner: left end of a through wall + end of a butt wall.
    const through = shed.walls.find((w) => w.spec.role === 'through')!;
    const butt = shed.walls.find((w) => w.spec.role === 'butt')!;
    const atLeft = through.members.filter(
      (m) => (m.role === 'corner-stud' || m.role === 'corner-nailer') && m.x < through.spec.length / 2,
    ).length;
    const buttEnd = butt.members.filter(
      (m) => m.role === 'corner-stud' && m.x < butt.spec.length / 2,
    ).length;
    counts[cornerType] = atLeft + buttEnd;
  }
  assert.equal(counts['two-stud'], 2);
  assert.equal(counts['three-stud'], 3);
  assert.equal(counts['four-stud'], 4);
});

test('the flat corner nailer projects past the butt wall face', () => {
  const t = ACTUAL['2x4'].width;
  const w = layoutWall(defaultWallSpec({ name: 'W', length: 96, cornerType: 'three-stud' }));
  const nailer = w.members.find((m) => m.role === 'corner-nailer' && m.x < 48)!;
  assert.ok(nailer.flat);
  assert.ok(nailer.x + nailer.w > t, 'nailer gives no interior nailing surface');
  assert.equal(nailer.y + nailer.d, t, 'nailer should sit tight to the interior face');
});

// ── Shed assembly ────────────────────────────────────────────────────────────

test('butt walls fit between the through walls', () => {
  const t = ACTUAL['2x4'].width;
  const shed = layoutShed(defaultShed({ width: 144, depth: 96, throughWalls: 'front-back' }));
  const front = shed.walls.find((w) => w.spec.name === 'Front')!;
  const left = shed.walls.find((w) => w.spec.name === 'Left')!;
  assert.equal(front.spec.length, 144);
  assert.equal(left.spec.length, 96 - 2 * t);
  // Outside dimension is preserved.
  assert.equal(left.spec.length + 2 * t, 96);
});

test('cap plates lap the corners without doubling up or leaving a gap', () => {
  const t = ACTUAL['2x4'].width;
  const shed = layoutShed(defaultShed({ width: 144, depth: 96 }));
  const front = shed.walls.find((w) => w.spec.name === 'Front')!;
  const left = shed.walls.find((w) => w.spec.name === 'Left')!;
  const capLen = (w: typeof front) =>
    w.members.filter((m) => m.role === 'cap-plate').reduce((s, m) => s + m.length, 0);
  assert.equal(capLen(front), 144 - 2 * t); // held back
  assert.equal(capLen(left), 96 - 2 * t + 2 * t); // runs long to cover
  assert.equal(capLen(left), 96);
});

// ── Plate splicing ───────────────────────────────────────────────────────────

test('plates split at a stud center and add up to the full length', () => {
  const centers = [0.75, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 239.25];
  const pieces = splicePlate(240, centers, 192);
  assert.equal(pieces.length, 2);
  assert.ok(centers.includes(pieces[0].length), 'splice does not land on a stud center');
  assert.equal(pieces.reduce((s, p) => s + p.length, 0), 240);
  assert.ok(pieces.every((p) => p.length <= 192));
});

test('short plates are not spliced', () => {
  assert.deepEqual(splicePlate(144, [48, 96], 192), [{ length: 144, start: 0 }]);
});

// ── Cut list ─────────────────────────────────────────────────────────────────

test('cut list groups identical pieces and keeps treated stock separate', () => {
  const shed = layoutShed(defaultShed({ width: 144, depth: 96 }));
  const rows = cutList(shed.walls);
  const totalPieces = shed.walls.reduce((s, w) => s + w.members.length, 0);
  assert.equal(
    rows.reduce((s, r) => s + r.qty, 0),
    totalPieces,
    'cut list lost or invented pieces',
  );
  assert.ok(rows.some((r) => r.treated), 'bottom plates should be flagged as treated');
  assert.ok(rows.some((r) => !r.treated));
  assert.ok(boardFeet(rows) > 0);
});

test('every stud in a plain shed is the same length', () => {
  const shed = layoutShed(defaultShed());
  const studLengths = new Set(
    shed.walls.flatMap((w) => w.members.filter((m) => m.role === 'stud').map((m) => m.length)),
  );
  assert.equal(studLengths.size, 1);
});

// ── Openings ─────────────────────────────────────────────────────────────────

const door = { name: 'door 1', kind: 'door' as const, center: 72, roWidth: 38, roHeight: 82 };
const win = {
  name: 'window 1',
  kind: 'window' as const,
  center: 96,
  roWidth: 30,
  roHeight: 40,
  sillHeight: 36,
};

test('door: kings, jacks, and header land in the right places', () => {
  const w = layoutWall(defaultWallSpec({ name: 'W', length: 144, openings: [door] }));
  const kings = w.members.filter((m) => m.role === 'king-stud').sort((a, b) => a.x - b.x);
  const jacks = w.members.filter((m) => m.role === 'jack-stud').sort((a, b) => a.x - b.x);
  const headers = w.members.filter((m) => m.role === 'header');
  assert.equal(kings.length, 2);
  assert.equal(jacks.length, 2);
  assert.equal(headers.length, 2); // two plies

  // Jacks stand on the bottom plate and stop exactly at the RO top.
  for (const j of jacks) {
    assert.equal(j.length, 82 - 1.5);
    assert.equal(j.elevBottom, 1.5);
    assert.equal(j.elevBottom + j.elevHeight, 82);
  }
  // Header spans jack to jack and sits directly on them.
  for (const h of headers) {
    assert.equal(h.length, 38 + 3);
    assert.equal(h.x, 72 - 19 - 1.5);
    assert.equal(h.elevBottom, 82);
  }
  // Kings are full height and flush against the jacks.
  assert.equal(kings[0].length, w.studLength);
  assert.equal(kings[0].x + kings[0].w, jacks[0].x);
  assert.equal(jacks[1].x + jacks[1].w, kings[1].x);
  // Kings join the full-height stud centers.
  assert.ok(w.studCenters.includes(kings[0].center!));
});

test('header size comes from the table and can be overridden per opening', () => {
  assert.equal(headerSizeFor(38), '2x6');
  assert.equal(headerSizeFor(60), '2x8');
  assert.equal(headerSizeFor(72), '2x10');
  assert.equal(headerSizeFor(96), '2x12');
  assert.equal(headerSizeFor(97), undefined);

  const w = layoutWall(
    defaultWallSpec({ name: 'W', length: 144, openings: [{ ...door, headerSize: '2x10' }] }),
  );
  const h = w.members.find((m) => m.role === 'header')!;
  assert.equal(h.size, '2x10');
  assert.equal(h.elevHeight, ACTUAL['2x10'].width);
});

test('a span beyond the header table warns instead of silently sizing', () => {
  const w = layoutWall(
    defaultWallSpec({
      name: 'W',
      length: 240,
      openings: [{ name: 'big door', kind: 'door', center: 120, roWidth: 100, roHeight: 78 }],
    }),
  );
  assert.ok(w.warnings.some((x) => x.includes('engineered')));
});

test('window: sill under the RO, cripples below on the grid', () => {
  const w = layoutWall(defaultWallSpec({ name: 'W', length: 144, openings: [win] }));
  const sill = w.members.find((m) => m.role === 'sill')!;
  assert.equal(sill.length, 30);
  assert.ok(sill.flat);
  assert.equal(sill.elevBottom, 36 - 1.5);
  assert.equal(sill.elevBottom + sill.elevHeight, 36); // sill top = RO bottom

  const lower = w.members.filter((m) => m.role === 'cripple' && m.elevBottom === 1.5);
  assert.ok(lower.length >= 1, 'expected cripples under the sill');
  for (const c of lower) {
    assert.equal(c.length, 36 - 3); // bottom plate to sill underside
    assert.equal((c.x + c.w / 2) % 16, 0, 'lower cripple off the layout grid');
  }
});

test('cripples above the header stay on the grid and reach the top plate', () => {
  const w = layoutWall(defaultWallSpec({ name: 'W', length: 144, openings: [door] }));
  const upper = w.members.filter((m) => m.role === 'cripple');
  assert.ok(upper.length > 0);
  for (const c of upper) {
    assert.equal((c.x + c.w / 2) % 16, 0, 'cripple off the layout grid');
    assert.equal(c.elevBottom, 82 + 5.5); // header top (2x6 for a 38" span)
    assert.equal(c.elevBottom + c.elevHeight, 1.5 + w.studLength); // reaches the plates
  }
});

test('nothing intrudes into the rough opening except the door bottom plate', () => {
  for (const openings of [[door], [win]]) {
    const w = layoutWall(defaultWallSpec({ name: 'W', length: 144, openings }));
    const fo = w.openings[0];
    for (const m of w.members) {
      if (m.role === 'bottom-plate') continue; // runs through a door RO by design
      const xOv = m.x < fo.roRight - 1e-9 && m.x + m.w > fo.roLeft + 1e-9;
      const zOv =
        m.elevBottom < fo.roTop - 1e-9 && m.elevBottom + m.elevHeight > fo.roBottom + 1e-9;
      assert.ok(!(xOv && zOv), `${m.id} (${m.label}) intrudes into the RO`);
    }
  }
});

test('field studs give way to the opening but survive right next to it', () => {
  const w = layoutWall(defaultWallSpec({ name: 'W', length: 144, openings: [door] }));
  const field = w.members.filter((m) => m.role === 'stud').map((m) => m.center!);
  // door zone runs 50" to 94": grid studs at 64 and 80 give way…
  assert.ok(!field.includes(64) && !field.includes(80));
  // …but 48 and 96 sit just outside and stay.
  assert.ok(field.includes(48) && field.includes(96));
});

test('no two members occupy the same space in 3D', () => {
  const w = layoutWall(
    defaultWallSpec({
      name: 'W',
      length: 192,
      cornerType: 'four-stud',
      openings: [
        { name: 'door 1', kind: 'door', center: 60, roWidth: 38, roHeight: 82 },
        { name: 'window 1', kind: 'window', center: 144, roWidth: 30, roHeight: 40, sillHeight: 36 },
      ],
    }),
  );
  const ms = w.members;
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      const a = ms[i];
      const b = ms[j];
      const x = a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9;
      const y = a.y < b.y + b.d - 1e-9 && b.y < a.y + a.d - 1e-9;
      const z =
        a.elevBottom < b.elevBottom + b.elevHeight - 1e-9 &&
        b.elevBottom < a.elevBottom + a.elevHeight - 1e-9;
      assert.ok(!(x && y && z), `${a.id} (${a.label}) and ${b.id} (${b.label}) collide`);
    }
  }
});

test('shed routes openings to the named wall and the cut list still balances', () => {
  const shed = layoutShed(
    defaultShed({
      width: 144,
      depth: 96,
      openings: [
        { wall: 'Front', name: 'door 1', kind: 'door', center: 72, roWidth: 38, roHeight: 82 },
        { wall: 'Right', name: 'window 1', kind: 'window', center: 40, roWidth: 30, roHeight: 24, sillHeight: 40 },
      ],
    }),
  );
  const byName = (n: string) => shed.walls.find((w) => w.spec.name === n)!;
  assert.ok(byName('Front').members.some((m) => m.role === 'header'));
  assert.ok(byName('Right').members.some((m) => m.role === 'sill'));
  assert.ok(!byName('Back').members.some((m) => m.role === 'king-stud'));

  const rows = cutList(shed.walls);
  const total = shed.walls.reduce((s, w) => s + w.members.length, 0);
  assert.equal(rows.reduce((s, r) => s + r.qty, 0), total, 'cut list lost or invented pieces');
});

// ── Roof ─────────────────────────────────────────────────────────────────────

/** Pythagoras on the profile: does this edge run at the roof pitch? */
const edgeSlope = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  (b.y - a.y) / (b.x - a.x);

test('rafter length is the hypotenuse of run and rise', () => {
  for (const pitch of [3, 4, 6, 12]) {
    const r = layoutRoof(defaultRoof({ type: 'gable', pitch, span: 96, overhang: 12 }));
    const { run, rise, rafterLength, slopeFactor } = r.cuts;
    assert.ok(Math.abs(rise - run * (pitch / 12)) < 1e-9, 'rise is not run × pitch/12');
    // Overall length includes the overhang; the structural part is the triangle.
    const structural = Math.sqrt(run * run + rise * rise);
    assert.ok(Math.abs(structural - run * slopeFactor) < 1e-9);
    assert.ok(Math.abs(rafterLength - (run + 12) * slopeFactor) < 1e-9);
  }
});

test('pitch angle matches the pitch and drives the plumb cut', () => {
  const r = layoutRoof(defaultRoof({ pitch: 4, rafterSize: '2x6' }));
  const theta = Math.atan(4 / 12);
  assert.ok(Math.abs(r.cuts.pitchAngle - (theta * 180) / Math.PI) < 1e-9);
  // A plumb cut is the rafter depth divided by cos(pitch) — always longer than the board is deep.
  assert.ok(Math.abs(r.cuts.plumbCutLength - ACTUAL['2x6'].width / Math.cos(theta)) < 1e-9);
  assert.ok(r.cuts.plumbCutLength > ACTUAL['2x6'].width);
});

test('ridge deduction pulls each rafter back by half the ridge thickness', () => {
  const r = layoutRoof(defaultRoof({ type: 'gable', span: 96, rafterSize: '2x6' }));
  assert.equal(r.cuts.run, 96 / 2 - 1.5 / 2);
  // The two rafters and the ridge board fill the span exactly, no gap or overlap.
  const [left, right] = r.profiles;
  assert.equal(left.maxX, r.ridgeSection.x);
  assert.equal(right.minX, r.ridgeSection.x + r.ridgeSection.w);
});

test('the ridge board defaults deeper than the rafter, and says so when it is still too shallow', () => {
  assert.equal(deeperSize('2x6'), '2x8');
  assert.equal(deeperSize('2x12'), '2x12');

  // 4/12 with a 2x6 rafter: a 2x8 ridge is deep enough for the plumb cut.
  const ok = layoutRoof(defaultRoof({ pitch: 4, rafterSize: '2x6' }));
  assert.equal(ok.ridgeSection.h, ACTUAL['2x8'].width);
  assert.ok(ok.ridgeSection.h >= ok.cuts.plumbCutLength);
  assert.ok(!ok.warnings.some((w) => w.includes('ridge')));

  // 12/12 stretches the plumb cut past a 2x8 — that must be called out.
  const steep = layoutRoof(defaultRoof({ pitch: 12, rafterSize: '2x6' }));
  assert.ok(steep.cuts.plumbCutLength > steep.ridgeSection.h);
  assert.ok(steep.warnings.some((w) => w.includes('ridge')));
});

test('birdsmouth: full seat bearing, heel from the pitch, notch checked against 1/3 depth', () => {
  const r = layoutRoof(defaultRoof({ pitch: 4, rafterSize: '2x6', wallThickness: 3.5 }));
  assert.equal(r.cuts.seatDepth, 3.5); // full plate width
  assert.ok(Math.abs(r.cuts.heelPlumb - 3.5 * (4 / 12)) < 1e-9);
  assert.ok(Math.abs(r.cuts.notchDepth - r.cuts.heelPlumb * Math.cos(Math.atan(4 / 12))) < 1e-9);
  assert.equal(r.cuts.maxNotchDepth, ACTUAL['2x6'].width / 3);
  assert.ok(r.cuts.notchDepth < r.cuts.maxNotchDepth);
  assert.ok(!r.warnings.some((w) => w.includes('Birdsmouth')));

  // Steep pitch drives the notch past the guideline — warn, don't silently shrink.
  const steep = layoutRoof(defaultRoof({ pitch: 12, rafterSize: '2x6' }));
  assert.ok(steep.cuts.notchDepth > steep.cuts.maxNotchDepth);
  assert.ok(steep.warnings.some((w) => w.includes('Birdsmouth')));
  assert.equal(steep.cuts.seatDepth, 3.5, 'seat must not be quietly shrunk');
});

test('the birdsmouth seat sits on the plate and the heel is flush with the wall face', () => {
  const r = layoutRoof(defaultRoof({ type: 'gable', pitch: 4, wallThickness: 3.5 }));
  const p = r.profiles[0].points;
  // Points 2→3 are the plumb heel at the wall's exterior face (x = 0).
  assert.equal(p[1].x, 0);
  assert.equal(p[2].x, 0);
  assert.equal(p[2].y, 0, 'seat plane must be the top of the plate');
  // Point 3→4 is the seat: horizontal, one wall thickness long.
  assert.equal(p[3].y, 0);
  assert.equal(p[3].x - p[2].x, 3.5);
  // The heel's vertical leg is the birdsmouth heel.
  assert.ok(Math.abs(p[2].y - p[1].y - r.cuts.heelPlumb) < 1e-9);
});

test('rafter top and bottom edges both run at the pitch', () => {
  const slope = 5 / 12;
  const r = layoutRoof(defaultRoof({ type: 'gable', pitch: 5, span: 120, overhang: 18 }));
  const p = r.profiles[0].points;
  // bottom edge of the tail (0→1) and the run above the seat (3→4)
  assert.ok(Math.abs(edgeSlope(p[0], p[1]) - slope) < 1e-9);
  assert.ok(Math.abs(edgeSlope(p[3], p[4]) - slope) < 1e-9);
  // top edge, ridge end back to tail end (5→6)
  assert.ok(Math.abs(edgeSlope(p[6], p[5]) - slope) < 1e-9);
  // The two plumb cuts are vertical and the same length.
  assert.equal(p[4].x, p[5].x);
  assert.ok(Math.abs(p[5].y - p[4].y - r.cuts.plumbCutLength) < 1e-9);
  assert.ok(Math.abs(p[6].y - p[0].y - r.cuts.plumbCutLength) < 1e-9);
});

test('shed roof: both seats bear on their plates and report the wall height delta', () => {
  const span = 96;
  const W = 3.5;
  const r = layoutRoof(defaultRoof({ type: 'shed', pitch: 3, span, wallThickness: W }));
  const delta = r.wallHeightDelta;
  // Seats are at the notch inner corners, so the rise is over span − one seat.
  assert.ok(Math.abs(delta - (span - W) * (3 / 12)) < 1e-9);
  assert.equal(r.ridgeSection, undefined, 'a shed roof has no ridge board');

  // Two plates, tops exactly at the two seat planes.
  const [low, high] = r.plateSections;
  assert.equal(low.y + low.h, 0);
  assert.ok(Math.abs(high.y + high.h - delta) < 1e-9);
  assert.equal(high.x + high.w, span, 'high plate must sit at the far wall face');

  // Both birdsmouths cut the same depth — the high one just faces the other way.
  const p = r.profiles[0].points;
  assert.ok(Math.abs(p[2].y - p[1].y - r.cuts.heelPlumb) < 1e-9); // low heel
  assert.ok(Math.abs(p[5].y - p[4].y - r.cuts.heelPlumb) < 1e-9); // high notch
  assert.ok(Math.abs(p[6].y - delta) < 1e-9, 'high seat must land on the plate top');
});

test('rafters land on the layout grid so roof sheathing seams fall on one', () => {
  const r = layoutRoof(defaultRoof({ length: 144, spacing: 24 }));
  for (const seam of [48, 96]) {
    assert.ok(r.rafterCenters.includes(seam), `no rafter at the ${seam}" seam`);
  }
  // End rafters sit flush with the building ends.
  assert.equal(r.rafterCenters[0], 0.75);
  assert.equal(r.rafterCenters[r.rafterCenters.length - 1], 144 - 0.75);
});

test('a gable gets a pair of rafters per position, a shed gets one', () => {
  const g = layoutRoof(defaultRoof({ type: 'gable', length: 144 }));
  const sh = layoutRoof(defaultRoof({ type: 'shed', length: 144 }));
  const rafters = (r: typeof g) => r.members.filter((m) => m.role === 'rafter').length;
  assert.equal(rafters(g), g.rafterCenters.length * 2);
  assert.equal(rafters(sh), sh.rafterCenters.length);
  assert.ok(g.members.some((m) => m.role === 'ridge-board'));
  assert.ok(!sh.members.some((m) => m.role === 'ridge-board'));
});

test('the ridge board runs the building length and splices over a rafter', () => {
  const r = layoutRoof(defaultRoof({ type: 'gable', length: 240, maxStock: 192 }));
  const ridge = r.members.filter((m) => m.role === 'ridge-board');
  assert.equal(ridge.reduce((s, m) => s + m.length, 0), 240);
  assert.ok(ridge.length > 1, 'a 20′ ridge should be spliced against 16′ stock');
  for (const piece of ridge) assert.ok(piece.length <= 192);
  assert.ok(r.rafterCenters.includes(ridge[0].length), 'splice does not land on a rafter');
});

test('the roof reports the shed-roof wall delta rather than silently changing a wall', () => {
  const shed = layoutShed(
    defaultShed({
      width: 144,
      depth: 96,
      wallHeight: 96,
      roof: { type: 'shed', pitch: 3, spanAxis: 'depth', rafterSize: '2x6', spacing: 16, overhang: 12 },
    }),
  );
  // Every wall is still framed at the height that was asked for.
  for (const w of shed.walls) assert.equal(w.spec.height, 96);
  assert.ok(shed.roof.wallHeightDelta > 0);
  assert.ok(shed.warnings.some((x) => x.includes('taller')));
});

test('shed roof spans the axis it is told to', () => {
  const base = { type: 'gable' as const, pitch: 4, rafterSize: '2x6' as const, spacing: 16, overhang: 12 };
  const acrossDepth = layoutShed(
    defaultShed({ width: 144, depth: 96, roof: { ...base, spanAxis: 'depth' } }),
  );
  const acrossWidth = layoutShed(
    defaultShed({ width: 144, depth: 96, roof: { ...base, spanAxis: 'width' } }),
  );
  assert.equal(acrossDepth.roof.spec.span, 96);
  assert.equal(acrossDepth.roof.spec.length, 144);
  assert.equal(acrossWidth.roof.spec.span, 144);
  assert.equal(acrossWidth.roof.spec.length, 96);
  // A wider span means a longer rafter and a higher peak.
  assert.ok(acrossWidth.roof.cuts.rafterLength > acrossDepth.roof.cuts.rafterLength);
  assert.ok(acrossWidth.roof.peakHeight > acrossDepth.roof.peakHeight);
});

test('roof pieces reach the cut list alongside the walls', () => {
  const shed = layoutShed(defaultShed({ width: 144, depth: 96 }));
  const rows = cutList([...shed.walls, shed.roof]);
  const total =
    shed.walls.reduce((s, w) => s + w.members.length, 0) + shed.roof.members.length;
  assert.equal(rows.reduce((s, r) => s + r.qty, 0), total, 'cut list lost or invented pieces');
  assert.ok(rows.some((r) => r.labels.includes('Rafter')));
  assert.ok(rows.some((r) => r.labels.includes('Ridge board')));
  // Rafters are not pressure treated just because a bottom plate is.
  assert.ok(rows.filter((r) => r.treated).every((r) => r.labels.includes('Bottom plate')));
  assert.ok(boardFeet(rows) > 0);
});

test('impossible roofs throw with a useful message', () => {
  assert.throws(() => layoutRoof(defaultRoof({ pitch: 0 })), /pitch/);
  assert.throws(() => layoutRoof(defaultRoof({ overhang: -6 })), /Overhang/);
  // Too narrow to get a birdsmouth seat on each wall.
  assert.throws(() => layoutRoof(defaultRoof({ type: 'shed', span: 6 })), /too narrow/);
  assert.throws(() => layoutRoof(defaultRoof({ type: 'gable', span: 8 })), /too narrow/);
});

// ── Floor ────────────────────────────────────────────────────────────────────

test('joists land on the layout grid so decking seams fall on one', () => {
  const f = layoutFloor(defaultFloor({ width: 144, depth: 96, joistAxis: 'depth' }));
  for (const seam of [48, 96]) {
    assert.ok(f.joistCenters.includes(seam), `no joist at the ${seam}" seam`);
  }
  // End joists sit flush with the floor edges, same rule as studs and rafters.
  assert.equal(f.joistCenters[0], 0.75);
  assert.equal(f.joistCenters[f.joistCenters.length - 1], 144 - 0.75);
});

test('rim joists run the full length and the joists butt between them', () => {
  const f = layoutFloor(defaultFloor({ width: 144, depth: 96, joistAxis: 'depth' }));
  assert.equal(f.joistLength, 96 - 3);

  const rims = f.members.filter((m) => m.role === 'rim-joist');
  assert.equal(rims.reduce((s, m) => s + m.length, 0), 2 * 144);
  // Joists run the depth, rims run the width — the box closes.
  const joist = f.members.find((m) => m.role === 'joist')!;
  assert.ok(joist.d > joist.w, 'joists should run along the depth');
  assert.ok(rims[0].w > rims[0].d, 'rim joists should run along the width');
  assert.equal(joist.y, 1.5, 'joist should start at the inside face of the rim');
  assert.equal(joist.y + joist.d, 96 - 1.5);
});

test('skids cross the joists and set their real span', () => {
  const f = layoutFloor(
    defaultFloor({ width: 144, depth: 96, joistAxis: 'depth', skidSize: '4x6', skidCount: 3 }),
  );
  assert.equal(f.skidCenters.length, 3);
  // Outer skids flush with the edges, evenly spaced across the joist run.
  assert.equal(f.skidCenters[0], 5.5 / 2);
  assert.equal(f.skidCenters[2], 96 - 5.5 / 2);
  assert.equal(f.skidCenters[1], 48);
  // The span the table cares about is the CLEAR gap between skids, not the
  // building dimension.
  assert.equal(f.joistSpan, f.skidCenters[1] - f.skidCenters[0] - 5.5);
  assert.ok(f.joistSpan < 96, 'joist span must not be the whole floor depth');

  const skid = f.members.find((m) => m.role === 'skid')!;
  assert.ok(skid.w > skid.d, 'skids should run across the width, perpendicular to the joists');
  assert.equal(skid.elevBottom, 0, 'skids sit on the bearing plane');
  assert.equal(skid.elevHeight, ACTUAL['4x6'].thickness, 'skids lie wide face down');
});

test('the deck lands on top of the skids plus the joists', () => {
  const f = layoutFloor(defaultFloor({ skidSize: '4x6', joistSize: '2x8' }));
  assert.equal(f.deckHeight, ACTUAL['4x6'].thickness + ACTUAL['2x8'].width);
  for (const m of f.members.filter((m) => m.role !== 'skid')) {
    assert.equal(m.elevBottom, ACTUAL['4x6'].thickness, `${m.label} should bear on the skids`);
  }
});

test('span table lookup, and too few skids warns with a count that works', () => {
  assert.equal(maxJoistSpan('2x6', 16), 106);
  assert.equal(maxJoistSpan('2x8', 24), 114);
  assert.equal(maxJoistSpan('2x4', 16), undefined);

  const thin = layoutFloor(
    defaultFloor({ width: 144, depth: 192, joistAxis: 'depth', joistSize: '2x6', skidCount: 2 }),
  );
  assert.ok(thin.joistSpan > thin.allowedSpan);
  assert.ok(thin.warnings.some((w) => w.includes('clear-span')));
  // It names 3 skids as the fix — so 3 skids must actually clear the limit.
  assert.ok(thin.warnings.some((w) => w.includes('3 skids')));
  const fixed = layoutFloor(
    defaultFloor({ width: 144, depth: 192, joistAxis: 'depth', joistSize: '2x6', skidCount: 3 }),
  );
  assert.ok(fixed.joistSpan <= fixed.allowedSpan);
  assert.ok(!fixed.warnings.some((w) => w.includes('clear-span')));
});

test('an unlisted joist size says the span went unchecked rather than passing it', () => {
  const f = layoutFloor(defaultFloor({ joistSize: '2x4' }));
  assert.equal(f.allowedSpan, undefined);
  assert.ok(f.warnings.some((w) => w.includes('unchecked')));
});

test('setting the skids in cantilevers the floor, and says when that is too far', () => {
  const flush = layoutFloor(defaultFloor({ depth: 96, skidInset: 0 }));
  assert.equal(flush.cantilever, 0);
  assert.ok(!flush.warnings.some((w) => w.includes('cantilever')));

  const inset = layoutFloor(defaultFloor({ depth: 96, skidInset: 12, skidCount: 3 }));
  assert.equal(inset.cantilever, 12);
  assert.ok(inset.skidCenters[0] > flush.skidCenters[0], 'skids should move inboard');
  assert.ok(12 > inset.joistSpan / 4, 'this inset is past the quarter-span guideline');
  assert.ok(inset.warnings.some((w) => w.includes('cantilever')));
});

test('joistAxis swaps which way the joists run', () => {
  const acrossDepth = layoutFloor(defaultFloor({ width: 144, depth: 96, joistAxis: 'depth' }));
  const acrossWidth = layoutFloor(defaultFloor({ width: 144, depth: 96, joistAxis: 'width' }));
  assert.equal(acrossDepth.joistLength, 96 - 3);
  assert.equal(acrossWidth.joistLength, 144 - 3);
  // Skids always cross the joists, so they swap too.
  const skid = (f: typeof acrossDepth) => f.members.find((m) => m.role === 'skid')!;
  assert.ok(skid(acrossDepth).w > skid(acrossDepth).d);
  assert.ok(skid(acrossWidth).d > skid(acrossWidth).w);
  // Longer joists over the same skid count means a longer span.
  assert.ok(acrossWidth.joistSpan > acrossDepth.joistSpan);
});

test('blocking fits between the joists without touching them', () => {
  const f = layoutFloor(defaultFloor({ width: 144, depth: 96, blockingRows: 1 }));
  const blocks = f.members.filter((m) => m.role === 'blocking');
  assert.equal(blocks.length, f.joistCenters.length - 1, 'one piece per bay');
  for (let i = 1; i < f.joistCenters.length; i++) {
    const bay = f.joistCenters[i] - f.joistCenters[i - 1] - 1.5;
    assert.ok(blocks.some((b) => Math.abs(b.length - bay) < 1e-9), `no block for a ${bay}" bay`);
  }
  assert.equal(layoutFloor(defaultFloor({ blockingRows: 0 })).members.filter(
    (m) => m.role === 'blocking').length, 0);
});

test('rim joists splice over a joist center', () => {
  const f = layoutFloor(defaultFloor({ width: 240, depth: 96, maxStock: 192 }));
  const rims = f.members.filter((m) => m.role === 'rim-joist');
  assert.ok(rims.length > 2, 'a 20′ rim should be spliced against 16′ stock');
  for (const piece of rims) assert.ok(piece.length <= 192);
  assert.ok(f.joistCenters.includes(rims[0].length), 'splice does not land on a joist');
  // Skids are ground beams — splicing one is allowed but has to be called out.
  assert.ok(f.warnings.some((w) => w.includes('block or pier')));
});

test('no two floor members occupy the same space in 3D', () => {
  const f = layoutFloor(
    defaultFloor({ width: 144, depth: 96, skidCount: 4, blockingRows: 2, joistSize: '2x8' }),
  );
  const ms = f.members;
  for (let i = 0; i < ms.length; i++) {
    for (let j = i + 1; j < ms.length; j++) {
      const a = ms[i];
      const b = ms[j];
      const x = a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9;
      const y = a.y < b.y + b.d - 1e-9 && b.y < a.y + a.d - 1e-9;
      const z =
        a.elevBottom < b.elevBottom + b.elevHeight - 1e-9 &&
        b.elevBottom < a.elevBottom + a.elevHeight - 1e-9;
      assert.ok(!(x && y && z), `${a.id} (${a.label}) and ${b.id} (${b.label}) collide`);
    }
  }
});

test('the floor frames to the shed footprint and reaches the cut list', () => {
  const shed = layoutShed(defaultShed({ width: 144, depth: 96 }));
  const floor = shed.floor;
  assert.equal(floor.spec.width, 144);
  assert.equal(floor.spec.depth, 96);

  const rows = cutList([...shed.walls, shed.roof, floor]);
  const total =
    shed.walls.reduce((s, w) => s + w.members.length, 0) +
    shed.roof.members.length +
    floor.members.length;
  assert.equal(rows.reduce((s, r) => s + r.qty, 0), total, 'cut list lost or invented pieces');
  assert.ok(rows.some((r) => r.labels.includes('Skid')));
  assert.ok(rows.some((r) => r.labels.includes('Rim joist')));
});

test('skids are always treated; the rest of the floor is optional', () => {
  const wet = layoutFloor(defaultFloor({ treatedJoists: true }));
  assert.ok(wet.members.every((m) => m.treated));

  const dry = layoutFloor(defaultFloor({ treatedJoists: false }));
  assert.ok(dry.members.filter((m) => m.role === 'skid').every((m) => m.treated),
    'skids are in ground contact whatever the joists are');
  assert.ok(dry.members.filter((m) => m.role === 'joist').every((m) => !m.treated));
  // Treated and untreated pieces of the same size never merge in the cut list.
  const rows = cutList([dry]);
  assert.ok(rows.some((r) => r.treated) && rows.some((r) => !r.treated));
});

test('overall height stacks the floor, the walls, and the roof', () => {
  const shed = layoutShed(defaultShed({ width: 144, depth: 96, wallHeight: 96 }));
  assert.equal(
    shed.overallHeight,
    shed.floor.deckHeight + 96 + shed.roof.peakHeight,
  );

  // A slab shed has no framed floor and loses exactly the deck height.
  const slab = layoutShed(defaultShed({ width: 144, depth: 96, wallHeight: 96, floor: null }));
  assert.equal(slab.floor, undefined);
  assert.equal(slab.overallHeight, shed.overallHeight - shed.floor.deckHeight);
  assert.equal(cutList([slab.roof]).reduce((s, r) => s + r.qty, 0), slab.roof.members.length);
});

test('impossible floors throw with a useful message', () => {
  assert.throws(() => layoutFloor(defaultFloor({ skidCount: 1 })), /two skids/);
  assert.throws(() => layoutFloor(defaultFloor({ skidInset: -4 })), /inset cannot be negative/);
  assert.throws(() => layoutFloor(defaultFloor({ blockingRows: -1 })), /Blocking rows/);
  // Inset so far the skids meet in the middle.
  assert.throws(() => layoutFloor(defaultFloor({ depth: 96, skidInset: 60 })), /no room/);
  // Too small to get a joist between the rim joists.
  assert.throws(() => layoutFloor(defaultFloor({ depth: 2 })), /too small/);
});

test('impossible openings throw with a useful message', () => {
  const wall = (openings: Parameters<typeof defaultWallSpec>[0]['openings']) =>
    layoutWall(defaultWallSpec({ name: 'W', length: 144, openings }));
  // overlapping king studs
  assert.throws(() => wall([
    { name: 'a', kind: 'door', center: 60, roWidth: 38, roHeight: 82 },
    { name: 'b', kind: 'door', center: 100, roWidth: 38, roHeight: 82 },
  ]), /overlap/);
  // runs into the corner post
  assert.throws(() => wall([
    { name: 'a', kind: 'door', center: 20, roWidth: 38, roHeight: 82 },
  ]), /corner post/);
  // window without a sill height
  assert.throws(() => wall([
    { name: 'a', kind: 'window', center: 72, roWidth: 30, roHeight: 40 },
  ]), /sillHeight/);
  // too tall for the header to fit under the top plate
  assert.throws(() => wall([
    { name: 'a', kind: 'door', center: 72, roWidth: 38, roHeight: 90 },
  ]), /doesn't fit/);
});
