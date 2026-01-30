"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Monitor, Check, Star, Ticket } from "lucide-react";
import {
  SEAT_COLORS,
  SOLD_SEAT_COLORS,
  ZONE_LABEL_STYLES,
  SEAT_TYPE_LABELS,
  isVIPRow,
  getRowLabelColor,
  AISLE_WIDTH,
  type SeatType,
} from "@/lib/seat-styles";

interface Seat {
  id: string;
  seat_number: string;
  row: string;
  col: number;
  section: string;
  seat_type: SeatType;
  status: string;
  price: number;
}

interface TicketType {
  id: string;
  name: string;
  description: string | null;
  price: number;
  color: string;
  subtitle: string | null;
  benefits: string[] | null;
}

// Wrapper component to handle Suspense for useSearchParams
export default function LayoutPreviewPage() {
  return (
    <Suspense fallback={<LayoutPreviewLoading />}>
      <LayoutPreviewContent />
    </Suspense>
  );
}

function LayoutPreviewLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 flex items-center justify-center">
      <div className="text-white text-xl">Đang tải...</div>
    </div>
  );
}

function LayoutPreviewContent() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode"); // "editor" means preview from editor with current state
  const eventId = searchParams.get("eventId") || "evt-tedx-2026";

  const [seats, setSeats] = useState<Seat[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [eventName, setEventName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditorPreview, setIsEditorPreview] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Check if preview mode from editor (with current editing state)
        if (mode === "editor") {
          const previewDataStr = sessionStorage.getItem("layout-preview-data");
          if (previewDataStr) {
            const previewData = JSON.parse(previewDataStr);
            // Convert editor seat format to preview seat format
            const convertedSeats: Seat[] = previewData.seats.map((s: any) => ({
              id: s.id,
              seat_number: s.seat_number,
              row: s.row,
              col: s.col,
              section: s.side === "left" ? "LEFT" : "RIGHT",
              seat_type: s.type as SeatType,
              status: "AVAILABLE", // In editor preview, all seats are available
              price: 0, // Will show from ticket types
            }));
            setSeats(convertedSeats);
            setEventName(previewData.versionName || "Preview từ Editor");
            setIsEditorPreview(true);

            // Still fetch ticket types from API for pricing info
            const ttRes = await fetch(
              `/api/admin/ticket-types?eventId=${previewData.eventId || eventId}`,
            );
            const ttData = await ttRes.json();
            if (ttData.success) {
              setTicketTypes(ttData.data.ticketTypes || []);
            }
            setLoading(false);
            return;
          }
        }

        // Default: Fetch from database
        const seatsRes = await fetch(`/api/admin/seats?eventId=${eventId}`);
        const seatsData = await seatsRes.json();
        if (seatsData.success) {
          setSeats(seatsData.data.seats || []);
          const event = seatsData.data.events?.find(
            (e: any) => e.id === eventId,
          );
          setEventName(event?.name || "");
        }

        // Fetch ticket types
        const ttRes = await fetch(`/api/admin/ticket-types?eventId=${eventId}`);
        const ttData = await ttRes.json();
        if (ttData.success) {
          setTicketTypes(ttData.data.ticketTypes || []);
        }
      } catch (error) {
        console.error("Failed to fetch:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId, mode]);

  // Group seats by row AND section (LEFT/RIGHT)
  const seatsByRowAndSection = seats.reduce(
    (acc, seat) => {
      if (!acc[seat.row]) acc[seat.row] = { LEFT: [], RIGHT: [] };
      if (seat.section === "LEFT") {
        acc[seat.row].LEFT.push(seat);
      } else {
        acc[seat.row].RIGHT.push(seat);
      }
      return acc;
    },
    {} as Record<string, { LEFT: Seat[]; RIGHT: Seat[] }>,
  );

  // Sort rows alphabetically
  const sortedRows = Object.keys(seatsByRowAndSection).sort();

  // Sort seats in each section by col
  sortedRows.forEach((row) => {
    seatsByRowAndSection[row].LEFT.sort((a, b) => a.col - b.col);
    seatsByRowAndSection[row].RIGHT.sort((a, b) => a.col - b.col);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-xl">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900">
      {/* Editor Preview Banner */}
      {isEditorPreview && (
        <div className="bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 border-b border-yellow-500/30">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-center gap-2 text-yellow-400 text-sm">
            <span className="animate-pulse">🔧</span>
            <span className="font-medium">
              Preview từ Editor - Hiển thị trạng thái đang chỉnh sửa (chưa lưu
              vào database)
            </span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-black/50 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/layout-editor"
              className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Quay lại</span>
            </Link>
            <div className="h-6 w-px bg-white/20" />
            <h1 className="text-xl font-bold text-white">
              Preview: <span className="text-red-500">{eventName}</span>
              {isEditorPreview && (
                <span className="ml-2 text-xs font-normal text-yellow-400 bg-yellow-500/20 px-2 py-0.5 rounded">
                  Editor Mode
                </span>
              )}
            </h1>
          </div>
          <div className="text-sm text-gray-400">Tổng: {seats.length} ghế</div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Step 1: Ticket Type Selection */}
        <div className="mb-6 sm:mb-10">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
            <span className="w-8 h-8 sm:w-10 sm:h-10 bg-red-600 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg shadow-red-500/30">
              1
            </span>
            Chọn loại vé
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {ticketTypes.map((tt) => {
              const benefits =
                typeof tt.benefits === "string"
                  ? JSON.parse(tt.benefits)
                  : tt.benefits;
              const isVIP = tt.name.toLowerCase().includes("vip");
              return (
                <div
                  key={tt.id}
                  className="relative p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 cursor-pointer transition-all duration-300 border-white/10 hover:border-red-500/50 bg-white/5 backdrop-blur-sm"
                >
                  {/* VIP Badge */}
                  {isVIP && (
                    <div className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] sm:text-xs font-bold rounded-full mb-2 sm:mb-3 shadow-lg">
                      <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      VIP
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
                        {tt.name}
                      </h3>
                      {tt.subtitle && (
                        <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
                          {tt.subtitle}
                        </p>
                      )}
                      {benefits && benefits.length > 0 && (
                        <ul className="text-xs sm:text-sm text-gray-300 space-y-1.5 sm:space-y-2">
                          {benefits.map((b: string, i: number) => (
                            <li key={i} className="flex items-center gap-2">
                              <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 flex-shrink-0" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xl sm:text-2xl font-black text-red-500">
                        {Number(tt.price).toLocaleString("vi-VN")}đ
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Step 2: Seat Selection */}
        <div className="mb-6 sm:mb-10">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
            <span className="w-8 h-8 sm:w-10 sm:h-10 bg-red-600 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg shadow-red-500/30">
              2
            </span>
            Chọn ghế
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            {/* Seat Map - LEFT SIDE */}
            <div className="lg:col-span-2">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 border border-white/10 relative overflow-hidden">
                {/* Decorative corner elements */}
                <div className="hidden sm:block absolute top-0 left-0 w-24 h-24 border-l-2 border-t-2 border-red-500/20 rounded-tl-2xl pointer-events-none" />
                <div className="hidden sm:block absolute bottom-0 right-0 w-24 h-24 border-r-2 border-b-2 border-red-500/20 rounded-br-2xl pointer-events-none" />

                {/* Stage with enhanced effects */}
                <div className="mb-6 sm:mb-10 relative">
                  {/* Stage glow */}
                  <div className="absolute inset-0 bg-red-600/30 blur-2xl rounded-full transform scale-y-50" />

                  <div className="relative">
                    {/* Stage reflection */}
                    <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 bg-gradient-to-b from-red-500/20 to-transparent blur-lg" />

                    {/* Main stage */}
                    <div className="relative bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white py-3 sm:py-5 px-4 sm:px-8 rounded-lg sm:rounded-xl text-center flex items-center justify-center gap-2 sm:gap-3 shadow-2xl shadow-red-500/40 border border-red-500/50 overflow-hidden group">
                      {/* Animated shine effect */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                      {/* Stage lights indicator */}
                      <div className="hidden sm:flex absolute top-2 left-4 gap-2">
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50" />
                        <div
                          className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50"
                          style={{ animationDelay: "0.3s" }}
                        />
                        <div
                          className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50"
                          style={{ animationDelay: "0.6s" }}
                        />
                      </div>
                      <div className="hidden sm:flex absolute top-2 right-4 gap-2">
                        <div
                          className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50"
                          style={{ animationDelay: "0.6s" }}
                        />
                        <div
                          className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50"
                          style={{ animationDelay: "0.3s" }}
                        />
                        <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse shadow-lg shadow-yellow-400/50" />
                      </div>

                      <Monitor className="w-5 h-5 sm:w-6 sm:h-6" />
                      <span className="font-black uppercase tracking-widest text-sm sm:text-lg">
                        Sân Khấu
                      </span>
                    </div>
                  </div>
                </div>

                {/* Zone Labels */}
                <div className="flex flex-wrap justify-center gap-3 sm:gap-6 md:gap-10 mb-4 sm:mb-8 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded shadow-lg shadow-orange-500/50 animate-pulse"></div>
                    <span className="text-yellow-400 font-semibold">VIP</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/5 border border-white/10">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-emerald-500 rounded shadow-lg shadow-emerald-500/50"></div>
                    <span className="text-gray-300">Standard</span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/5 border border-white/10">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-cyan-500 rounded shadow-lg shadow-cyan-500/50"></div>
                    <span className="text-gray-300">Economy</span>
                  </div>
                </div>

                {/* Seats Grid with Aisle */}
                <div className="overflow-x-auto pb-4">
                  <div className="min-w-[600px] sm:min-w-[500px] space-y-3 sm:space-y-3 px-2">
                    {sortedRows.map((row) => {
                      const rowIsVIP = isVIPRow(row);
                      const rowLabelColor = getRowLabelColor(row);
                      const leftSeats = seatsByRowAndSection[row]?.LEFT || [];
                      const rightSeats = seatsByRowAndSection[row]?.RIGHT || [];

                      const renderSeat = (seat: Seat) => {
                        const colors =
                          SEAT_COLORS[seat.seat_type] || SEAT_COLORS.STANDARD;
                        const soldColors = SOLD_SEAT_COLORS;
                        const isSold = seat.status === "SOLD";
                        return (
                          <button
                            key={seat.id}
                            disabled={isSold}
                            className={`relative w-8 h-9 flex flex-col items-center justify-center transition-all duration-200 group ${
                              isSold
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer hover:brightness-110"
                            }`}
                            title={`${seat.seat_number} - ${Number(seat.price).toLocaleString("vi-VN")}đ${isSold ? " (Đã bán)" : ""}`}
                          >
                            {/* Seat back */}
                            <div
                              className={`w-6 h-4 rounded-t-md bg-gradient-to-b ${isSold ? soldColors.back : colors.back} flex items-center justify-center relative border-t border-l border-r border-white/20`}
                            >
                              {/* Shine effect */}
                              <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-md" />
                              {/* Seat number */}
                              <span
                                className={`relative text-[9px] font-bold ${isSold ? "text-gray-400" : "text-white"}`}
                              >
                                {seat.col}
                              </span>
                            </div>
                            {/* Seat cushion */}
                            <div
                              className={`w-7 h-2.5 rounded-b-sm bg-gradient-to-b ${isSold ? soldColors.cushion : colors.cushion} border-b border-l border-r border-white/10`}
                            />
                            {/* Armrests */}
                            <div
                              className={`absolute bottom-0 -left-0.5 w-0.5 h-2 rounded-b-sm ${isSold ? soldColors.armrest : colors.armrest}`}
                            />
                            <div
                              className={`absolute bottom-0 -right-0.5 w-0.5 h-2 rounded-b-sm ${isSold ? soldColors.armrest : colors.armrest}`}
                            />
                            {/* Sold X indicator */}
                            {isSold && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-4 h-0.5 bg-gray-400 rotate-45 absolute" />
                                <div className="w-4 h-0.5 bg-gray-400 -rotate-45 absolute" />
                              </div>
                            )}
                          </button>
                        );
                      };

                      return (
                        <div
                          key={row}
                          className="flex items-center gap-2 sm:gap-3"
                        >
                          <span
                            className={`w-6 sm:w-8 text-center font-bold text-sm sm:text-base ${rowLabelColor}`}
                          >
                            {row}
                          </span>
                          <div className="flex gap-1 sm:gap-2 flex-1 justify-center items-center">
                            {/* LEFT Section */}
                            <div className="flex gap-1 sm:gap-2">
                              {leftSeats.map(renderSeat)}
                            </div>

                            {/* Aisle - gap between LEFT and RIGHT */}
                            <div
                              className={`${AISLE_WIDTH} flex items-center justify-center`}
                            >
                              <div className="w-px h-6 bg-white/10" />
                            </div>

                            {/* RIGHT Section */}
                            <div className="flex gap-1 sm:gap-2">
                              {rightSeats.map(renderSeat)}
                            </div>
                          </div>
                          <span
                            className={`w-6 sm:w-8 text-center font-bold text-sm sm:text-base ${rowLabelColor}`}
                          >
                            {row}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend with seat-style icons */}
                <div className="flex flex-wrap justify-center gap-4 md:gap-8 mt-10 pt-6 border-t border-white/10">
                  {/* Available seat */}
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="relative w-7 h-9 flex flex-col items-center">
                      <div className="w-5 h-4 rounded-t-md bg-gradient-to-b from-emerald-400 to-emerald-500 border-t border-l border-r border-white/20" />
                      <div className="w-6 h-3 rounded-b-sm bg-gradient-to-b from-emerald-500 to-emerald-600 border-b border-l border-r border-white/10" />
                      <div className="absolute bottom-0 -left-0.5 w-0.5 h-2 rounded-b-sm bg-emerald-600" />
                      <div className="absolute bottom-0 -right-0.5 w-0.5 h-2 rounded-b-sm bg-emerald-600" />
                    </div>
                    <span className="text-gray-300 text-sm font-medium">
                      Trống
                    </span>
                  </div>

                  {/* Sold seat */}
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="relative w-7 h-9 flex flex-col items-center opacity-60">
                      <div className="w-5 h-4 rounded-t-md bg-gradient-to-b from-gray-600 to-gray-700 border-t border-l border-r border-white/10" />
                      <div className="w-6 h-3 rounded-b-sm bg-gradient-to-b from-gray-700 to-gray-800 border-b border-l border-r border-white/10" />
                      <div className="absolute bottom-0 -left-0.5 w-0.5 h-2 rounded-b-sm bg-gray-800" />
                      <div className="absolute bottom-0 -right-0.5 w-0.5 h-2 rounded-b-sm bg-gray-800" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-4 h-0.5 bg-gray-400 rotate-45 absolute" />
                        <div className="w-4 h-0.5 bg-gray-400 -rotate-45 absolute" />
                      </div>
                    </div>
                    <span className="text-gray-300 text-sm font-medium">
                      Đã bán
                    </span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex justify-center gap-8 mt-6 pt-6 border-t border-white/10">
                  {["VIP", "STANDARD", "ECONOMY"].map((type) => {
                    const count = seats.filter(
                      (s) => s.seat_type === type,
                    ).length;
                    const available = seats.filter(
                      (s) => s.seat_type === type && s.status === "AVAILABLE",
                    ).length;
                    if (count === 0) return null;
                    return (
                      <div key={type} className="text-center">
                        <p className="text-xs text-gray-500 uppercase">
                          {type}
                        </p>
                        <p className="text-lg font-bold text-white">
                          {available}
                          <span className="text-gray-500">/{count}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Summary - RIGHT SIDE */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="sticky top-24">
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 relative overflow-hidden">
                  {/* Decorative elements */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-red-600/5 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />

                  <h2 className="relative text-xl font-bold text-white mb-6 flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center">
                      <Ticket className="w-5 h-5 text-red-500" />
                    </div>
                    Tóm tắt đặt vé
                  </h2>

                  {/* Selected Ticket Type */}
                  {ticketTypes.length > 0 && (
                    <div className="relative p-4 bg-gradient-to-r from-red-600/20 to-red-600/10 rounded-xl mb-4 border border-red-500/30 overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full blur-xl" />
                      <p className="text-sm text-gray-400">Loại vé đề xuất</p>
                      <p className="font-bold text-white text-lg">
                        {ticketTypes[0].name}
                      </p>
                      <p className="text-red-500 font-bold text-xl">
                        {Number(ticketTypes[0].price).toLocaleString("vi-VN")}đ
                        <span className="text-sm font-normal text-gray-400">
                          /ghế
                        </span>
                      </p>
                    </div>
                  )}

                  <p className="text-gray-500 text-center py-8">
                    Chưa chọn ghế nào
                  </p>

                  {/* Stats by seat type */}
                  <div className="mt-6 space-y-3">
                    {["VIP", "STANDARD", "ECONOMY"].map((type) => {
                      const count = seats.filter(
                        (s) => s.seat_type === type,
                      ).length;
                      const available = seats.filter(
                        (s) => s.seat_type === type && s.status === "AVAILABLE",
                      ).length;
                      if (count === 0) return null;
                      return (
                        <div
                          key={type}
                          className="flex justify-between items-center p-3 bg-white/5 rounded-lg"
                        >
                          <span className="text-gray-400 text-sm">{type}</span>
                          <span className="text-white font-semibold">
                            {available}/{count} ghế
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total */}
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-400">Tổng số ghế</span>
                      <span className="font-semibold text-white bg-white/10 px-3 py-1 rounded-full">
                        {seats.length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-4 bg-gradient-to-r from-red-600/20 to-transparent rounded-xl -mx-2">
                      <span className="text-lg font-bold text-white">
                        Ghế trống
                      </span>
                      <div className="text-right">
                        <span className="text-2xl font-black text-red-500">
                          {seats.filter((s) => s.status === "AVAILABLE").length}
                        </span>
                        <span className="text-gray-500 ml-1">ghế</span>
                      </div>
                    </div>
                  </div>

                  {/* Preview note */}
                  <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
                    <p className="text-yellow-400 text-sm text-center">
                      🔍 Đây là trang xem trước layout
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
