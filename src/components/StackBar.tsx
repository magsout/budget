import { formatCents } from "../lib/money.ts";
import { formatPct, share, stackWidths } from "../lib/shape.ts";

export interface Segment {
  key: string;
  label: string;
  cents: number;
  /** Any CSS color — a hex from the palette, or a `var(--token)`. */
  color: string;
  /** Optional count, e.g. "51 dépenses". */
  count?: number;
}

interface Props {
  segments: Segment[];
  /** What the segments are drawn against. The unfilled remainder is meaningful. */
  totalCents: number;
  /** A line under the legend, e.g. "sur 3 926,03 € de revenus". */
  note?: string;
}

function describe(segment: Segment, totalCents: number): string {
  const parts = [segment.label, formatCents(segment.cents)];
  if (segment.count !== undefined) {
    parts.push(`${segment.count} dépense${segment.count > 1 ? "s" : ""}`);
  }
  parts.push(formatPct(share(segment.cents, totalCents)));
  return parts.join(" ");
}

/**
 * One bar showing how several amounts divide a total, with the leftover left as
 * visible track.
 *
 * Replaces two independent bars each scaled to the largest value — where the
 * biggest contributor was always exactly full, so the picture said nothing that
 * the numbers had not. Against a shared total, the lengths are comparable.
 */
export function StackBar({ segments, totalCents, note }: Props) {
  const { pct, over } = stackWidths(
    segments.map((s) => s.cents),
    totalCents,
  );
  const overshoot = segments.reduce((s, seg) => s + seg.cents, 0) - totalCents;

  return (
    <div className="stackbar-block">
      {/* A length is not readable by a screen reader, so the bar carries the whole
          comparison as text and its segments are decorative. */}
      <div
        className="stackbar"
        role="img"
        aria-label={segments.map((s) => describe(s, totalCents)).join(" ; ")}
      >
        {segments.map((segment, i) => (
          <span
            key={segment.key}
            className="stackbar__seg"
            style={{ width: `${pct[i]}%`, background: segment.color }}
          />
        ))}
      </div>
      <div className="stackbar__legend">
        {segments.map((segment) => (
          <span className="stackbar__item" key={segment.key}>
            <span className="stackbar__key" style={{ background: segment.color }} aria-hidden />
            {segment.label}
            <strong className="num">{formatCents(segment.cents)}</strong>
            {segment.count !== undefined && (
              <span className="muted">
                {segment.count} dépense{segment.count > 1 ? "s" : ""}
              </span>
            )}
          </span>
        ))}
      </div>
      {note && <p className="stackbar__note muted">{note}</p>}
      {/* Stated, not clipped: a bar that silently stops at full is exactly how
          overspending stays invisible today. */}
      {over && <p className="stackbar__note negative">Dépassement de {formatCents(overshoot)}</p>}
    </div>
  );
}
