"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Monitor,
  Check,
  Star,
  Ticket,
  Loader2,
} from "lucide-react";
import { Button, Card, Seat, SeatLegend } from "@/components";

// Types for API response
interface TicketType {
  id: string;
  name: string;
  price: number;
  description: string;
  subtitle?: string;
  benefits?: string[];
  color?: string;
  icon?: string;
}

interface SeatType {
  id: string;
  row: string;
  number: number;
  section?: string;
  status: "available" | "selected" | "sold";
  ticketTypeId: string;
  seatType?: "VIP" | "STANDARD" | "ECONOMY";
  price: number;
}

interface SeatRow {
  row: string;
  seats: SeatType[];
}

interface EventData {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string | null;
  date: string;
  time: string;
  venue: string;
  location: string;
  ticketTypes: TicketType[];
  seatMap: SeatRow[];
  stats: {
    total: number;
    available: number;
    sold: number;
  };
}

export default function SeatSelectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicketType, setSelectedTicketType] =
    useState<TicketType | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<SeatType[]>([]);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/events/${id}`);
        const data = await res.json();

        if (!data.success) {
          setError(data.error || "Không thể tải dữ liệu sự kiện");
          return;
        }

        setEvent(data.data);
      } catch (err) {
        console.error("Error fetching event:", err);
        setError("Đã xảy ra lỗi khi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [id]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  // Error or not found state
  if (error || !event) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">
            {error || "Không tìm thấy sự kiện"}
          </h1>
          <Link href="/">
            <Button>Quay về trang chủ</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleTicketSelect = (ticketType: TicketType) => {
    setSelectedTicketType(ticketType);
    setSelectedSeats([]); // Reset seats when ticket type changes
  };

  const handleSeatSelect = (seatId: string) => {
    if (!selectedTicketType) return;

    const allSeats = event.seatMap.flatMap((row) => row.seats);
    const seat = allSeats.find((s) => s.id === seatId);
    if (!seat || seat.status === "sold") return;

    // Create a new seat with the selected ticket type's price
    const seatWithTicketPrice = {
      ...seat,
      ticketTypeId: selectedTicketType.id,
      price: selectedTicketType.price,
    };

    setSelectedSeats((prev) => {
      const isSelected = prev.some((s) => s.id === seatId);
      if (isSelected) {
        return prev.filter((s) => s.id !== seatId);
      }
      return [...prev, seatWithTicketPrice];
    });
  };

  const totalPrice = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);

  return (
    <div className="min-h-screen bg-black pt-24 pb-12">
      {/* Enhanced Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Animated gradient orbs */}
        <div
          className="absolute top-20 right-20 w-[500px] h-[500px] bg-red-600/15 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-20 left-20 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "5s", animationDelay: "1s" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/5 rounded-full blur-3xl animate-morph" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        />

        {/* Floating particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-red-500/50 rounded-full animate-float" />
        <div
          className="absolute top-1/3 right-1/4 w-3 h-3 bg-red-500/30 rounded-full animate-float"
          style={{ animationDelay: "-1s" }}
        />
        <div
          className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-red-500/40 rounded-full animate-float"
          style={{ animationDelay: "-2s" }}
        />
        <div
          className="absolute top-2/3 right-1/3 w-1.5 h-1.5 bg-white/30 rounded-full animate-float"
          style={{ animationDelay: "-0.5s" }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-10 animate-fade-in-down">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-red-500 transition-colors mb-4 sm:mb-6 group mobile-tap-feedback py-2"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm sm:text-base">Quay lại trang chủ</span>
          </Link>
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black text-white ted-logo-text mb-1 sm:mb-2">
            {event.name}
          </h1>
          <p className="text-gray-400 text-sm sm:text-lg">
            Chọn loại vé và ghế ngồi của bạn
          </p>
        </div>

        {/* Step 1: Ticket Type Selection */}
        <div className="mb-6 sm:mb-10 animate-fade-in-up">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
            <span className="w-8 h-8 sm:w-10 sm:h-10 bg-red-600 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold shadow-lg shadow-red-500/30">
              1
            </span>
            Chọn loại vé
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {event.ticketTypes.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => handleTicketSelect(ticket)}
                className={`relative p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 cursor-pointer transition-all duration-300 hover-lift glass-panel mobile-tap-feedback ${
                  selectedTicketType?.id === ticket.id
                    ? "border-red-600 shadow-lg shadow-red-500/30"
                    : "border-white/10 hover:border-red-500/50"
                }`}
              >
                {/* Selected Indicator */}
                {selectedTicketType?.id === ticket.id && (
                  <div className="absolute top-3 right-3 sm:top-4 sm:right-4 w-6 h-6 sm:w-8 sm:h-8 bg-red-600 rounded-full flex items-center justify-center animate-scale-in shadow-lg shadow-red-500/50">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  </div>
                )}

                {/* VIP Badge - show for ticket types with VIP in name */}
                {ticket.name.toLowerCase().includes("vip") && (
                  <div className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-[10px] sm:text-xs font-bold rounded-full mb-2 sm:mb-3 shadow-lg">
                    <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    VIP
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-8 sm:pr-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
                      {ticket.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-400 mb-3 sm:mb-4">
                      {ticket.subtitle || ticket.description}
                    </p>
                    <ul className="text-xs sm:text-sm text-gray-300 space-y-1.5 sm:space-y-2">
                      {ticket.benefits && ticket.benefits.length > 0 ? (
                        ticket.benefits.map((benefit, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 shrink-0" />
                            {benefit}
                          </li>
                        ))
                      ) : (
                        <li className="flex items-center gap-2">
                          <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 shrink-0" />
                          {ticket.description}
                        </li>
                      )}
                    </ul>
                  </div>
                  <div className="text-right ml-2 sm:ml-4">
                    <p className="text-xl sm:text-2xl md:text-3xl font-black text-red-500">
                      {ticket.price.toLocaleString("vi-VN")}đ
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">/người</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Step 2: Seat Selection */}
        <div
          className={`transition-all duration-500 ${selectedTicketType ? "opacity-100" : "opacity-50 pointer-events-none"}`}
        >
          <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 flex-wrap">
            <span
              className={`w-8 h-8 sm:w-10 sm:h-10 ${selectedTicketType ? "bg-red-600 shadow-lg shadow-red-500/30" : "bg-gray-700"} text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold`}
            >
              2
            </span>
            <span>Chọn ghế ngồi</span>
            {!selectedTicketType && (
              <span className="text-xs sm:text-sm font-normal text-gray-500 w-full sm:w-auto sm:ml-2">
                (Vui lòng chọn loại vé trước)
              </span>
            )}
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8">
            {/* Seat Map */}
            <div className="lg:col-span-2">
              <div className="glass-panel rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 animate-fade-in relative overflow-hidden">
                {/* Decorative corner elements - hidden on mobile */}
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

                      {/* Stage lights indicator - hidden on mobile */}
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

                {/* Zone Labels with enhanced styling */}
                <div className="flex flex-wrap justify-center gap-3 sm:gap-6 md:gap-10 mb-4 sm:mb-8 text-xs sm:text-sm">
                  <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/30">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded shadow-lg shadow-orange-500/50 animate-pulse"></div>
                    <span className="text-yellow-400 font-semibold">
                      VIP (A-B)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/5 border border-white/10">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-emerald-500 rounded shadow-lg shadow-emerald-500/50"></div>
                    <span className="text-gray-300">Tiêu chuẩn (C-H)</span>
                  </div>
                </div>

                {/* Seats Grid */}
                <div className="overflow-x-auto mobile-hide-scrollbar pb-4">
                  {/* Mobile scroll hint */}
                  <p className="text-center text-gray-500 text-xs mb-3 sm:hidden">
                    ← Vuốt ngang để xem thêm ghế →
                  </p>
                  <div className="min-w-[600px] sm:min-w-[500px] space-y-3 sm:space-y-3 px-2">
                    {event.seatMap.map((row) => {
                      // Check if this row contains VIP seats based on seatType from DB
                      const hasVIPSeats = row.seats.some(
                        (s) => s.seatType === "VIP",
                      );
                      // Determine if row should be disabled based on selected ticket type
                      const isVIPTicketSelected =
                        selectedTicketType?.name
                          .toLowerCase()
                          .includes("vip") ?? false;
                      const rowDisabled = isVIPTicketSelected
                        ? !hasVIPSeats
                        : hasVIPSeats;

                      // Split seats into LEFT and RIGHT sections
                      const leftSeats = row.seats
                        .filter((s) => s.section === "LEFT")
                        .sort((a, b) => a.number - b.number);
                      const rightSeats = row.seats
                        .filter((s) => s.section === "RIGHT")
                        .sort((a, b) => a.number - b.number);

                      return (
                        <div
                          key={row.row}
                          className={`flex items-center gap-2 sm:gap-3 transition-opacity duration-300 ${rowDisabled && selectedTicketType ? "opacity-30" : ""}`}
                        >
                          <span
                            className={`w-6 sm:w-8 text-center font-bold text-sm sm:text-base ${hasVIPSeats ? "text-orange-400" : "text-gray-500"}`}
                          >
                            {row.row}
                          </span>
                          <div className="flex gap-1 sm:gap-2 flex-1 justify-center items-center">
                            {/* LEFT section */}
                            <div className="flex gap-1 sm:gap-2">
                              {leftSeats.map((seat) => (
                                <Seat
                                  key={seat.id}
                                  {...seat}
                                  status={
                                    selectedSeats.some((s) => s.id === seat.id)
                                      ? "selected"
                                      : seat.status
                                  }
                                  onSelect={
                                    rowDisabled && selectedTicketType
                                      ? undefined
                                      : handleSeatSelect
                                  }
                                />
                              ))}
                            </div>
                            {/* Aisle */}
                            <div className="w-6 sm:w-10 flex items-center justify-center">
                              <div className="w-px h-6 bg-white/10" />
                            </div>
                            {/* RIGHT section */}
                            <div className="flex gap-1 sm:gap-2">
                              {rightSeats.map((seat) => (
                                <Seat
                                  key={seat.id}
                                  {...seat}
                                  status={
                                    selectedSeats.some((s) => s.id === seat.id)
                                      ? "selected"
                                      : seat.status
                                  }
                                  onSelect={
                                    rowDisabled && selectedTicketType
                                      ? undefined
                                      : handleSeatSelect
                                  }
                                />
                              ))}
                            </div>
                          </div>
                          <span
                            className={`w-6 sm:w-8 text-center font-bold text-sm sm:text-base ${hasVIPSeats ? "text-orange-400" : "text-gray-500"}`}
                          >
                            {row.row}
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
                      {/* Seat back */}
                      <div className="w-5 h-4 rounded-t-md bg-gradient-to-b from-emerald-400 to-emerald-500 border-t border-l border-r border-white/20" />
                      {/* Seat cushion */}
                      <div className="w-6 h-3 rounded-b-sm bg-gradient-to-b from-emerald-500 to-emerald-600 border-b border-l border-r border-white/10" />
                      {/* Armrests */}
                      <div className="absolute bottom-0 -left-0.5 w-0.5 h-2 rounded-b-sm bg-emerald-600" />
                      <div className="absolute bottom-0 -right-0.5 w-0.5 h-2 rounded-b-sm bg-emerald-600" />
                    </div>
                    <span className="text-gray-300 text-sm font-medium">
                      Trống
                    </span>
                  </div>

                  {/* Selected seat */}
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="relative w-7 h-9 flex flex-col items-center">
                      {/* Glow */}
                      <div className="absolute inset-0 bg-red-500/30 blur-sm rounded animate-pulse" />
                      {/* Seat back */}
                      <div className="relative w-5 h-4 rounded-t-md bg-gradient-to-b from-red-500 to-red-600 border-t border-l border-r border-white/20 shadow-lg shadow-red-500/50" />
                      {/* Seat cushion */}
                      <div className="relative w-6 h-3 rounded-b-sm bg-gradient-to-b from-red-600 to-red-700 border-b border-l border-r border-white/10" />
                      {/* Armrests */}
                      <div className="absolute bottom-0 -left-0.5 w-0.5 h-2 rounded-b-sm bg-red-700" />
                      <div className="absolute bottom-0 -right-0.5 w-0.5 h-2 rounded-b-sm bg-red-700" />
                      {/* Checkmark */}
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center shadow">
                        <svg
                          className="w-2 h-2 text-red-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth="3"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    </div>
                    <span className="text-gray-300 text-sm font-medium">
                      Đã chọn
                    </span>
                  </div>

                  {/* Sold seat */}
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="relative w-7 h-9 flex flex-col items-center opacity-60">
                      {/* Seat back */}
                      <div className="w-5 h-4 rounded-t-md bg-gradient-to-b from-gray-600 to-gray-700 border-t border-l border-r border-white/10" />
                      {/* Seat cushion */}
                      <div className="w-6 h-3 rounded-b-sm bg-gradient-to-b from-gray-700 to-gray-800 border-b border-l border-r border-white/10" />
                      {/* Armrests */}
                      <div className="absolute bottom-0 -left-0.5 w-0.5 h-2 rounded-b-sm bg-gray-800" />
                      <div className="absolute bottom-0 -right-0.5 w-0.5 h-2 rounded-b-sm bg-gray-800" />
                      {/* X indicator */}
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
              </div>
            </div>

            {/* Summary with enhanced styling - Hidden on mobile */}
            <div className="hidden lg:block lg:col-span-1">
              <div className="sticky top-24">
                <div className="glass-panel rounded-2xl p-6 animate-fade-in-right relative overflow-hidden">
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
                  {selectedTicketType && (
                    <div className="relative p-4 bg-gradient-to-r from-red-600/20 to-red-600/10 rounded-xl mb-4 border border-red-500/30 overflow-hidden">
                      <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-full blur-xl" />
                      <p className="text-sm text-gray-400">Loại vé đã chọn</p>
                      <p className="font-bold text-white text-lg">
                        {selectedTicketType.name}
                      </p>
                      <p className="text-red-500 font-bold text-xl">
                        {selectedTicketType.price.toLocaleString("vi-VN")}đ
                        <span className="text-sm font-normal text-gray-400">
                          /ghế
                        </span>
                      </p>
                    </div>
                  )}

                  {selectedSeats.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">
                      Chưa chọn ghế nào
                    </p>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {selectedSeats.map((seat, index) => (
                          <div
                            key={seat.id}
                            className="flex justify-between items-center py-3 border-b border-white/10 animate-fade-in-left"
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            <div>
                              <span className="font-semibold text-white">
                                Ghế {seat.row}
                                {seat.number}
                              </span>
                              <span className="text-sm text-gray-400 ml-2">
                                ({selectedTicketType?.name})
                              </span>
                            </div>
                            <span className="font-semibold text-red-500">
                              {seat.price.toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 border-t-2 border-white/20 relative">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-gray-400">Số ghế</span>
                          <span className="font-semibold text-white bg-white/10 px-3 py-1 rounded-full">
                            {selectedSeats.length}
                          </span>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-gradient-to-r from-red-600/20 to-transparent rounded-xl -mx-2">
                          <span className="text-lg font-bold text-white">
                            Tổng cộng
                          </span>
                          <div className="text-right">
                            <span className="text-2xl md:text-3xl font-black text-red-500 animate-glow-text">
                              {totalPrice.toLocaleString("vi-VN")}đ
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-6 relative">
                    <Link
                      href={
                        selectedSeats.length > 0
                          ? `/checkout?event=${id}&seats=${selectedSeats.map((s) => s.id).join(",")}&ticket=${selectedTicketType?.id}`
                          : "#"
                      }
                    >
                      <button
                        className={`relative w-full py-4 px-6 rounded-xl font-bold text-white flex items-center justify-center gap-3 transition-all duration-300 overflow-hidden group ${
                          selectedSeats.length === 0
                            ? "bg-gray-700 cursor-not-allowed opacity-50"
                            : "bg-gradient-to-r from-red-600 to-red-500 shadow-xl shadow-red-500/40 hover:shadow-red-500/60 hover-lift"
                        }`}
                        disabled={selectedSeats.length === 0}
                      >
                        {/* Shine effect */}
                        {selectedSeats.length > 0 && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        )}
                        <span className="relative">Tiến hành thanh toán</span>
                        <ArrowRight className="relative w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </Link>

                    {/* Glow effect under button */}
                    {selectedSeats.length > 0 && (
                      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-4 bg-red-600/50 blur-xl rounded-full" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Checkout Bar */}
      <div className="lg:hidden fixed bottom-16 left-0 right-0 z-40 animate-fade-in-up">
        <div className="mx-4 mb-2">
          <div className="glass-panel rounded-2xl p-4 shadow-2xl shadow-black/50 border border-white/10">
            {/* Selected seats summary */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600/20 rounded-xl flex items-center justify-center">
                  <Ticket className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-400">
                    {selectedTicketType
                      ? selectedTicketType.name
                      : "Chưa chọn loại vé"}
                  </p>
                  <p className="text-white font-bold">
                    {selectedSeats.length > 0 ? (
                      <span className="flex items-center gap-2">
                        <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
                          {selectedSeats.length} ghế
                        </span>
                        <span className="text-gray-400 text-sm">
                          {selectedSeats
                            .slice(0, 3)
                            .map((s) => `${s.row}${s.number}`)
                            .join(", ")}
                          {selectedSeats.length > 3 && "..."}
                        </span>
                      </span>
                    ) : (
                      <span className="text-gray-500 text-sm">
                        Chưa chọn ghế
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Tổng cộng</p>
                <p className="text-xl font-black text-red-500">
                  {totalPrice.toLocaleString("vi-VN")}đ
                </p>
              </div>
            </div>

            {/* Checkout button */}
            <Link
              href={
                selectedSeats.length > 0
                  ? `/checkout?event=${id}&seats=${selectedSeats.map((s) => s.id).join(",")}&ticket=${selectedTicketType?.id}`
                  : "#"
              }
            >
              <button
                className={`relative w-full py-3.5 px-6 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all duration-300 overflow-hidden group ${
                  selectedSeats.length === 0
                    ? "bg-gray-700 cursor-not-allowed opacity-50"
                    : "bg-gradient-to-r from-red-600 to-red-500 shadow-lg shadow-red-500/40 active:scale-[0.98]"
                }`}
                disabled={selectedSeats.length === 0}
              >
                {/* Shine effect */}
                {selectedSeats.length > 0 && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                )}
                <span className="relative">Thanh toán ngay</span>
                <ArrowRight className="relative w-5 h-5" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
