/**
 * Shed framing engine — core geometry + layout.
 *
 * Copyright (C) 2026 Mark Escher
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or (at your
 * option) any later version. It is distributed in the hope that it will be
 * useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero
 * General Public License for more details: <https://www.gnu.org/licenses/>.
 *
 * NOT AN ENGINEERING TOOL. Nothing here sizes a member for load. See the
 * caveats in README.md before building anything from its output.
 *
 * Everything here is pure: no DOM, no React, no I/O. That keeps it reusable
 * from a web UI today and a React Native UI later.
 *
 * UNITS: all lengths are inches (decimal). Format for display with formatLength().
 *
 * WALL LOCAL FRAME (plan view, looking down):
 *   x = along the wall's length, 0 at its left end as viewed from OUTSIDE
 *   y = across the wall's thickness, 0 at the EXTERIOR face
 * So a standard 2x4 stud on edge occupies w=1.5 (along x), d=3.5 (along y).
 */

// ─────────────────────────────────────────────────────────────────────────────
// Lumber
// ─────────────────────────────────────────────────────────────────────────────

export type NominalSize = '2x4' | '2x6' | '2x8' | '2x10' | '2x12' | '4x4' | '4x6' | '6x6';

/** Actual (surfaced) dimensions in inches: thickness x width. */
export const ACTUAL: Record<NominalSize, { thickness: number; width: number }> = {
  '2x4': { thickness: 1.5, width: 3.5 },
  '2x6': { thickness: 1.5, width: 5.5 },
  '2x8': { thickness: 1.5, width: 7.25 },
  '2x10': { thickness: 1.5, width: 9.25 },
  '2x12': { thickness: 1.5, width: 11.25 },
  '4x4': { thickness: 3.5, width: 3.5 },
  '4x6': { thickness: 3.5, width: 5.5 },
  '6x6': { thickness: 5.5, width: 5.5 },
};

/** Lengths lumber is commonly sold in, inches. */
export const STOCK_LENGTHS = [96, 120, 144, 168, 192, 240];

// ─────────────────────────────────────────────────────────────────────────────
// Unit formatting
// ─────────────────────────────────────────────────────────────────────────────

