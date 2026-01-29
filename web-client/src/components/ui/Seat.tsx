"use client";

import {
  SEAT_COLORS,
  SOLD_SEAT_COLORS,
  SELECTED_SEAT_COLORS,
} from "@/lib/seat-styles";

interface SeatProps {
  id: string;
  row: string;
  number: number;
  status: "available" | "selected" | "sold";
  price: number;
  onSelect?: (id: string) => void;
}

export default function Seat({
  id,
  row,
  number,
  status,
  price,
  onSelect,
}: SeatProps) {
  const handleClick = () => {
    if (status !== "sold" && onSelect) {
      onSelect(id);
    }
  };

  // Get colors from shared config
  const availableColors = SEAT_COLORS.STANDARD;
  const selectedColors = SELECTED_SEAT_COLORS;
  const soldColors = SOLD_SEAT_COLORS;

  // Status-based styling for the seat back (top part)
  const backStyles = {
    available: `bg-gradient-to-b ${availableColors.back} group-hover:from-emerald-300 group-hover:to-emerald-400`,
    selected: `bg-gradient-to-b ${selectedColors.back} shadow-lg ${selectedColors.glow}`,
    sold: `bg-gradient-to-b ${soldColors.back}`,
  };

  // Status-based styling for the seat cushion (bottom part)
  const cushionStyles = {
    available: `bg-gradient-to-b ${availableColors.cushion} group-hover:from-emerald-400 group-hover:to-emerald-500`,
    selected: `bg-gradient-to-b ${selectedColors.cushion}`,
    sold: `bg-gradient-to-b ${soldColors.cushion}`,
  };

  // Status-based styling for armrests
  const armrestStyles = {
    available: `${availableColors.armrest} group-hover:bg-emerald-500`,
    selected: selectedColors.armrest,
    sold: soldColors.armrest,
  };

  return (
    <button
      onClick={handleClick}
      disabled={status === "sold"}
      className={`relative mobile-seat sm:w-8 sm:h-9 flex flex-col items-center justify-center transition-all duration-200 group mobile-tap-feedback ${
        status === "sold"
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer hover:brightness-110"
      }`}
      title={`${row}${number} - ${price.toLocaleString("vi-VN")}đ${status === "sold" ? " (Đã bán)" : ""}`}
    >
      {/* Seat back (top part) */}
      <div
        className={`mobile-seat-back sm:w-6 sm:h-4 rounded-t-md ${backStyles[status]} flex items-center justify-center relative ${
          status === "selected" ? "ring-2 ring-white/50" : ""
        }`}
      >
        {/* Shine effect */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-md" />
        {/* Seat number */}
        <span
          className={`relative text-[11px] sm:text-[9px] font-bold ${status === "sold" ? "text-gray-400" : "text-white"}`}
        >
          {number}
        </span>
      </div>

      {/* Seat cushion (bottom part) */}
      <div
        className={`mobile-seat-cushion sm:w-7 sm:h-2.5 rounded-b-sm ${cushionStyles[status]} ${
          status === "selected" ? "ring-2 ring-white/50" : ""
        }`}
      />

      {/* Sold X indicator */}
      {status === "sold" && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-5 h-0.5 sm:w-4 bg-gray-400/80 rotate-45" />
          <div className="w-5 h-0.5 sm:w-4 bg-gray-400/80 -rotate-45 absolute" />
        </div>
      )}
    </button>
  );
}

export function SeatLegend() {
  // Use shared config colors
  const availableColors = SEAT_COLORS.STANDARD;
  const selectedColors = SELECTED_SEAT_COLORS;
  const soldColors = SOLD_SEAT_COLORS;

  return (
    <div className="flex items-center gap-6 justify-center py-4">
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-md bg-gradient-to-b ${availableColors.back}`}
        />
        <span className="text-sm text-gray-300">Trống</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-md bg-gradient-to-b ${selectedColors.back} ring-2 ring-red-400 shadow-lg ${selectedColors.glow}`}
        />
        <span className="text-sm text-gray-300">Đã chọn</span>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-md bg-gradient-to-b ${soldColors.back}`}
        />
        <span className="text-sm text-gray-300">Đã bán</span>
      </div>
    </div>
  );
}
