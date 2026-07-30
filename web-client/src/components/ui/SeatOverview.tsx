"use client";

import { cn } from "@/lib/utils";
import Seat from "@/components/ui/Seat";

/**
 * SeatOverview — read-only venue overview for the ticket-class booking flow.
 * Renders each seat using the SAME Seat component as the legacy seat-selection
 * page (so the visual design is identical), but in `compact` mode: no seat
 * number, no click, no title tooltip. Tiers are colored by their `color`.
 * Rows outside the highlighted tier are dimmed. Independent from the legacy
 * seat-selection logic (no onSelect, no status handling beyond display).
 */
export interface OverviewSeat {
  id: string;
  row: string;
  number: number;
  seatNumber?: string;
  section?: string | null;
  level?: number;
  seatType?: string;
  status?: "available" | "sold" | "locked" | "locked_by_me" | "selected";
  price?: number;
}

export interface OverviewRow {
  row: string;
  seats: OverviewSeat[];
}

export interface OverviewTier {
  id: string;
  name: string;
  level: number;
  color: string;
}

interface SeatOverviewProps {
  rows: OverviewRow[];
  tiers: OverviewTier[];
  highlightedTierId?: string | null;
  className?: string;
}

function tierColorForSeat(
  seat: OverviewSeat,
  tiers: OverviewTier[],
): string | undefined {
  const tt = tiers.find((t) => t.level === seat.level);
  return tt?.color;
}

export default function SeatOverview({
  rows,
  tiers,
  highlightedTierId,
  className,
}: SeatOverviewProps) {
  const highlightedTier = highlightedTierId
    ? tiers.find((t) => t.id === highlightedTierId)
    : null;

  const seatInHighlight = (seat: OverviewSeat) =>
    !!highlightedTier && seat.level === highlightedTier.level;

  const rowInHighlight = (row: OverviewRow) => row.seats.some(seatInHighlight);

  // Sort tiers by level descending (VIP first) for zone labels
  const sortedTiers = [...tiers].sort((a, b) => b.level - a.level);

  // Group rows by tier for zone labels
  const rowsForTier = (level: number): string[] => {
    const set = new Set<string>();
    rows.forEach((r) =>
      r.seats.forEach((s) => {
        if (s.level === level) set.add(r.row);
      }),
    );
    return Array.from(set).sort();
  };

  const formatRows = (rs: string[]): string => {
    if (rs.length === 0) return "";
    if (rs.length === 1) return rs[0];
    const consecutive = rs.every(
      (r, i) => i === 0 || r.charCodeAt(0) === rs[i - 1].charCodeAt(0) + 1,
    );
    return consecutive ? `${rs[0]}–${rs[rs.length - 1]}` : rs.join(", ");
  };

  return (
    <div className={cn("w-full", className)}>
      {/* Zone labels */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-5 text-[10px] sm:text-xs">
        {sortedTiers.map((tt) => {
          const rs = rowsForTier(tt.level);
          if (rs.length === 0) return null;
          const isHighlight = highlightedTier?.id === tt.id;
          return (
            <div
              key={tt.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all"
              style={{
                borderColor: isHighlight ? tt.color : "rgba(255,255,255,0.08)",
                background: isHighlight
                  ? `${tt.color}15`
                  : "rgba(255,255,255,0.02)",
              }}
            >
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: tt.color }}
              />
              <span
                className="font-medium"
                style={{ color: isHighlight ? tt.color : "#9ca3af" }}
              >
                {tt.name} ({formatRows(rs)})
              </span>
            </div>
          );
        })}
      </div>

      {/* Seats grid — dots only, read-only */}
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-2">
        <p className="text-center text-gray-700 text-[10px] mb-2 sm:hidden">
          ← Swipe to view map →
        </p>
        <div className="min-w-[560px] sm:min-w-[520px] space-y-1.5 sm:space-y-2 px-2">
          {rows.map((row) => {
            const sorted = [...row.seats].sort(
              (a, b) =>
                parseInt((a.seatNumber || "").replace(/[A-Z]/g, "")) -
                parseInt((b.seatNumber || "").replace(/[A-Z]/g, "")),
            );
            const hasSections = row.seats.some(
              (s) => s.section === "LEFT" || s.section === "RIGHT",
            );
            const left = hasSections
              ? sorted.filter((s) => s.section === "LEFT")
              : sorted.slice(0, Math.ceil(sorted.length / 2));
            const right = hasSections
              ? sorted.filter((s) => s.section === "RIGHT")
              : sorted.slice(Math.ceil(sorted.length / 2));
            const inHL = rowInHighlight(row);

            const renderSeat = (seat: OverviewSeat) => {
              const c = tierColorForSeat(seat, tiers);
              return (
                <Seat
                  key={seat.id}
                  id={seat.id}
                  row={row.row}
                  number={seat.number}
                  seatNumber={seat.seatNumber}
                  // Overview mode: always render as "available" so every seat
                  // shows its tier color uniformly — no sold/locked distinction
                  // (that belongs to the legacy seat-selection flow, not here).
                  status="available"
                  price={seat.price || 0}
                  seatType={seat.seatType || "STANDARD"}
                  level={seat.level}
                  color={c}
                  compact
                />
              );
            };

            return (
              <div
                key={row.row}
                className="flex items-center gap-2 sm:gap-3 transition-opacity duration-300"
                style={{ opacity: highlightedTier ? (inHL ? 1 : 0.28) : 1 }}
              >
                <span
                  className={cn(
                    "w-6 sm:w-8 text-center font-bold text-sm sm:text-base",
                    inHL && highlightedTier ? "text-white" : "text-gray-700",
                  )}
                >
                  {row.row}
                </span>
                <div className="flex gap-1 sm:gap-2 flex-1 justify-center items-center">
                  <div className="flex gap-1 sm:gap-2">
                    {left.map(renderSeat)}
                  </div>
                  <div className="w-6 sm:w-10 flex items-center justify-center">
                    <div className="w-px h-5 bg-white/10" />
                  </div>
                  <div className="flex gap-1 sm:gap-2">
                    {right.map(renderSeat)}
                  </div>
                </div>
                <span
                  className={cn(
                    "w-6 sm:w-8 text-center font-bold text-sm sm:text-base",
                    inHL && highlightedTier ? "text-white" : "text-gray-700",
                  )}
                >
                  {row.row}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
