// Every stick the design needs, grouped by size and length.

import { STOCK_LENGTHS, boardFeet, formatLength, type CutListRow } from '../core/framing.ts';

export function CutList({ rows }: { rows: CutListRow[] }) {
  const pieces = rows.reduce((n, r) => n + r.qty, 0);

  return (
    <section>
      <div className="wallhead">
        <h3>Cut list</h3>
        <span className="meta">Framing only — no sheathing or fasteners yet</span>
      </div>
      <table>
        <thead>
          <tr>
            <th className="num">Qty</th>
            <th>Size</th>
            <th>Length</th>
            <th>Stock</th>
            <th>Use</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const stock = STOCK_LENGTHS.find((s) => s >= r.length);
            return (
              <tr key={`${r.size}|${r.length}|${r.treated}`}>
                <td className="num">{r.qty}</td>
                <td>
                  {r.size}
                  {r.treated && <span className="pt"> PT</span>}
                </td>
                <td>{formatLength(r.length)}</td>
                <td>{stock ? formatLength(stock) : 'splice'}</td>
                <td>{r.labels.join(', ')}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className="num">{pieces}</td>
            <td colSpan={3}>pieces</td>
            <td>{boardFeet(rows).toFixed(0)} board ft</td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
