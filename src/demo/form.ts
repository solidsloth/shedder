// The control panel's state, and how it becomes a ShedSpec.
//
// Numeric fields are held as STRINGS on purpose. A half-typed value ("", "-",
// "8'") stays in the box, gets parsed on the way to the engine, and fails soft:
// the engine throws, App catches, and the warning banner explains it. Storing
// them as numbers would fight the user mid-keystroke.

import {
  defaultShed,
  parseLength,
  type CornerType,
  type FloorAxis,
  type NominalSize,
  type RoofType,
  type ShedSpec,
  type WallName,
} from '../core/framing.ts';

export interface OpeningRow {
  wall: WallName;
  kind: 'door' | 'window';
  width: string;
  height: string;
  center: string;
  sill: string;
}

export interface Form {
  width: string;
  depth: string;
  height: string;
  studSize: NominalSize;
  spacing: string;
  cornerType: CornerType;
  throughWalls: 'front-back' | 'left-right';
  doubleTop: boolean;
  treated: boolean;
  maxStock: string;
  floorType: 'skid' | 'none';
  joistAxis: FloorAxis;
  joistSize: NominalSize;
  joistSpacing: string;
  skidSize: NominalSize;
  skidCount: string;
  skidInset: string;
  blockingRows: string;
  treatedJoists: boolean;
  roofType: RoofType | 'none';
  pitch: string;
  spanAxis: 'width' | 'depth';
  rafterSize: NominalSize;
  rafterSpacing: string;
  overhang: string;
  openings: OpeningRow[];
}

export const INITIAL_FORM: Form = {
  width: '144',
  depth: '96',
  height: '96',
  studSize: '2x4',
  spacing: '16',
  cornerType: 'three-stud',
  throughWalls: 'front-back',
  doubleTop: true,
  treated: true,
  maxStock: '192',
  floorType: 'skid',
  joistAxis: 'depth',
  joistSize: '2x6',
  joistSpacing: '16',
  skidSize: '4x6',
  skidCount: '3',
  skidInset: '0',
  blockingRows: '0',
  treatedJoists: true,
  roofType: 'gable',
  pitch: '4',
  spanAxis: 'depth',
  rafterSize: '2x6',
  rafterSpacing: '16',
  overhang: '12',
  openings: [{ wall: 'Front', kind: 'door', width: '38', height: '82', center: '72', sill: '36' }],
};

export const NEW_DOOR: OpeningRow = {
  wall: 'Front', kind: 'door', width: '38', height: '82', center: '36', sill: '36',
};
export const NEW_WINDOW: OpeningRow = {
  wall: 'Back', kind: 'window', width: '30', height: '36', center: '72', sill: '40',
};

export function toShedSpec(f: Form): ShedSpec {
  return defaultShed({
    width: parseLength(f.width),
    depth: parseLength(f.depth),
    wallHeight: parseLength(f.height),
    studSize: f.studSize,
    spacing: Number(f.spacing),
    cornerType: f.cornerType,
    throughWalls: f.throughWalls,
    doubleTopPlate: f.doubleTop,
    treatedBottomPlate: f.treated,
    maxStock: Number(f.maxStock),
    roof:
      f.roofType === 'none'
        ? null
        : {
            type: f.roofType,
            pitch: Number(f.pitch),
            spanAxis: f.spanAxis,
            rafterSize: f.rafterSize,
            spacing: Number(f.rafterSpacing),
            overhang: parseLength(f.overhang),
          },
    floor:
      f.floorType === 'none'
        ? null
        : {
            joistAxis: f.joistAxis,
            joistSize: f.joistSize,
            spacing: Number(f.joistSpacing),
            skidSize: f.skidSize,
            skidCount: Number(f.skidCount),
            skidInset: parseLength(f.skidInset),
            blockingRows: Number(f.blockingRows),
            treatedJoists: f.treatedJoists,
          },
    openings: f.openings.map((o, i) => ({
      wall: o.wall,
      name: `${o.kind} ${i + 1}`,
      kind: o.kind,
      center: parseLength(o.center),
      roWidth: parseLength(o.width),
      roHeight: parseLength(o.height),
      ...(o.kind === 'window' ? { sillHeight: parseLength(o.sill) } : {}),
    })),
  });
}