/** 13.375 -> `13-3/8"` */
export function formatInches(value: number, denom = 16): string {
  const neg = value < 0;
  const v = Math.abs(value);
  const whole = Math.floor(v + 1e-9);
  let num = Math.round((v - whole) * denom);
  let den = denom;
  let w = whole;
  if (num === den) {
    w += 1;
    num = 0;
  }
  while (num > 0 && num % 2 === 0 && den % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  const sign = neg ? '-' : '';
  if (num === 0) return `${sign}${w}"`;
  if (w === 0) return `${sign}${num}/${den}"`;
  return `${sign}${w}-${num}/${den}"`;
}

/** 92.625 -> `7' 8-5/8"` */
export function formatLength(value: number, denom = 16): string {
  const neg = value < 0;
  const v = Math.abs(value);
  const feet = Math.floor(v / 12);
  const rem = v - feet * 12;
  const sign = neg ? '-' : '';
  if (feet === 0) return `${sign}${formatInches(rem, denom)}`;
  if (Math.abs(rem) < 1 / (denom * 2)) return `${sign}${feet}'`;
  return `${sign}${feet}' ${formatInches(rem, denom)}`;
}

/** Accepts 8, "8'", "8ft", `8' 6"`, `102`, `102in`, `8-6`. Returns inches. */
export function parseLength(input: string | number): number {
  if (typeof input === 'number') return input;
  const s = input.trim().toLowerCase().replace(/\s+/g, ' ');
  const feetIn = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(?:([\d./ -]+)\s*(?:"|in|inch(?:es)?)?)?$/);
  if (feetIn) return Number(feetIn[1]) * 12 + (feetIn[2] ? parseInches(feetIn[2]) : 0);
  return parseInches(s.replace(/(?:"|in|inch(?:es)?)$/, ''));
}

function parseInches(s: string): number {
  const t = s.trim();
  if (!t) return 0;
  const mixed = t.match(/^(\d+)[\s-](\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MemberRole =
  | 'stud'
  | 'corner-stud'
  | 'corner-nailer'
  | 'king-stud'
  | 'jack-stud'
  | 'header'
  | 'sill'
  | 'cripple'
  | 'bottom-plate'
  | 'top-plate'
  | 'cap-plate'
  | 'rafter'
  | 'ridge-board'
  | 'skid'
  | 'joist'
  | 'rim-joist'
  | 'blocking';

export interface Member {
  id: string;
  role: MemberRole;
  label: string;
  size: NominalSize;
  /** Cut length of this piece, inches. */
  length: number;
  /** Plan-view footprint in the wall's local frame. */
  x: number;
  y: number;
  w: number;
  d: number;
  /** Elevation: bottom of the piece above the bottom of the wall, inches. */
  elevBottom: number;
  /** Elevation: vertical extent of the piece, inches. */
  elevHeight: number;
  /** For full-height studs: center position along the wall, inches from the left end. */
  center?: number;
  /** True for pieces that lie flat (wide face against the wall face). */
  flat?: boolean;
  /** Pressure-treated: in contact with the ground, a slab, or a foundation. */
  treated?: boolean;
  note?: string;
}

/**
 * How the corner post is built. Names count the TOTAL studs meeting at that
 * corner, across both walls.
 *
 * Corner detailing has regional variants — these are the three common ones.
 * All coordinates are documented in cornerPost() so they're easy to adjust.
 */
export type CornerType = 'two-stud' | 'three-stud' | 'four-stud';

/**
 * 'through' walls run the full outside dimension; 'butt' walls fit between
 * them and are therefore 2 × wall thickness shorter.
 */
export type WallRole = 'through' | 'butt';

/**
 * Where stud layout is measured from.
 *  - 'building-corner': centers land on multiples of the spacing measured from
 *    the OUTSIDE corner of the building, so sheathing seams line up across the
 *    corner. Correct when sheathing wraps the corner.
 *  - 'wall-end': centers measured from this wall's own end. Correct when each
 *    wall is sheathed separately, flush to its ends.
 */
export type LayoutReference = 'building-corner' | 'wall-end';

export interface OpeningSpec {
  name: string;
  kind: 'door' | 'window';
  /** Center of the rough opening along the wall, inches from its left end. */
  center: number;
  /** Rough opening width, inches. Sizing the RO from the unit is on you:
   *  typically unit + 2" (1" shim gap each side), but check the unit's spec. */
  roWidth: number;
  /**
   * Rough opening height, inches — the vertical size of the RO.
   * Doors: measured from the BOTTOM of the wall; the bottom plate runs through
   * the opening while framing and is cut out after the wall is standing.
   * Windows: the RO starts at sillHeight and runs up roHeight from there.
   */
  roHeight: number;
  /** Windows only: bottom of the RO above the bottom of the wall, inches. */
  sillHeight?: number;
  /** Override the header table for this one opening. */
  headerSize?: NominalSize;
}

export interface HeaderRule {
  /** Largest clear span this header size is good for, inches. */
  maxSpan: number;
  size: NominalSize;
}

/**
 * CONVENTION, NOT ENGINEERING. A common shed-grade rule of thumb for a doubled
 * 2x header under a light roof load. Header sizing varies with snow load,
 * roof span, and local code — treat this as a starting point and swap in your
 * own table (WallSpec.headerTable) or per-opening override (OpeningSpec.headerSize)
 * against real span tables before building.
 */
export const DEFAULT_HEADER_TABLE: HeaderRule[] = [
  { maxSpan: 48, size: '2x6' },
  { maxSpan: 60, size: '2x8' },
  { maxSpan: 72, size: '2x10' },
  { maxSpan: 96, size: '2x12' },
];

/** Smallest header size in the table rated for the span; undefined if none is. */
export function headerSizeFor(
  span: number,
  table: HeaderRule[] = DEFAULT_HEADER_TABLE,
): NominalSize | undefined {
  const rule = [...table].sort((a, b) => a.maxSpan - b.maxSpan).find((r) => span <= r.maxSpan);
  return rule?.size;
}

/** An opening as placed by layoutWall — RO rectangle in wall coordinates. */
export interface FramedOpening {
  spec: OpeningSpec;
  roLeft: number;
  roRight: number;
  /** Elevation of the RO bottom above the bottom of the wall (0 for doors). */
  roBottom: number;
  roTop: number;
  headerSize: NominalSize;
}

export interface WallSpec {
  name: string;
  role: WallRole;
  /** Overall length of THIS wall's plates, inches. */
  length: number;
  /** Finished wall height, plate bottom to plate top, inches. */
  height: number;
  studSize: NominalSize;
  /** 16 or 24, on center. */
  spacing: number;
  cornerType: CornerType;
  doubleTopPlate: boolean;
  layoutReference: LayoutReference;
  /** Inches this wall is inset from the building corner at each end (butt walls). */
  cornerInset: number;
  /** Longest stick available for plates. */
  maxStock: number;
  treatedBottomPlate: boolean;
  /** Doors and windows in this wall. */
  openings: OpeningSpec[];
  /** Span → header size lookup. Swap in your own against local code. */
  headerTable: HeaderRule[];
}

export interface WallFraming {
  spec: WallSpec;
  thickness: number;
  studLength: number;
  members: Member[];
  /** Centers of every full-height stud, left to right. */
  studCenters: number[];
  /** Openings as placed, with resolved RO rectangles and header sizes. */
  openings: FramedOpening[];
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Corner posts
// ─────────────────────────────────────────────────────────────────────────────

/** A piece of a corner post, positioned in the wall's local frame. */
interface CornerPiece {
  x: number;
  w: number;
  y: number;
  d: number;
  flat: boolean;
  role: 'corner-stud' | 'corner-nailer';
  note: string;
}

/**
 * Corner post pieces belonging to ONE wall at ONE end.
 *
 * Butt walls always get a single plain end stud — the extra nailers live in the
 * through wall, which is the one that actually forms the outside corner.
 *
 * Through-wall geometry at the LEFT end (t = wall thickness, s = stud thickness):
 *
 *  two-stud    end stud only. Minimum lumber, maximum insulation cavity.
 *              Fine for an unfinished shed.
 *
 *  three-stud  end stud + one stud laid FLAT against the interior face,
 *              running x 1.5 → 5.0. It projects 1.5" past the butt wall's
 *              interior face (x = 3.5), giving interior sheathing a nailer.
 *
 *  four-stud   end stud + doubled stud + flat nailer. Solid post — stiffest,
 *              most lumber, smallest insulation cavity.
 */
export function cornerPost(
  wallRole: WallRole,
  cornerType: CornerType,
  thickness: number,
  studThickness = 1.5,
): CornerPiece[] {
  const end: CornerPiece = {
    x: 0,
    w: studThickness,
    y: 0,
    d: thickness,
    flat: false,
    role: 'corner-stud',
    note: 'End stud, flush with wall end',
  };

  if (wallRole === 'butt') return [end];

  const nailer = (x: number): CornerPiece => ({
    x,
    w: thickness,
    y: thickness - studThickness,
    d: studThickness,
    flat: true,
    role: 'corner-nailer',
    note: 'Laid flat against interior face — nailer for interior sheathing',
  });

  switch (cornerType) {
    case 'two-stud':
      return [end];
    case 'three-stud':
      return [end, nailer(studThickness)];
    case 'four-stud':
      return [
        end,
        { ...end, x: studThickness, role: 'corner-stud', note: 'Doubled corner stud' },
        nailer(studThickness * 2),
      ];
  }
}

/** How far the corner post reaches in from the wall end. */
function cornerFootprint(pieces: CornerPiece[]): number {
  return pieces.reduce((m, p) => Math.max(m, p.x + p.w), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Plate splicing
// ─────────────────────────────────────────────────────────────────────────────

export interface PlatePiece {
  length: number;
  start: number;
}

/**
 * Break a plate into pieces no longer than maxStock, splicing only over a stud
 * center so both ends land on solid bearing.
 */
export function splicePlate(
  totalLength: number,
  studCenters: number[],
  maxStock: number,
): PlatePiece[] {
  if (totalLength <= maxStock) return [{ length: totalLength, start: 0 }];
  const pieces: PlatePiece[] = [];
  let start = 0;
  while (totalLength - start > maxStock) {
    const limit = start + maxStock;
    const cut = [...studCenters].reverse().find((c) => c > start && c <= limit);
    if (cut === undefined) {
      pieces.push({ length: maxStock, start });
      start += maxStock;
    } else {
      pieces.push({ length: cut - start, start });
      start = cut;
    }
  }
  pieces.push({ length: totalLength - start, start });
  return pieces;
}

// ─────────────────────────────────────────────────────────────────────────────
// Wall layout
// ─────────────────────────────────────────────────────────────────────────────

export function defaultWallSpec(partial: Partial<WallSpec> & { name: string; length: number }): WallSpec {
  return {
    role: 'through',
    height: 96,
    studSize: '2x4',
    spacing: 16,
    cornerType: 'three-stud',
    doubleTopPlate: true,
    layoutReference: 'building-corner',
    cornerInset: 0,
    maxStock: 192,
    treatedBottomPlate: true,
    openings: [],
    headerTable: DEFAULT_HEADER_TABLE,
    ...partial,
  };
}

export function layoutWall(spec: WallSpec): WallFraming {
  const warnings: string[] = [];
  const t = ACTUAL[spec.studSize].width; // wall thickness
  const s = ACTUAL[spec.studSize].thickness; // 1.5 for 2x stock
  const L = spec.length;

  const plateCount = spec.doubleTopPlate ? 3 : 2;
  const studLength = spec.height - plateCount * s;
  if (studLength <= 0) throw new Error(`Wall height ${spec.height}" is too short for its plates.`);

  const members: Member[] = [];
  let n = 0;
  const push = (m: Omit<Member, 'id'>) => members.push({ id: `${spec.name}-${++n}`, ...m });

  // ── Corner posts ──────────────────────────────────────────────────────────
  const leftPieces = cornerPost(spec.role, spec.cornerType, t, s);
  const rightPieces = cornerPost(spec.role, spec.cornerType, t, s);
  const leftClear = cornerFootprint(leftPieces);
  const rightClear = L - cornerFootprint(rightPieces);

  for (const p of leftPieces) {
    push({
      role: p.role,
      label: p.flat ? 'Corner nailer (flat)' : 'Corner stud',
      size: spec.studSize,
      length: studLength,
      x: p.x,
      y: p.y,
      w: p.w,
      d: p.d,
      elevBottom: s,
      elevHeight: studLength,
      center: p.flat ? undefined : p.x + p.w / 2,
      flat: p.flat,
      note: `Left end — ${p.note}`,
    });
  }
  for (const p of rightPieces) {
    const x = L - p.x - p.w; // mirrored
    push({
      role: p.role,
      label: p.flat ? 'Corner nailer (flat)' : 'Corner stud',
      size: spec.studSize,
      length: studLength,
      x,
      y: p.y,
      w: p.w,
      d: p.d,
      elevBottom: s,
      elevHeight: studLength,
      center: p.flat ? undefined : x + p.w / 2,
      flat: p.flat,
      note: `Right end — ${p.note}`,
    });
  }

  // ── Openings ──────────────────────────────────────────────────────────────
  // King studs flank the RO (full height), jacks carry the header at the RO
  // edges, the header spans jack to jack. Cripples above the header — and
  // below a window's sill — stay on the o.c. grid so sheathing nailing lines
  // continue through the opening.
  const offset = spec.layoutReference === 'building-corner' ? spec.cornerInset : 0;
  const studTop = s + studLength; // elevation of the top of the stud run

  /** Grid centers whose footprint fits entirely inside [lo, hi]. */
  const gridCenters = (lo: number, hi: number): number[] => {
    const out: number[] = [];
    for (let k = 1; ; k++) {
      const c = k * spec.spacing - offset;
      if (c - s / 2 > hi + 1e-9) break;
      if (c - s / 2 >= lo - 1e-9 && c + s / 2 <= hi + 1e-9) out.push(c);
    }
    return out;
  };

  const framedOpenings: FramedOpening[] = [];
  const zones: { left: number; right: number }[] = [];
  const sortedOpenings = [...spec.openings].sort((a, b) => a.center - b.center);

  for (const o of sortedOpenings) {
    const roLeft = o.center - o.roWidth / 2;
    const roRight = o.center + o.roWidth / 2;
    if (o.kind === 'window' && o.sillHeight === undefined) {
      throw new Error(`${spec.name} / ${o.name}: a window needs sillHeight.`);
    }
    const roBottom = o.kind === 'door' ? 0 : (o.sillHeight as number);
    const roTop = roBottom + o.roHeight;

    let headerSize = o.headerSize;
    if (!headerSize) {
      headerSize = headerSizeFor(o.roWidth, spec.headerTable);
      if (!headerSize) {
        const bySpan = [...spec.headerTable].sort((a, b) => a.maxSpan - b.maxSpan);
        const largest = bySpan[bySpan.length - 1];
        if (!largest) throw new Error(`${spec.name} / ${o.name}: empty header table and no headerSize override.`);
        headerSize = largest.size;
        warnings.push(
          `${spec.name} / ${o.name}: ${formatLength(o.roWidth)} span is beyond the header table — ` +
            `drawn with a doubled ${headerSize}, but this wants an engineered header.`,
        );
      }
    }
    const headerH = ACTUAL[headerSize].width;

    // Jack + king at each side extend the assembly 2 stud thicknesses past the RO.
    const zone = { left: roLeft - 2 * s, right: roRight + 2 * s };
    if (zone.left < leftClear - 1e-9 || zone.right > rightClear + 1e-9) {
      throw new Error(`${spec.name} / ${o.name}: opening (plus its king studs) runs into the corner post.`);
    }
    const prevZone = zones[zones.length - 1];
    if (prevZone && zone.left < prevZone.right - 1e-9) {
      throw new Error(`${spec.name}: openings overlap — their king studs collide.`);
    }
    if (roTop + headerH > studTop + 1e-9) {
      throw new Error(
        `${spec.name} / ${o.name}: RO top at ${formatLength(roTop)} plus a ${headerSize} header ` +
          `doesn't fit under the top plate (studs top out at ${formatLength(studTop)}).`,
      );
    }
    if (o.kind === 'window' && roBottom < 2 * s) {
      throw new Error(
        `${spec.name} / ${o.name}: sillHeight ${formatLength(roBottom)} leaves no room for the sill above the bottom plate.`,
      );
    }
    zones.push(zone);
    framedOpenings.push({ spec: o, roLeft, roRight, roBottom, roTop, headerSize });

    // King studs — full height, flush against the jacks. They join studCenters,
    // so plates may splice over them and they show in the dimension string.
    for (const [x, side] of [
      [zone.left, 'left'],
      [roRight + s, 'right'],
    ] as const) {
      push({
        role: 'king-stud',
        label: 'King stud',
        size: spec.studSize,
        length: studLength,
        x, y: 0, w: s, d: t,
        elevBottom: s,
        elevHeight: studLength,
        center: x + s / 2,
        flat: false,
        note: `${o.name} — ${side} king stud, full height`,
      });
    }

    // Jack (trimmer) studs — stand on the bottom plate, stop at the RO top,
    // carry the header. Doors and windows alike: jacks run full length and the
    // window sill fits between them.
    const jackLength = roTop - s;
    for (const [x, side] of [
      [roLeft - s, 'left'],
      [roRight, 'right'],
    ] as const) {
      push({
        role: 'jack-stud',
        label: 'Jack stud',
        size: spec.studSize,
        length: jackLength,
        x, y: 0, w: s, d: t,
        elevBottom: s,
        elevHeight: jackLength,
        flat: false,
        note: `${o.name} — ${side} jack, header bears at ${formatLength(roTop)}`,
      });
    }

    // Header — doubled 2x on edge with a ½" plywood spacer to match a 3.5"
    // wall. See DEFAULT_HEADER_TABLE for the sizing caveat.
    const headerLength = o.roWidth + 2 * s;
    const flushNote =
      t > 3.5 ? ` In a ${spec.studSize} wall, set flush to the exterior and furr or insulate the interior gap.` : '';
    for (const [y, ply] of [
      [0, 'exterior'],
      [s + 0.5, 'interior'],
    ] as const) {
      push({
        role: 'header',
        label: 'Header',
        size: headerSize,
        length: headerLength,
        x: roLeft - s, y, w: headerLength, d: s,
        elevBottom: roTop,
        elevHeight: headerH,
        flat: false,
        note: `${o.name} — ${ply} ply. Doubled ${headerSize} with ½" plywood spacer.${flushNote}`,
      });
    }

    // Cripples above the header, on the layout grid, between the kings.
    const crippleLength = studTop - (roTop + headerH);
    if (crippleLength > 1e-9) {
      for (const c of gridCenters(roLeft - s, roRight + s)) {
        push({
          role: 'cripple',
          label: 'Cripple',
          size: spec.studSize,
          length: crippleLength,
          x: c - s / 2, y: 0, w: s, d: t,
          elevBottom: roTop + headerH,
          elevHeight: crippleLength,
          flat: false,
          note: `${o.name} — above the header, on the ${spec.spacing}" grid`,
        });
      }
    }

    if (o.kind === 'window') {
      // Rough sill — a single flat 2x directly under the RO, between the jacks.
      // Doubling the sill is common for wide windows; single is typical shed practice.
      push({
        role: 'sill',
        label: 'Rough sill',
        size: spec.studSize,
        length: o.roWidth,
        x: roLeft, y: 0, w: o.roWidth, d: t,
        elevBottom: roBottom - s,
        elevHeight: s,
        flat: true,
        note: `${o.name} — flat 2x sill under the RO`,
      });
      // Cripples below the sill, bottom plate up to the sill.
      const lowerLength = roBottom - 2 * s;
      if (lowerLength > 1e-9) {
        for (const c of gridCenters(roLeft, roRight)) {
          push({
            role: 'cripple',
            label: 'Cripple',
            size: spec.studSize,
            length: lowerLength,
            x: c - s / 2, y: 0, w: s, d: t,
            elevBottom: s,
            elevHeight: lowerLength,
            flat: false,
            note: `${o.name} — below the sill, on the ${spec.spacing}" grid`,
          });
        }
      }
    }
  }

  if (sortedOpenings.some((o) => o.kind === 'door')) {
    warnings.push(
      `${spec.name}: the bottom plate runs through door openings — cut it out after the wall is standing.`,
    );
  }

  // ── Field studs ───────────────────────────────────────────────────────────
  // Centers land on exact multiples of the spacing so 4' sheathing seams fall
  // dead center on a stud. `offset` shifts the origin to the building corner
  // for butt walls, keeping seams aligned around the corner. Studs that would
  // land inside an opening assembly give way to it.
  const fieldCenters: number[] = [];
  for (let k = 1; ; k++) {
    const center = k * spec.spacing - offset;
    if (center - s / 2 >= rightClear) break;
    if (center - s / 2 < leftClear) continue;
    if (zones.some((z) => center + s / 2 > z.left + 1e-9 && center - s / 2 < z.right - 1e-9)) continue;
    fieldCenters.push(center);
  }

  for (const center of fieldCenters) {
    push({
      role: 'stud',
      label: 'Stud',
      size: spec.studSize,
      length: studLength,
      x: center - s / 2,
      y: 0,
      w: s,
      d: t,
      elevBottom: s,
      elevHeight: studLength,
      center,
      flat: false,
      note: `${spec.spacing}" O.C.`,
    });
  }

  const lastField = fieldCenters[fieldCenters.length - 1];
  if (lastField !== undefined) {
    const gap = rightClear - (lastField + s / 2);
    if (gap > 0 && gap < 1) {
      warnings.push(
        `${spec.name}: last regular stud sits ${formatInches(gap)} from the corner post. ` +
          `Common practice is to leave it out and let the corner post do the work.`,
      );
    }
  }

  const studCenters = members
    .filter((m) => m.center !== undefined)
    .map((m) => m.center as number)
    .sort((a, b) => a - b);

  // ── Plates ────────────────────────────────────────────────────────────────
  const plateElev: Partial<Record<MemberRole, number>> = {
    'bottom-plate': 0,
    'top-plate': s + studLength,
    'cap-plate': s + studLength + s,
  };
  const addPlate = (role: MemberRole, label: string, len: number, note: string, xOffset = 0) => {
    for (const piece of splicePlate(len, studCenters, spec.maxStock)) {
      push({
        role,
        label,
        size: spec.studSize,
        length: piece.length,
        x: xOffset + piece.start,
        y: 0,
        w: piece.length,
        d: t,
        elevBottom: plateElev[role] ?? 0,
        elevHeight: s,
        flat: false,
        treated: role === 'bottom-plate' && spec.treatedBottomPlate,
        note,
      });
    }
  };

  addPlate(
    'bottom-plate',
    'Bottom plate',
    L,
    spec.treatedBottomPlate ? 'Pressure-treated — in contact with the foundation' : '',
  );
  addPlate('top-plate', 'Top plate', L, 'Lower of the two top plates');

  if (spec.doubleTopPlate) {
    // The cap plate laps the corner: through walls hold back by one wall
    // thickness at each end, butt walls run long to cover the gap.
    const capLength = spec.role === 'through' ? L - 2 * t : L + 2 * t;
    addPlate(
      'cap-plate',
      'Cap plate',
      capLength,
      spec.role === 'through'
        ? `Held back ${formatInches(t)} at each end so the side-wall caps lap over`
        : `Runs ${formatInches(t)} long at each end to lap over the through walls`,
      spec.role === 'through' ? t : -t,
    );
  }

  if (spec.length > spec.maxStock) {
    warnings.push(
      `${spec.name}: plates are spliced. Stagger the cap-plate splices at least 4' ` +
        `from the top-plate splices below them.`,
    );
  }

  return { spec, thickness: t, studLength, members, studCenters, openings: framedOpenings, warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// Roof
//
// ROOF SECTION FRAME (looking along the ridge, at one rafter):
//   x = horizontal across the span, 0 at the LOW (or left) wall's EXTERIOR face
//   y = vertical, 0 at the TOP OF THE TOP PLATE of that wall, up positive
// So a rafter tail dips to negative y, and the ridge sits at positive y.
//
// Common rafters only. No hips, no dormers, no rake (gable-end) overhang, and
// no gable-end wall framing — those are each their own geometry problem.
// ─────────────────────────────────────────────────────────────────────────────

export type RoofType = 'gable' | 'shed';

const TWO_BY: NominalSize[] = ['2x4', '2x6', '2x8', '2x10', '2x12'];

/** The next nominal 2x size deeper than `size` (deepest available if at the top). */
export function deeperSize(size: NominalSize): NominalSize {
  const i = TWO_BY.indexOf(size);
  if (i < 0) return size;
  return TWO_BY[Math.min(i + 1, TWO_BY.length - 1)];
}

export interface RoofSpec {
  type: RoofType;
  /** Rise in inches per 12" of run. A "4/12 roof" is pitch: 4. */
  pitch: number;
  /** Horizontal span the roof crosses, wall exterior face to wall exterior face. */
  span: number;
  /** Building dimension parallel to the ridge (across the rafter run). */
  length: number;
  rafterSize: NominalSize;
  /** Rafter spacing, on center. */
  spacing: number;
  /** Horizontal eave overhang past the wall's exterior face, at every eave. */
  overhang: number;
  /** Wall thickness the birdsmouth seat bears on. */
  wallThickness: number;
  /**
   * Birdsmouth seat cut depth. Defaults to the full wall thickness for complete
   * bearing; the heel plumb cut then falls out of the pitch.
   */
  seatDepth?: number;
  /**
   * Ridge board, gable only. Defaults one nominal size deeper than the rafter
   * so the rafter's plumb cut gets full bearing — CONVENTION, and not always
   * enough at steep pitches (the engine checks and warns).
   */
  ridgeSize?: NominalSize;
  /** Total thickness of the top plate stack, for drawing the bearing detail. */
  plateStack: number;
  maxStock: number;
}

export function defaultRoof(partial: Partial<RoofSpec> = {}): RoofSpec {
  return {
    type: 'gable',
    pitch: 4,
    span: 96,
    length: 144,
    rafterSize: '2x6',
    spacing: 16,
    overhang: 12,
    wallThickness: 3.5,
    plateStack: 3,
    maxStock: 192,
    ...partial,
  };
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A finished rafter's outline in the roof section frame, birdsmouth included. */
export interface RafterProfile {
  label: string;
  points: Point[];
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** The numbers you actually need standing at the saw. */
export interface RafterCuts {
  /** Roof slope from horizontal, degrees. Mark plumb cuts at this angle from
   *  square across the board; level (seat) cuts at 90° to that. */
  pitchAngle: number;
  /** Rafter length per inch of run — √(1 + (pitch/12)²). */
  slopeFactor: number;
  /** Horizontal run from the heel plumb cut to the far bearing (excludes overhang). */
  run: number;
  /** Vertical rise over that run. */
  rise: number;
  /** Overall stock length: long point of one plumb cut to the other. */
  rafterLength: number;
  /** Length of a plumb cut across the rafter — rafter depth ÷ cos(pitch). */
  plumbCutLength: number;
  seatDepth: number;
  /** Vertical leg of the birdsmouth. */
  heelPlumb: number;
  /** How deep the birdsmouth cuts into the rafter, measured perpendicular. */
  notchDepth: number;
  /** The 1/3-of-depth guideline this is checked against. */
  maxNotchDepth: number;
}

export interface RoofFraming {
  spec: RoofSpec;
  members: Member[];
  /** Rafter centers along the building length, inches from one end. */
  rafterCenters: number[];
  cuts: RafterCuts;
  profiles: RafterProfile[];
  /** Ridge board in section — gable only. */
  ridgeSection?: Rect;
  /** Top plate stacks in section, at each bearing wall. */
  plateSections: Rect[];
  /** Shed roofs: how much taller the high wall's framing must be. */
  wallHeightDelta?: number;
  /** Top of the roof plane above the (low) wall's top plate. */
  peakHeight: number;
  warnings: string[];
}

export function layoutRoof(spec: RoofSpec): RoofFraming {
  const warnings: string[] = [];
  if (spec.pitch <= 0) throw new Error('Roof pitch must be greater than zero.');
  if (spec.overhang < 0) throw new Error('Overhang cannot be negative.');

  const slope = spec.pitch / 12; // tan(theta)
  const theta = Math.atan(slope);
  const slopeFactor = Math.sqrt(1 + slope * slope);
  const cos = Math.cos(theta);

  const D = ACTUAL[spec.rafterSize].width; // rafter depth
  const s = ACTUAL[spec.rafterSize].thickness; // 1.5 for 2x stock
  const W = spec.seatDepth ?? spec.wallThickness;
  if (W <= 0) throw new Error('Birdsmouth seat depth must be greater than zero.');

  const plumbCutLength = D / cos;
  const heelPlumb = W * slope;
  const notchDepth = heelPlumb * cos;
  const maxNotchDepth = D / 3;
  if (notchDepth > maxNotchDepth + 1e-9) {
    warnings.push(
      `Birdsmouth cuts ${formatInches(notchDepth)} into a ${formatInches(D)} rafter — past the ` +
        `1/3-of-depth guideline (${formatInches(maxNotchDepth)}). Use a deeper rafter, or a shallower ` +
        `seat and accept partial bearing. That guideline is common practice, not code text — check yours.`,
    );
  }

  // The rafter's bottom edge, as a line through the low seat's inner corner.
  const yb = (x: number) => (x - W) * slope;

  const members: Member[] = [];
  let n = 0;
  const push = (m: Omit<Member, 'id'>) => members.push({ id: `roof-${++n}`, ...m });

  const profiles: RafterProfile[] = [];
  const plateSections: Rect[] = [];
  const mkProfile = (label: string, points: Point[]): RafterProfile => {
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return {
      label,
      points,
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  };

  let ridgeSection: Rect | undefined;
  let wallHeightDelta: number | undefined;
  let structuralRun: number;
  let totalRun: number;
  let peakHeight: number;

  const oh = spec.overhang;
  const plate = (x: number, top: number): Rect => ({
    x,
    y: top - spec.plateStack,
    w: spec.wallThickness,
    h: spec.plateStack,
  });

  if (spec.type === 'gable') {
    const ridgeSize = spec.ridgeSize ?? deeperSize(spec.rafterSize);
    const ridgeT = ACTUAL[ridgeSize].thickness;
    const ridgeD = ACTUAL[ridgeSize].width;

    // Ridge deduction: shorten the run by half the ridge thickness so the plumb
    // cut lands on the ridge board's FACE, not its centerline.
    structuralRun = spec.span / 2 - ridgeT / 2;
    if (structuralRun <= W) {
      throw new Error(
        `Span ${formatLength(spec.span)} is too narrow for a birdsmouth seat at each wall.`,
      );
    }
    totalRun = structuralRun + oh;
    peakHeight = yb(structuralRun) + plumbCutLength;

    const left = mkProfile('Left rafter', [
      { x: -oh, y: yb(-oh) },
      { x: 0, y: yb(0) },
      { x: 0, y: 0 },
      { x: W, y: 0 },
      { x: structuralRun, y: yb(structuralRun) },
      { x: structuralRun, y: peakHeight },
      { x: -oh, y: yb(-oh) + plumbCutLength },
    ]);
    // The right rafter is the left one mirrored about the ridge centerline.
    const right = mkProfile(
      'Right rafter',
      [...left.points].reverse().map((p) => ({ x: spec.span - p.x, y: p.y })),
    );
    profiles.push(left, right);

    ridgeSection = {
      x: spec.span / 2 - ridgeT / 2,
      y: peakHeight - ridgeD,
      w: ridgeT,
      h: ridgeD,
    };
    if (ridgeD < plumbCutLength - 1e-9) {
      warnings.push(
        `A ${ridgeSize} ridge is ${formatInches(ridgeD)} deep but the rafter's plumb cut is ` +
          `${formatInches(plumbCutLength)} — the rafter overhangs the ridge board. ` +
          `Go to a ${deeperSize(ridgeSize)} for full bearing.`,
      );
    }
    plateSections.push(plate(0, 0), plate(spec.span - spec.wallThickness, 0));
  } else {
    // Shed: birdsmouth at both walls. The notch at the high wall mirrors the
    // low one, but its plumb face lands on the plate's INNER edge — the rafter
    // rises toward the eave there, so that is where the notch is deepest.
    structuralRun = spec.span;
    if (spec.span <= 2 * W) {
      throw new Error(
        `Span ${formatLength(spec.span)} is too narrow for a birdsmouth seat at each wall.`,
      );
    }
    totalRun = spec.span + 2 * oh;
    const highSeat = (spec.span - W) * slope;
    wallHeightDelta = highSeat;
    peakHeight = yb(spec.span + oh) + plumbCutLength;

    profiles.push(
      mkProfile('Rafter', [
        { x: -oh, y: yb(-oh) },
        { x: 0, y: yb(0) },
        { x: 0, y: 0 },
        { x: W, y: 0 },
        { x: spec.span - W, y: yb(spec.span - W) },
        { x: spec.span - W, y: highSeat },
        { x: spec.span, y: highSeat },
        { x: spec.span + oh, y: yb(spec.span + oh) },
        { x: spec.span + oh, y: yb(spec.span + oh) + plumbCutLength },
        { x: -oh, y: yb(-oh) + plumbCutLength },
      ]),
    );
    plateSections.push(plate(0, 0), plate(spec.span - spec.wallThickness, highSeat));
  }

  const rafterLength = totalRun * slopeFactor;
  const rise = structuralRun * slope;

  const longestStock = STOCK_LENGTHS[STOCK_LENGTHS.length - 1];
  if (rafterLength > longestStock) {
    warnings.push(
      `Rafters are ${formatLength(rafterLength)} — longer than the ${formatLength(longestStock)} ` +
        `stock in this list. They need splicing over a support, or an engineered member.`,
    );
  }

  // ── Rafter positions ──────────────────────────────────────────────────────
  // Same rule as the studs: end rafters flush with the building ends, field
  // rafters on exact multiples of the spacing so 4' sheathing seams land on one.
  const rafterCenters: number[] = [s / 2];
  for (let k = 1; ; k++) {
    const c = k * spec.spacing;
    if (c + s / 2 > spec.length - s) break;
    if (c - s / 2 < s) continue;
    rafterCenters.push(c);
  }
  const lastCenter = spec.length - s / 2;
  const prev = rafterCenters[rafterCenters.length - 1];
  if (prev !== undefined && lastCenter - prev < s) {
    warnings.push(
      `The last field rafter sits within ${formatInches(s)} of the end rafter — drop it and let ` +
        `the end rafter do the work.`,
    );
  } else {
    rafterCenters.push(lastCenter);
  }

  for (const c of rafterCenters) {
    for (const p of profiles) {
      push({
        role: 'rafter',
        label: 'Rafter',
        size: spec.rafterSize,
        length: rafterLength,
        x: c - s / 2,
        y: p.minX,
        w: s,
        d: p.maxX - p.minX,
        elevBottom: p.minY,
        elevHeight: p.maxY - p.minY,
        center: c,
        flat: false,
        note:
          `${p.label} — ${spec.pitch}/12, ${formatLength(rafterLength)} overall, ` +
          `birdsmouth ${formatInches(W)} seat × ${formatInches(heelPlumb)} heel`,
      });
    }
  }

  if (ridgeSection) {
    const ridgeSize = spec.ridgeSize ?? deeperSize(spec.rafterSize);
    for (const piece of splicePlate(spec.length, rafterCenters, spec.maxStock)) {
      push({
        role: 'ridge-board',
        label: 'Ridge board',
        size: ridgeSize,
        length: piece.length,
        x: piece.start,
        y: ridgeSection.x,
        w: piece.length,
        d: ridgeSection.w,
        elevBottom: ridgeSection.y,
        elevHeight: ridgeSection.h,
        flat: false,
        note: 'Rafter plumb cuts bear on its faces — splice over a rafter',
      });
    }
  }

  return {
    spec,
    members,
    rafterCenters,
    cuts: {
      pitchAngle: (theta * 180) / Math.PI,
      slopeFactor,
      run: structuralRun,
      rise,
      rafterLength,
      plumbCutLength,
      seatDepth: W,
      heelPlumb,
      notchDepth,
      maxNotchDepth,
    },
    profiles,
    ridgeSection,
    plateSections,
    wallHeightDelta,
    peakHeight,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Floor
//
// FLOOR PLAN FRAME (looking down):
//   x = across the building's WIDTH, 0 at the left outside face of the framing
//   y = across the building's DEPTH, 0 at the front outside face
//   elevation = above the BOTTOM OF THE SKIDS, so 0 is the bearing plane the
//   whole shed sits on and the deck lands at `deckHeight`.
//
// Bottom up: skids on grade → joists across them → rim joists capping the joist
// ends → optional blocking. The floor frames to the same outside dimension as
// the walls, so a bottom plate lands flush over the rim and sheathing runs past.
//
// Decking is not here — it arrives with sheathing. Neither is the foundation:
// nothing below the skids (blocks, piers, gravel, footing depth, soil bearing)
// is modelled at all.
// ─────────────────────────────────────────────────────────────────────────────

/** Which building dimension the joists RUN along. Skids cross the other one. */
export type FloorAxis = 'width' | 'depth';

export interface JoistSpanRule {
  size: NominalSize;
  /** On-center spacing this row applies to. */
  spacing: number;
  /** Largest CLEAR span between bearings, inches. */
  maxSpan: number;
}

/**
 * CONVENTION, NOT ENGINEERING — the same caveat as DEFAULT_HEADER_TABLE, and
 * worth repeating. These are rule-of-thumb clear spans in the neighbourhood of
 * what's published for a 40 psf live / 10 psf dead residential floor in No. 2
 * softwood at L/360. Real allowable span moves with species, grade, moisture,
 * and load. Check a current span table for what you're actually buying, and
 * pass your own table in `FloorSpec.joistSpanTable` where it disagrees.
 *
 * On a skid floor this mostly guards against a gross error — with skids at 4'
 * or so, every joist size in this table passes with room to spare. It earns its
 * keep when someone drops to two skids under a wide floor.
 */
export const DEFAULT_JOIST_SPANS: JoistSpanRule[] = [
  { size: '2x6', spacing: 12, maxSpan: 117 },
  { size: '2x6', spacing: 16, maxSpan: 106 },
  { size: '2x6', spacing: 24, maxSpan: 87 },
  { size: '2x8', spacing: 12, maxSpan: 154 },
  { size: '2x8', spacing: 16, maxSpan: 140 },
  { size: '2x8', spacing: 24, maxSpan: 114 },
  { size: '2x10', spacing: 12, maxSpan: 197 },
  { size: '2x10', spacing: 16, maxSpan: 179 },
  { size: '2x10', spacing: 24, maxSpan: 146 },
  { size: '2x12', spacing: 12, maxSpan: 239 },
  { size: '2x12', spacing: 16, maxSpan: 217 },
  { size: '2x12', spacing: 24, maxSpan: 177 },
];

/** Allowable clear span for this size at this spacing; undefined if not listed. */
export function maxJoistSpan(
  size: NominalSize,
  spacing: number,
  table: JoistSpanRule[] = DEFAULT_JOIST_SPANS,
): number | undefined {
  return table.find((r) => r.size === size && r.spacing === spacing)?.maxSpan;
}

export interface FloorSpec {
  /** Outside dimensions of the floor frame — normally the shed's own. */
  width: number;
  depth: number;
  /** Which dimension the joists run along. Skids cross them at right angles. */
  joistAxis: FloorAxis;
  joistSize: NominalSize;
  /** Joist spacing, on center. */
  spacing: number;
  /** Skids lie wide-face-down: a 4x6 gives 5½" of bearing and 3½" of height. */
  skidSize: NominalSize;
  /** How many skids carry the floor. They set the joists' real span. */
  skidCount: number;
  /** How far each outer skid is set in from the floor edge — the floor
   *  cantilevers over it by this much. 0 puts the skid flush with the edge. */
  skidInset: number;
  /** Rows of blocking between the joists. 0 is normal for a skid floor. */
  blockingRows: number;
  /** Pressure-treat the joists and rims too. Skids are always treated. */
  treatedJoists: boolean;
  maxStock: number;
  /** Span → limit lookup. Swap in your own against local code. */
  joistSpanTable: JoistSpanRule[];
}

export function defaultFloor(partial: Partial<FloorSpec> = {}): FloorSpec {
  return {
    width: 144,
    depth: 96,
    joistAxis: 'depth',
    joistSize: '2x6',
    spacing: 16,
    skidSize: '4x6',
    skidCount: 3,
    skidInset: 0,
    blockingRows: 0,
    treatedJoists: true,
    maxStock: 192,
    joistSpanTable: DEFAULT_JOIST_SPANS,
    ...partial,
  };
}

export interface FloorFraming {
  spec: FloorSpec;
  members: Member[];
  /** Joist centers across the layout axis, inches from that edge. */
  joistCenters: number[];
  /** Skid centers along the joist axis, inches from that edge. */
  skidCenters: number[];
  /** Cut length of a common joist — the floor dimension less both rim joists. */
  joistLength: number;
  /** Longest CLEAR span a joist crosses between skids. This is the number the
   *  span table is checked against, not the building dimension. */
  joistSpan: number;
  /** Allowable clear span from the table, if it lists this size and spacing. */
  allowedSpan?: number;
  /** How far the floor overhangs the outer skids, each side. */
  cantilever: number;
  /** Top of the joists above the bottom of the skids — where the deck lands,
   *  and what the walls stand on. */
  deckHeight: number;
  warnings: string[];
}

export function layoutFloor(spec: FloorSpec): FloorFraming {
  const warnings: string[] = [];
  if (spec.skidCount < 2) throw new Error('A floor needs at least two skids.');
  if (spec.skidInset < 0) throw new Error('Skid inset cannot be negative.');
  if (spec.blockingRows < 0) throw new Error('Blocking rows cannot be negative.');

  const s = ACTUAL[spec.joistSize].thickness; // 1.5 for 2x stock
  const joistD = ACTUAL[spec.joistSize].width; // joist depth
  const skidW = ACTUAL[spec.skidSize].width; // bearing width, wide face down
  const skidT = ACTUAL[spec.skidSize].thickness; // height off the bearing plane

  // v runs along the joists, u across them. Everything is built in (u, v) and
  // mapped to plan (x, y) on the way out, so the two axis choices share code.
  const acrossDepth = spec.joistAxis === 'depth';
  const S = acrossDepth ? spec.depth : spec.width; // joists run this far
  const L = acrossDepth ? spec.width : spec.depth; // joists lay out along this
  const place = (u: number, v: number, du: number, dv: number) =>
    acrossDepth ? { x: u, y: v, w: du, d: dv } : { x: v, y: u, w: dv, d: du };

  const joistLength = S - 2 * s;
  if (joistLength <= 0) {
    throw new Error(
      `A ${formatLength(S)} floor is too small to fit a joist between its rim joists.`,
    );
  }
  if (L <= 2 * s) {
    throw new Error(`A ${formatLength(L)} floor is too small to lay out joists across.`);
  }

  const members: Member[] = [];
  let n = 0;
  const push = (m: Omit<Member, 'id'>) => members.push({ id: `floor-${++n}`, ...m });

  // ── Joist positions ───────────────────────────────────────────────────────
  // Same rule as the studs and rafters: end joists flush with the floor edges,
  // field joists on exact multiples of the spacing, so 4' decking seams land on
  // a joist.
  const joistCenters: number[] = [s / 2];
  for (let k = 1; ; k++) {
    const c = k * spec.spacing;
    if (c + s / 2 > L - s) break;
    if (c - s / 2 < s) continue;
    joistCenters.push(c);
  }
  const lastCenter = L - s / 2;
  const prevCenter = joistCenters[joistCenters.length - 1];
  if (prevCenter !== undefined && lastCenter - prevCenter < s) {
    warnings.push(
      `The last field joist sits within ${formatInches(s)} of the end joist — drop it and let ` +
        `the end joist do the work.`,
    );
  } else {
    joistCenters.push(lastCenter);
  }

  // ── Skid positions ────────────────────────────────────────────────────────
  // Skids cross the joists, so the gap between them IS the joists' span.
  const firstSkid = spec.skidInset + skidW / 2;
  const lastSkid = S - spec.skidInset - skidW / 2;
  if (lastSkid <= firstSkid) {
    throw new Error(
      `A ${formatInches(spec.skidInset)} inset leaves no room for ${spec.skidCount} skids ` +
        `under a ${formatLength(S)} floor.`,
    );
  }
  const skidGap = (lastSkid - firstSkid) / (spec.skidCount - 1);
  const skidCenters = Array.from({ length: spec.skidCount }, (_, i) => firstSkid + i * skidGap);
  const joistSpan = Math.max(0, skidGap - skidW);
  const cantilever = spec.skidInset;

  const allowedSpan = maxJoistSpan(spec.joistSize, spec.spacing, spec.joistSpanTable);
  if (allowedSpan === undefined) {
    warnings.push(
      `No entry for a ${spec.joistSize} joist at ${spec.spacing}" O.C. in the span table — ` +
        `the ${formatLength(joistSpan)} clear span between skids is unchecked. Look it up.`,
    );
  } else if (joistSpan > allowedSpan + 1e-9) {
    // How many skids would bring the span inside the limit?
    const needed = Math.ceil((lastSkid - firstSkid) / (allowedSpan + skidW)) + 1;
    warnings.push(
      `Joists clear-span ${formatLength(joistSpan)} between skids — past the ` +
        `${formatLength(allowedSpan)} this table allows a ${spec.joistSize} at ${spec.spacing}" O.C. ` +
        `Go to ${needed} skids, close the spacing, or use a deeper joist. That table is a rule ` +
        `of thumb, not an engineering stamp — check yours.`,
    );
  }
  if (cantilever > 0 && joistSpan > 0 && cantilever > joistSpan / 4 + 1e-9) {
    warnings.push(
      `The floor cantilevers ${formatInches(cantilever)} past the outer skids, more than a ` +
        `quarter of the ${formatLength(joistSpan)} span behind it. Move the skids out toward the edge.`,
    );
  }

  // ── Skids ─────────────────────────────────────────────────────────────────
  for (const [i, c] of skidCenters.entries()) {
    for (const piece of splicePlate(L, joistCenters, spec.maxStock)) {
      push({
        role: 'skid',
        label: 'Skid',
        size: spec.skidSize,
        length: piece.length,
        ...place(piece.start, c - skidW / 2, piece.length, skidW),
        elevBottom: 0,
        elevHeight: skidT,
        center: c,
        flat: true,
        treated: true,
        note:
          `Skid ${i + 1} of ${spec.skidCount} — ground contact, pressure treated. ` +
          `Wide face down, levelled on blocks or piers.`,
      });
    }
  }
  if (L > spec.maxStock) {
    warnings.push(
      `Skids are ${formatLength(L)} — longer than the ${formatLength(spec.maxStock)} stock, so ` +
        `they are spliced. A skid is a ground beam: land every joint directly on a block or pier.`,
    );
  }

  // ── Joists ────────────────────────────────────────────────────────────────
  for (const [i, c] of joistCenters.entries()) {
    const isEnd = i === 0 || i === joistCenters.length - 1;
    push({
      role: 'joist',
      label: isEnd ? 'End joist' : 'Joist',
      size: spec.joistSize,
      length: joistLength,
      ...place(c - s / 2, s, s, joistLength),
      elevBottom: skidT,
      elevHeight: joistD,
      center: c,
      flat: false,
      treated: spec.treatedJoists,
      note: isEnd
        ? 'Flush with the floor edge — the wall above lands over it'
        : `${spec.spacing}" O.C. — bears across every skid`,
    });
  }

  // ── Rim joists ────────────────────────────────────────────────────────────
  // They cap the joist ends and run the full floor dimension, so the joists
  // between them are the "butt" pieces — the same through/butt split the walls
  // use. Spliced over a joist center for solid bearing at the joint.
  for (const [v, side] of [
    [0, 'near'],
    [S - s, 'far'],
  ] as const) {
    for (const piece of splicePlate(L, joistCenters, spec.maxStock)) {
      push({
        role: 'rim-joist',
        label: 'Rim joist',
        size: spec.joistSize,
        length: piece.length,
        ...place(piece.start, v, piece.length, s),
        elevBottom: skidT,
        elevHeight: joistD,
        flat: false,
        treated: spec.treatedJoists,
        note: `Caps the ${side} joist ends — nail through it into the end grain of each joist`,
      });
    }
  }

  // ── Blocking ──────────────────────────────────────────────────────────────
  // Rows run straight across, so one end of each piece gets toe-nailed.
  // Staggering the rows to end-nail both sides is the other common way.
  for (let r = 1; r <= spec.blockingRows; r++) {
    const v = s + (joistLength * r) / (spec.blockingRows + 1);
    for (let i = 1; i < joistCenters.length; i++) {
      const a = joistCenters[i - 1] + s / 2;
      const b = joistCenters[i] - s / 2;
      if (b - a <= 1e-9) continue;
      push({
        role: 'blocking',
        label: 'Blocking',
        size: spec.joistSize,
        length: b - a,
        ...place(a, v - s / 2, b - a, s),
        elevBottom: skidT,
        elevHeight: joistD,
        flat: false,
        treated: spec.treatedJoists,
        note: `Row ${r} of ${spec.blockingRows} — fits between the joists, one end toe-nailed`,
      });
    }
  }

  return {
    spec,
    members,
    joistCenters,
    skidCenters,
    joistLength,
    joistSpan,
    allowedSpan,
    cantilever,
    deckHeight: skidT + joistD,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Whole shed
// ─────────────────────────────────────────────────────────────────────────────

export type WallName = 'Front' | 'Back' | 'Left' | 'Right';

/** An opening assigned to a named wall. `center` is in that wall's local x. */
export interface ShedOpening extends OpeningSpec {
  wall: WallName;
}

export interface ShedSpec {
  /** Outside dimension of the framing, front to back and side to side. */
  width: number;
  depth: number;
  wallHeight: number;
  studSize: NominalSize;
  spacing: number;
  cornerType: CornerType;
  doubleTopPlate: boolean;
  /** Which pair of walls runs the full outside dimension. */
  throughWalls: 'front-back' | 'left-right';
  maxStock: number;
  treatedBottomPlate: boolean;
  openings: ShedOpening[];
  roof: ShedRoofSpec | null;
  /** null for a shed set on a slab, where there is no framed floor. */
  floor: ShedFloorSpec | null;
}

/**
 * The roof, in terms of the shed's own dimensions. `spanAxis` picks which
 * dimension the rafters cross; the ridge (gable) or the high/low walls (shed)
 * run along the other one.
 */
export interface ShedRoofSpec {
  type: RoofType;
  pitch: number;
  spanAxis: 'width' | 'depth';
  rafterSize: NominalSize;
  spacing: number;
  overhang: number;
  seatDepth?: number;
  ridgeSize?: NominalSize;
}

/** The floor, in terms of the shed's own dimensions — it always frames to the
 *  same outside rectangle as the walls, so it takes no size of its own. */
export interface ShedFloorSpec {
  joistAxis: FloorAxis;
  joistSize: NominalSize;
  spacing: number;
  skidSize: NominalSize;
  skidCount: number;
  skidInset: number;
  blockingRows: number;
  treatedJoists: boolean;
  joistSpanTable?: JoistSpanRule[];
}

export function defaultShed(partial: Partial<ShedSpec> = {}): ShedSpec {
  return {
    width: 144,
    depth: 96,
    wallHeight: 96,
    studSize: '2x4',
    spacing: 16,
    cornerType: 'three-stud',
    doubleTopPlate: true,
    throughWalls: 'front-back',
    maxStock: 192,
    treatedBottomPlate: true,
    openings: [],
    roof: {
      type: 'gable',
      pitch: 4,
      spanAxis: 'depth',
      rafterSize: '2x6',
      spacing: 16,
      overhang: 12,
    },
    floor: {
      joistAxis: 'depth',
      joistSize: '2x6',
      spacing: 16,
      skidSize: '4x6',
      skidCount: 3,
      skidInset: 0,
      blockingRows: 0,
      treatedJoists: true,
    },
    ...partial,
  };
}

export interface ShedFraming {
  spec: ShedSpec;
  walls: WallFraming[];
  roof?: RoofFraming;
  floor?: FloorFraming;
  /** Bottom of the skids to the highest point of the roof. */
  overallHeight: number;
  warnings: string[];
}

export function layoutShed(spec: ShedSpec): ShedFraming {
  const t = ACTUAL[spec.studSize].width;
  const fbThrough = spec.throughWalls === 'front-back';

  const wallNames: WallName[] = ['Front', 'Back', 'Left', 'Right'];
  for (const o of spec.openings) {
    if (!wallNames.includes(o.wall)) {
      throw new Error(`Opening ${o.name}: unknown wall "${o.wall}".`);
    }
  }

  const make = (name: WallName, role: WallRole, length: number): WallSpec =>
    defaultWallSpec({
      name,
      role,
      length,
      height: spec.wallHeight,
      studSize: spec.studSize,
      spacing: spec.spacing,
      cornerType: spec.cornerType,
      doubleTopPlate: spec.doubleTopPlate,
      layoutReference: 'building-corner',
      cornerInset: role === 'butt' ? t : 0,
      maxStock: spec.maxStock,
      treatedBottomPlate: spec.treatedBottomPlate,
      openings: spec.openings.filter((o) => o.wall === name),
    });

  const walls = [
    make('Front', fbThrough ? 'through' : 'butt', fbThrough ? spec.width : spec.width - 2 * t),
    make('Back', fbThrough ? 'through' : 'butt', fbThrough ? spec.width : spec.width - 2 * t),
    make('Left', fbThrough ? 'butt' : 'through', fbThrough ? spec.depth - 2 * t : spec.depth),
    make('Right', fbThrough ? 'butt' : 'through', fbThrough ? spec.depth - 2 * t : spec.depth),
  ].map(layoutWall);

  let roof: RoofFraming | undefined;
  if (spec.roof) {
    const r = spec.roof;
    const acrossWidth = r.spanAxis === 'width';
    roof = layoutRoof(
      defaultRoof({
        type: r.type,
        pitch: r.pitch,
        span: acrossWidth ? spec.width : spec.depth,
        length: acrossWidth ? spec.depth : spec.width,
        rafterSize: r.rafterSize,
        spacing: r.spacing,
        overhang: r.overhang,
        seatDepth: r.seatDepth,
        ridgeSize: r.ridgeSize,
        wallThickness: t,
        plateStack: (spec.doubleTopPlate ? 2 : 1) * ACTUAL[spec.studSize].thickness,
        maxStock: spec.maxStock,
      }),
    );
    if (roof.wallHeightDelta !== undefined) {
      // Deliberately reported, not applied: the roof engine does not reach into
      // a wall spec and change its height behind your back.
      roof.warnings.push(
        `Shed roof: frame the high wall ${formatLength(roof.wallHeightDelta)} taller than the low ` +
          `wall (${formatLength(spec.wallHeight)} → ${formatLength(spec.wallHeight + roof.wallHeightDelta)}). ` +
          `The walls above are all drawn at the low height.`,
      );
    }
  }

  let floor: FloorFraming | undefined;
  if (spec.floor) {
    const f = spec.floor;
    floor = layoutFloor(
      defaultFloor({
        width: spec.width,
        depth: spec.depth,
        joistAxis: f.joistAxis,
        joistSize: f.joistSize,
        spacing: f.spacing,
        skidSize: f.skidSize,
        skidCount: f.skidCount,
        skidInset: f.skidInset,
        blockingRows: f.blockingRows,
        treatedJoists: f.treatedJoists,
        maxStock: spec.maxStock,
        ...(f.joistSpanTable ? { joistSpanTable: f.joistSpanTable } : {}),
      }),
    );
  }

  return {
    spec,
    walls,
    roof,
    floor,
    overallHeight: (floor?.deckHeight ?? 0) + spec.wallHeight + (roof?.peakHeight ?? 0),
    warnings: [
      ...(floor?.warnings ?? []),
      ...walls.flatMap((w) => w.warnings),
      ...(roof?.warnings ?? []),
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cut list
// ─────────────────────────────────────────────────────────────────────────────

export interface CutListRow {
  size: NominalSize;
  length: number;
  qty: number;
  labels: string[];
  treated: boolean;
}

/** Anything that contributes pieces: a framed wall, roof, or floor. */
export type CutListSource = WallFraming | RoofFraming | FloorFraming;

export function cutList(framings: CutListSource[]): CutListRow[] {
  const rows = new Map<string, CutListRow>();
  for (const f of framings) {
    for (const m of f.members) {
      const treated = m.treated === true;
      const key = `${m.size}|${m.length.toFixed(4)}|${treated}`;
      const row = rows.get(key);
      if (row) {
        row.qty += 1;
        if (!row.labels.includes(m.label)) row.labels.push(m.label);
      } else {
        rows.set(key, { size: m.size, length: m.length, qty: 1, labels: [m.label], treated });
      }
    }
  }
  return [...rows.values()].sort(
    (a, b) => a.size.localeCompare(b.size) || b.length - a.length || Number(a.treated) - Number(b.treated),
  );
}

/** Board feet in `qty` pieces of this size and length. */
export function pieceBoardFeet(size: NominalSize, length: number, qty = 1): number {
  const [nomT, nomW] = size.split('x').map(Number);
  return (nomT * nomW * length * qty) / 144;
}

/** Total board feet, useful for a quick cost sanity check. */
export function boardFeet(rows: CutListRow[]): number {
  return rows.reduce((sum, r) => sum + pieceBoardFeet(r.size, r.length, r.qty), 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shopping list
//
// The cut list says what pieces you need. This says what to BUY — which means
// deciding, for every piece, which stick it gets cut from. That is the cutting
// stock problem, and it is NP-hard, so what follows is a heuristic, not an
// optimum. See the note on `shoppingList` for what it does and where it gives
// up ground.
// ─────────────────────────────────────────────────────────────────────────────

/** Saw blade width lost at every cut between two pieces on one stick. */
export const DEFAULT_KERF = 0.125;

export interface ShoppingOptions {
  /** Lengths the yard sells. Defaults to STOCK_LENGTHS. */
  stockLengths?: number[];
  /** Longest stick you can actually get home. Trims the list above. */
  maxStock?: number;
  /** Saw kerf between adjacent pieces on one stick. */
  kerf?: number;
}

/** One stick, and what comes off it. */
export interface StickPlan {
  size: NominalSize;
  treated: boolean;
  stockLength: number;
  /** Cut lengths taken from this stick, longest first. */
  pieces: number[];
  /** What is left after those cuts and their kerfs. */
  offcut: number;
}

/** One line of the order: buy this many of this board at this length. */
export interface ShoppingLine {
  size: NominalSize;
  treated: boolean;
  stockLength: number;
  qty: number;
  boardFeet: number;
  /** How many sticks are cut this way, keyed by the pattern. Longest first. */
  patterns: { pieces: number[]; sticks: number; offcut: number }[];
}

export interface ShoppingList {
  lines: ShoppingLine[];
  sticks: StickPlan[];
  /** Total sticks to buy. */
  count: number;
  /** Board feet purchased. */
  boardFeet: number;
  /** Board feet that end up in the building. */
  usedBoardFeet: number;
  /** Offcut as a share of what you buy, 0–100. */
  wastePercent: number;
  warnings: string[];
}

/** Greedily fill one stick of `capacity` from `pool`, longest piece first. */
function fillStick(pool: number[], capacity: number, kerf: number): number[] {
  const taken: number[] = [];
  let used = 0;
  for (let i = 0; i < pool.length; i++) {
    const piece = pool[i]!;
    // The first piece off a stick costs no kerf; every one after it does.
    const cost = taken.length === 0 ? piece : piece + kerf;
    if (used + cost <= capacity + 1e-9) {
      taken.push(i);
      used += cost;
    }
  }
  return taken;
}

/**
 * Turn a cut list into an order.
 *
 * Pieces are grouped by board size and by treated/untreated — you cannot cut a
 * PT sill plate out of a plain stud — then packed stick by stick. For each
 * stick the engine tries every stock length that can hold the longest piece
 * still unplaced, greedily fills it longest-first, and keeps whichever length
 * wastes the smallest *share* of itself. Ties go to the shorter stick, which is
 * cheaper to buy and easier to get home.
 *
 * Waste share rather than raw offcut is the right target because you pay by the
 * board foot: two 8' studs out of a 16' stick beat one out of a 10'.
 *
 * **This is a good answer, not the best one.** Optimal cutting stock is
 * NP-hard; a first-fit-decreasing pass like this typically lands within a few
 * percent. It also assumes every stick is usable end to end — no crooks, no
 * split ends — so buy a little over on a real trip.
 */
export function shoppingList(rows: CutListRow[], options: ShoppingOptions = {}): ShoppingList {
  const warnings: string[] = [];
  const kerf = options.kerf ?? DEFAULT_KERF;
  const maxStock = options.maxStock ?? Math.max(...STOCK_LENGTHS);
  const lengths = [...(options.stockLengths ?? STOCK_LENGTHS)]
    .filter((l) => l <= maxStock)
    .sort((a, b) => a - b);
  if (!lengths.length) throw new Error('No stock lengths available at or under the maximum.');
  const longest = lengths[lengths.length - 1]!;

  // Group by what can actually be cut from the same stick.
  const groups = new Map<string, { size: NominalSize; treated: boolean; pieces: number[] }>();
  for (const r of rows) {
    const key = `${r.size}|${r.treated}`;
    let g = groups.get(key);
    if (!g) {
      g = { size: r.size, treated: r.treated, pieces: [] };
      groups.set(key, g);
    }
    for (let i = 0; i < r.qty; i++) g.pieces.push(r.length);
  }

  const sticks: StickPlan[] = [];

  for (const g of groups.values()) {
    // Longest first: the awkward pieces get placed while the stick is empty.
    const pool = [...g.pieces].sort((a, b) => b - a);

    const tooLong = pool.filter((p) => p > longest + 1e-9);
    if (tooLong.length) {
      warnings.push(
        `${g.size}: ${tooLong.length} piece${tooLong.length > 1 ? 's' : ''} longer than the ` +
          `${formatLength(longest)} stock (up to ${formatLength(tooLong[0]!)}). Each is listed as ` +
          `its own stick — they need splicing over a support, or a special order.`,
      );
    }

    while (pool.length) {
      const longestLeft = pool[0]!;
      let best: { stockLength: number; taken: number[] } | null = null;
      let bestWaste = Infinity;

      for (const stockLength of lengths) {
        if (stockLength < longestLeft - 1e-9) continue; // cannot hold it
        const taken = fillStick(pool, stockLength, kerf);
        if (!taken.length) continue;
        const cut = taken.reduce((s, i) => s + pool[i]!, 0) + kerf * (taken.length - 1);
        const waste = (stockLength - cut) / stockLength;
        // Strictly better only, so ties keep the shorter stick already found.
        if (waste < bestWaste - 1e-9) {
          bestWaste = waste;
          best = { stockLength, taken };
        }
      }

      if (!best) {
        // Only reachable for an over-long piece: give it the longest stick and
        // move on, so the order still accounts for it.
        best = { stockLength: longest, taken: [0] };
      }

      const pieces = best.taken.map((i) => pool[i]!);
      const cut = pieces.reduce((s, p) => s + p, 0) + kerf * (pieces.length - 1);
      sticks.push({
        size: g.size,
        treated: g.treated,
        stockLength: best.stockLength,
        pieces,
        offcut: Math.max(0, best.stockLength - cut),
      });
      // Remove back to front so the earlier indices stay valid.
      for (const i of [...best.taken].sort((a, b) => b - a)) pool.splice(i, 1);
    }
  }

  // Collapse to order lines, remembering the distinct cut patterns behind each.
  const lines = new Map<string, ShoppingLine>();
  for (const s of sticks) {
    const key = `${s.size}|${s.treated}|${s.stockLength}`;
    let line = lines.get(key);
    if (!line) {
      line = {
        size: s.size,
        treated: s.treated,
        stockLength: s.stockLength,
        qty: 0,
        boardFeet: 0,
        patterns: [],
      };
      lines.set(key, line);
    }
    line.qty += 1;
    line.boardFeet = pieceBoardFeet(s.size, s.stockLength, line.qty);

    const signature = s.pieces.join(',');
    const pattern = line.patterns.find((p) => p.pieces.join(',') === signature);
    if (pattern) pattern.sticks += 1;
    else line.patterns.push({ pieces: s.pieces, sticks: 1, offcut: s.offcut });
  }

  const ordered = [...lines.values()].sort(
    (a, b) =>
      a.size.localeCompare(b.size) ||
      Number(a.treated) - Number(b.treated) ||
      a.stockLength - b.stockLength,
  );
  for (const line of ordered) line.patterns.sort((a, b) => b.sticks - a.sticks);

  const bought = ordered.reduce((s, l) => s + l.boardFeet, 0);
  const used = boardFeet(rows);

  return {
    lines: ordered,
    sticks,
    count: sticks.length,
    boardFeet: bought,
    usedBoardFeet: used,
    wastePercent: bought > 0 ? ((bought - used) / bought) * 100 : 0,
    warnings,
  };
}
