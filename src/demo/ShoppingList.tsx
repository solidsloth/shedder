// What to actually buy: how many sticks of each board, at what length.
//
// The cut list says what pieces the shed needs. This answers the different
// question you have standing in the lumber aisle. The packing that turns one
// into the other lives in the engine — see shoppingList() and its caveats.

import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatInches, formatLength, type ShoppingList as Order } from '../core/framing.ts';

export function ShoppingList({ order }: { order: Order }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-sm font-semibold tracking-tight">Shopping list</h3>
        <span className="text-muted-foreground text-xs">
          {order.count} sticks · {order.boardFeet.toFixed(0)} board ft ·{' '}
          {order.wastePercent.toFixed(0)}% offcut
        </span>
      </div>

      {order.warnings.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {order.warnings.map((w) => (
            <Alert key={w}>
              <Info />
              <AlertDescription>{w}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="bg-card overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 text-right">Buy</TableHead>
              <TableHead className="w-32">Board</TableHead>
              <TableHead className="w-32">Length</TableHead>
              <TableHead>Cut each into</TableHead>
              <TableHead className="w-28 text-right">Board ft</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {order.lines.map((l) => (
              <TableRow key={`${l.size}|${l.treated}|${l.stockLength}`}>
                <TableCell className="text-right font-medium tabular-nums">{l.qty}</TableCell>
                <TableCell>
                  <span className="tabular-nums">{l.size}</span>
                  {l.treated && (
                    <Badge
                      variant="outline"
                      className="border-destructive/40 text-destructive ml-2 px-1.5 py-0 text-[10px] tracking-wider"
                    >
                      PT
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{formatLength(l.stockLength)}</TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="flex flex-col gap-0.5">
                    {l.patterns.map((p) => (
                      <span key={p.pieces.join(',')} className="text-xs tabular-nums">
                        {l.patterns.length > 1 && (
                          <span className="text-foreground/70">{p.sticks}× </span>
                        )}
                        {summarise(p.pieces)}
                        {p.offcut > 0.5 && (
                          <span className="opacity-60"> · {formatInches(p.offcut)} left</span>
                        )}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-right tabular-nums">
                  {l.boardFeet.toFixed(0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="text-right font-semibold tabular-nums">{order.count}</TableCell>
              <TableCell colSpan={3}>sticks</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {order.boardFeet.toFixed(0)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      <p className="text-muted-foreground mt-2 text-[11px]">
        Packed longest-piece-first with a {formatInches(0.125)} saw kerf between cuts. It is a good
        packing, not a provably optimal one, and it assumes every stick is usable end to end — buy a
        little over.
      </p>
    </section>
  );
}

/** `[91.5, 91.5]` → `2 × 7' 7-1/2"`; mixed runs list each length. */
function summarise(pieces: number[]): string {
  const runs: { length: number; n: number }[] = [];
  for (const p of pieces) {
    const last = runs[runs.length - 1];
    if (last && Math.abs(last.length - p) < 1e-9) last.n += 1;
    else runs.push({ length: p, n: 1 });
  }
  return runs
    .map((r) => (r.n > 1 ? `${r.n} × ${formatLength(r.length)}` : formatLength(r.length)))
    .join(' + ');
}
