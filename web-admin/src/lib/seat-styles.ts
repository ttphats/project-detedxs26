/**
 * Shared Seat Styles Configuration
 * 
 * This file contains all seat-related styles shared between web-client and web-admin.
 * When you update styles here, both projects will be synchronized.
 * 
 * Usage:
 * - web-client: import { SEAT_COLORS, SEAT_TYPE_LABELS } from '@shared/seat-styles'
 * - web-admin: import { SEAT_COLORS, SEAT_TYPE_LABELS } from '@shared/seat-styles'
 */

// Seat types
export type SeatType = "VIP" | "STANDARD" | "ECONOMY" | "DISABLED";

// Seat status
export type SeatStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "LOCKED" | "selected";

// Seat colors for 3D rendering
export interface SeatColorConfig {
  back: string;      // Gradient for seat back (top part)
  cushion: string;   // Gradient for seat cushion (bottom part)
  armrest: string;   // Color for armrests
  glow?: string;     // Optional glow effect
}

export const SEAT_COLORS: Record<SeatType, SeatColorConfig> = {
  VIP: {
    back: "from-yellow-400 to-orange-500",
    cushion: "from-orange-500 to-orange-600",
    armrest: "bg-orange-600",
    glow: "shadow-orange-500/50",
  },
  STANDARD: {
    back: "from-emerald-400 to-emerald-500",
    cushion: "from-emerald-500 to-emerald-600",
    armrest: "bg-emerald-600",
    glow: "shadow-emerald-500/50",
  },
  ECONOMY: {
    back: "from-cyan-400 to-cyan-500",
    cushion: "from-cyan-500 to-cyan-600",
    armrest: "bg-cyan-600",
    glow: "shadow-cyan-500/50",
  },
  DISABLED: {
    back: "from-gray-600 to-gray-700",
    cushion: "from-gray-700 to-gray-800",
    armrest: "bg-gray-800",
    glow: "shadow-gray-500/50",
  },
};

// Sold/unavailable seat colors
export const SOLD_SEAT_COLORS: SeatColorConfig = {
  back: "from-gray-600 to-gray-700",
  cushion: "from-gray-700 to-gray-800",
  armrest: "bg-gray-800",
};

// Locked seat colors (amber - held by someone else)
export const LOCKED_SEAT_COLORS: SeatColorConfig = {
  back: "from-amber-400 to-amber-500",
  cushion: "from-amber-500 to-amber-600",
  armrest: "bg-amber-600",
  glow: "shadow-amber-500/50",
};

// Selected seat colors
export const SELECTED_SEAT_COLORS: SeatColorConfig = {
  back: "from-red-500 to-red-600",
  cushion: "from-red-600 to-red-700",
  armrest: "bg-red-700",
  glow: "shadow-red-500/50",
};

// Seat type labels (Vietnamese)
export const SEAT_TYPE_LABELS: Record<SeatType, string> = {
  VIP: "VIP",
  STANDARD: "Standard",
  ECONOMY: "Economy",
  DISABLED: "Không khả dụng",
};

// Seat status labels (Vietnamese)
export const SEAT_STATUS_LABELS: Record<SeatStatus, string> = {
  AVAILABLE: "Trống",
  RESERVED: "Đang giữ",
  SOLD: "Đã bán",
  LOCKED: "Đã khóa",
  selected: "Đã chọn",
};

// Zone label styles
export interface ZoneLabelStyle {
  container: string;
  dot: string;
  text: string;
}

export const ZONE_LABEL_STYLES: Record<SeatType, ZoneLabelStyle> = {
  VIP: {
    container: "bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30",
    dot: "bg-gradient-to-r from-yellow-400 to-orange-500 shadow-lg shadow-orange-500/50 animate-pulse",
    text: "text-yellow-400 font-semibold",
  },
  STANDARD: {
    container: "bg-white/5 border border-white/10",
    dot: "bg-emerald-500 shadow-lg shadow-emerald-500/50",
    text: "text-gray-300",
  },
  ECONOMY: {
    container: "bg-white/5 border border-white/10",
    dot: "bg-cyan-500 shadow-lg shadow-cyan-500/50",
    text: "text-gray-300",
  },
  DISABLED: {
    container: "bg-white/5 border border-white/10",
    dot: "bg-gray-500",
    text: "text-gray-500",
  },
};

// VIP rows (rows that should be highlighted as VIP)
export const VIP_ROWS = ["A", "B"];

// Check if a row is VIP
export const isVIPRow = (row: string): boolean => VIP_ROWS.includes(row);

// Get row label color based on VIP status
export const getRowLabelColor = (row: string): string => {
  return isVIPRow(row) ? "text-orange-400" : "text-gray-500";
};

// Stage styles
export const STAGE_STYLES = {
  glow: "bg-red-600/30 blur-2xl",
  reflection: "bg-gradient-to-b from-red-500/20 to-transparent blur-lg",
  main: "bg-gradient-to-r from-red-700 via-red-600 to-red-700",
  border: "border border-red-500/50",
  shadow: "shadow-2xl shadow-red-500/40",
  shine: "bg-gradient-to-r from-transparent via-white/10 to-transparent",
  lights: "bg-yellow-400 animate-pulse shadow-lg shadow-yellow-400/50",
};

// Glass panel styles
export const GLASS_PANEL_STYLES = {
  base: "bg-white/5 backdrop-blur-sm border border-white/10",
  rounded: "rounded-xl sm:rounded-2xl",
  padding: "p-4 sm:p-6 md:p-8",
};

// Aisle width
export const AISLE_WIDTH = "w-8 sm:w-12";

