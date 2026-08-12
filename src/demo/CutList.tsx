// Every stick the design needs, grouped by size and length.
//
// Chrome, not sheet — but the figures stay tabular-nums so the columns line up
// the way a cut list has to.

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
import { STOCK_LENGTHS, boardFeet, formatLength, type CutListRow } from '../core/framing.ts';

export function CutList({ rows }: { rows: CutListRow[] }) {
  const pieces = rows.reduce((n, r) => n + r.qty, 0);

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline gap-3">
        <h3 className="text-sm font-semibold tracking-tight">Cut list</h3>
        <span className="text-muted-foreground text-xs">
          Framing only — no sheathing or fasteners yet
        </span>
      </div>
      <div className="bg-card overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 text-right">Qty</TableHead>
              <TableHead className="w-32">Size</TableHead>
              <TableHead className="w-32">Length</TableHead>
              <TableHead className="w-28">Stock</TableHead>
              <TableHead>Use</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const stock = STOCK_LENGTHS.find((s) => s >= r.length);
              return (
                <TableRow key={`${r.size}|${r.length}|${r.treated}`}>
                  <TableCell className="text-right font-medium tabular-nums">{r.qty}</TableCell>
                  <TableCell>
                    <span className="tabular-nums">{r.size}</span>
                    {r.treated && (
                      <Badge
                        variant="outline"
                        className="border-destructive/40 text-destructive ml-2 px-1.5 py-0 text-[10px] tracking-wider"
                      >
                        PT
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatLength(r.length)}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {stock ? formatLength(stock) : 'splice'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.labels.join(', ')}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="hover:bg-transparent">
              <TableCell className="text-right font-semibold tabular-nums">{pieces}</TableCell>
              <TableCell colSpan={3}>pieces</TableCell>
              <TableCell className="font-semibold tabular-nums">
                {boardFeet(rows).toFixed(0)} board ft
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </section>
  );
}
