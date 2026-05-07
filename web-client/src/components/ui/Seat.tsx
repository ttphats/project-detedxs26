"use client";

import {
  SEAT_COLORS,
  SOLD_SEAT_COLORS,
  SELECTED_SEAT_COLORS,
  LOCKED_SEAT_COLORS,
} from "@/lib/seat-styles";

interface SeatProps {
  id: string;
  row: string;
  number: number;
  seatNumber?: string; // Full seat number like "A1", "B10"
  status: "available" | "selected" | "sold" | "locked" | "locked_by_me";
  price: number;
  seatType?: "VIP" | "STANDARD" | "ECONOMY" | string; // Allow custom types
  level?: number; // Seat level (1, 2, 3...)
  color?: string; // Custom color from ticket types
  onSelect?: (id: string) => void;
  showType?: boolean; // Show VIP/STD badge
}

export default function Seat({
  id,
  row,
  number,
  seatNumber,
  status,
  price,
  seatType = "STANDARD",
  level,
  color,
  onSelect,
  showType = false,
}: SeatProps) {
  const handleClick = () => {
    // Can select available seats or deselect locked_by_me seats
    if (
      (status === "available" ||
        status === "locked_by_me" ||
        status === "selected") &&
      onSelect
    ) {
      onSelect(id);
    }
  };

  // Use custom color if provided, otherwise fallback to type-based colors
  const isVIP = seatType === "VIP" || (level && level >= 3);

  // Get colors from shared config based on seat type
  const availableColors =
    SEAT_COLORS[seatType as keyof typeof SEAT_COLORS] || SEAT_COLORS.STANDARD;
  const selectedColors = SELECTED_SEAT_COLORS;
  const soldColors = SOLD_SEAT_COLORS;
  const lockedColors = LOCKED_SEAT_COLORS;

  // Use custom color for available state if provided
  const hasCustomColor = color && status === "available";

  // VIP hover colors
  const hoverBack = isVIP
    ? "group-hover:from-yellow-300 group-hover:to-orange-400"
    : "group-hover:from-emerald-300 group-hover:to-emerald-400";
  const hoverCushion = isVIP
    ? "group-hover:from-orange-400 group-hover:to-orange-500"
    : "group-hover:from-emerald-400 group-hover:to-emerald-500";

  // Determine display status (locked_by_me shows as selected)
  const displayStatus = status === "locked_by_me" ? "selected" : status;

  // Status-based styling for the seat back (top part)
  const backStyles: Record<string, string> = {
    available: `bg-gradient-to-b ${availableColors.back} ${hoverBack}`,
    selected: `bg-gradient-to-b ${selectedColors.back} shadow-lg ${selectedColors.glow}`,
    sold: `bg-gradient-to-b ${soldColors.back}`,
    locked: `bg-gradient-to-b ${lockedColors.back}`,
  };

  // Status-based styling for the seat cushion (bottom part)
  const cushionStyles: Record<string, string> = {
    available: `bg-gradient-to-b ${availableColors.cushion} ${hoverCushion}`,
    selected: `bg-gradient-to-b ${selectedColors.cushion}`,
    sold: `bg-gradient-to-b ${soldColors.cushion}`,
    locked: `bg-gradient-to-b ${lockedColors.cushion}`,
  };

  // Is seat disabled (can't be clicked)?
  const isDisabled = status === "sold" || status === "locked";

  // Title text
  const getTitleText = () => {
    const displaySeat = seatNumber || `${row}${number}`;
    const priceText = `${displaySeat} - ${price.toLocaleString("vi-VN")}đ`;
    if (status === "sold") return `${priceText} (Đã bán)`;
    if (status === "locked") return `${priceText} (Đang được giữ)`;
    if (status === "locked_by_me" || status === "selected")
      return `${priceText} (Đã chọn)`;
    return priceText;
  };

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      className={`relative mobile-seat sm:w-8 sm:h-9 flex flex-col items-center justify-center transition-all duration-200 group mobile-tap-feedback ${
        isDisabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:brightness-110"
      }`}
      title={getTitleText()}
    >
      {/* Seat back (top part) */}
      <div
        className={`mobile-seat-back sm:w-6 sm:h-4 rounded-t-md flex items-center justify-center relative ${
          !hasCustomColor ? backStyles[displayStatus] : ""
        } ${displayStatus === "selected" ? "ring-2 ring-white/50" : ""}`}
        style={
          hasCustomColor
            ? {
                background: `linear-gradient(to bottom, ${color}, ${color}dd)`,
              }
            : undefined
        }
      >
        {/* Shine effect */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-md" />
        {/* Seat number */}
        <span
          className={`relative text-[10px] sm:text-[8px] font-bold ${isDisabled ? "text-gray-400" : "text-white"}`}
        >
          {seatNumber || `${row}${number}`}
        </span>
      </div>

      {/* Seat cushion (bottom part) */}
      <div
        className={`mobile-seat-cushion sm:w-7 sm:h-2.5 rounded-b-sm ${
          !hasCustomColor ? cushionStyles[displayStatus] : ""
        } ${displayStatus === "selected" ? "ring-2 ring-white/50" : ""}`}
        style={
          hasCustomColor
            ? {
                background: `linear-gradient(to bottom, ${color}dd, ${color}aa)`,
              }
            : undefined
        }
      />

      {/* Sold X indicator */}
      {status === "sold" && (
        <div className="absolute inset-0 top-0 flex items-start justify-center pt-0.5 pointer-events-none">
          <svg
            className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-white drop-shadow"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 6l12 12M18 6L6 18"
            />
          </svg>
        </div>
      )}

      {/* Locked indicator (clock icon) */}
      {status === "locked" && (
        <div className="absolute -top-1 -right-1 z-10 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center shadow-sm">
          <svg
            className="w-2 h-2 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6l4 2"
            />
          </svg>
        </div>
      )}
    </button>
  );
}

interface TicketType {
  id: string;
  name: string;
  price: number;
  level: number;
  color: string;
}

interface SeatLegendProps {
  ticketTypes?: TicketType[];
}

export function SeatLegend({ ticketTypes = [] }: SeatLegendProps) {
  const selectedColors = SELECTED_SEAT_COLORS;
  const soldColors = SOLD_SEAT_COLORS;
  const lockedColors = LOCKED_SEAT_COLORS;

  // Sort ticket types by level (ascending)
  const sortedTicketTypes = [...ticketTypes].sort((a, b) => a.level - b.level);

  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-6 justify-center py-4">
      {/* Dynamic ticket types */}
      {sortedTicketTypes.map((tt) => {
        return (
          <div key={tt.id} className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md"
              style={{
                background: `linear-gradient(to bottom, ${tt.color}, ${tt.color}dd)`,
              }}
            />
            <span className="text-sm text-gray-300">{tt.name}</span>
          </div>
        );
      })}

      {/* Selected */}
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-md bg-gradient-to-b ${selectedColors.back} ring-2 ring-red-400 shadow-lg ${selectedColors.glow}`}
        />
        <span className="text-sm text-gray-300">Đã chọn</span>
      </div>
      {/* Locked by others */}
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-md bg-gradient-to-b ${lockedColors.back}`}
        />
        <span className="text-sm text-gray-300">Đang giữ</span>
      </div>
      {/* Sold */}
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-md bg-gradient-to-b ${soldColors.back} relative`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-4 h-0.5 bg-gray-400/80 rotate-45" />
            <div className="w-4 h-0.5 bg-gray-400/80 -rotate-45 absolute" />
          </div>
        </div>
        <span className="text-sm text-gray-300">Đã bán</span>
      </div>
    </div>
  );
}
