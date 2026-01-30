"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Monitor,
  Check,
  Star,
  Ticket,
  Loader2,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { Button, Card, Seat, SeatLegend } from "@/components";

// Generate or get session ID for seat locking
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sessionId = sessionStorage.getItem("seat_session_id");
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    sessionStorage.setItem("seat_session_id", sessionId);
  }
  return sessionId;
}

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
  status: "available" | "selected" | "sold" | "locked" | "locked_by_me";
  ticketTypeId: string;
  seatType?: "VIP" | "STANDARD" | "ECONOMY";
  price: number;
  lockExpiresAt?: string | null;
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
  const [selectedSeats, setSelectedSeats] = useState<SeatType[]>([]);

  // Seat locking states
  const [sessionId, setSessionId] = useState<string>("");
  const [lockExpiresAt, setLockExpiresAt] = useState<Date | null>(null);
  const [lockCountdown, setLockCountdown] = useState<number>(0);
  const [lockError, setLockError] = useState<string | null>(null);
  const [locking, setLocking] = useState<string | null>(null); // seatId being locked
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize session ID on mount
  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  // Fetch event data and restore locks (after sessionId is set)
  useEffect(() => {
    if (!sessionId) return; // Wait for sessionId to be set

    const fetchEventAndRestoreLocks = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch event data
        const res = await fetch(`/api/events/${id}?sessionId=${sessionId}`);
        const data = await res.json();

        if (!data.success) {
          setError(data.error || "Không thể tải dữ liệu sự kiện");
          return;
        }

        setEvent(data.data);

        // Restore locks from this session (for tab sync)
        const locksRes = await fetch(
          `/api/seats/lock?sessionId=${sessionId}&eventId=${id}`,
        );
        const locksData = await locksRes.json();

        if (locksData.success && locksData.data.locks.length > 0) {
          const locks = locksData.data.locks;
          // Restore selected seats from locks
          const restoredSeats: SeatType[] = locks.map(
            (lock: {
              id: string;
              row: string;
              number: number;
              section?: string;
              seatType: string;
              price: number;
              ticketTypeId: string;
            }) => ({
              id: lock.id,
              row: lock.row,
              number: lock.number,
              section: lock.section,
              status: "selected" as const,
              seatType: lock.seatType,
              price: lock.price,
              ticketTypeId: lock.ticketTypeId,
            }),
          );
          setSelectedSeats(restoredSeats);

          // Restore expiration
          if (locksData.data.expiresAt) {
            setLockExpiresAt(new Date(locksData.data.expiresAt));
          }
        }
      } catch (err) {
        console.error("Error fetching event:", err);
        setError("Đã xảy ra lỗi khi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    fetchEventAndRestoreLocks();
  }, [id, sessionId]);

  // BroadcastChannel for syncing between tabs
  useEffect(() => {
    if (!sessionId || typeof window === "undefined") return;

    const channel = new BroadcastChannel(`seat_selection_${id}`);

    channel.onmessage = (event) => {
      const { type, data } = event.data;

      if (type === "SEATS_UPDATED") {
        // Another tab updated seats, refresh our state
        setSelectedSeats(data.selectedSeats || []);
        if (data.expiresAt) {
          setLockExpiresAt(new Date(data.expiresAt));
        } else {
          setLockExpiresAt(null);
        }
      } else if (type === "SEATS_CLEARED") {
        // Another tab cleared all seats
        setSelectedSeats([]);
        setLockExpiresAt(null);
      }
    };

    return () => {
      channel.close();
    };
  }, [id, sessionId]);

  // Polling to refresh seat status every 2 seconds (faster updates for locked seats)
  useEffect(() => {
    if (!id || loading) return;

    const refreshSeats = async () => {
      try {
        const res = await fetch(
          `/api/events/${id}/seats?sessionId=${sessionId}`,
        );
        const data = await res.json();
        if (data.success && event) {
          // Update seat map with current status including locks
          setEvent((prev) =>
            prev ? { ...prev, seatMap: data.data.seatMap } : prev,
          );
        }
      } catch (err) {
        console.error("Error refreshing seats:", err);
      }
    };

    pollingRef.current = setInterval(refreshSeats, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [id, loading, sessionId, event]);

  // Lock countdown timer
  useEffect(() => {
    if (!lockExpiresAt) {
      setLockCountdown(0);
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(
        0,
        Math.floor((lockExpiresAt.getTime() - Date.now()) / 1000),
      );
      setLockCountdown(remaining);

      if (remaining <= 0) {
        // Lock expired, clear selections
        setSelectedSeats([]);
        setLockExpiresAt(null);
        setLockError("Thời gian giữ ghế đã hết. Vui lòng chọn lại.");
      }
    };

    updateCountdown();
    countdownRef.current = setInterval(updateCountdown, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [lockExpiresAt]);

  // Cleanup locks on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (selectedSeats.length > 0 && sessionId) {
        // Use sendBeacon for reliable delivery on page close
        // sendBeacon only supports POST, so use dedicated /api/seats/unlock endpoint
        const data = JSON.stringify({
          seatIds: selectedSeats.map((s) => s.id),
          sessionId,
        });
        navigator.sendBeacon("/api/seats/unlock", data);
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      // Also cleanup on component unmount
      if (selectedSeats.length > 0 && sessionId) {
        fetch("/api/seats/lock", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seatIds: selectedSeats.map((s) => s.id),
            sessionId,
          }),
        }).catch(() => {});
      }
    };
  }, [selectedSeats, sessionId]);

  // Helper to broadcast seat changes to other tabs
  const broadcastSeatChange = useCallback(
    (newSelectedSeats: SeatType[], expiresAt: Date | null) => {
      if (typeof window === "undefined") return;
      try {
        const channel = new BroadcastChannel(`seat_selection_${id}`);
        if (newSelectedSeats.length > 0) {
          channel.postMessage({
            type: "SEATS_UPDATED",
            data: {
              selectedSeats: newSelectedSeats,
              expiresAt: expiresAt?.toISOString(),
            },
          });
        } else {
          channel.postMessage({ type: "SEATS_CLEARED", data: {} });
        }
        channel.close();
      } catch (err) {
        // BroadcastChannel not supported
      }
    },
    [id],
  );

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

  const handleSeatSelect = async (seatId: string) => {
    if (!sessionId) return;
    if (locking) return; // Prevent double-clicking

    const allSeats = event!.seatMap.flatMap((row) => row.seats);
    const seat = allSeats.find((s) => s.id === seatId);
    if (!seat || seat.status === "sold" || seat.status === "locked") return;

    const isSelected = selectedSeats.some((s) => s.id === seatId);
    setLockError(null);

    if (isSelected) {
      // Unlock this seat
      setLocking(seatId);
      try {
        await fetch("/api/seats/lock", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seatIds: [seatId],
            sessionId,
          }),
        });
        const newSelectedSeats = selectedSeats.filter((s) => s.id !== seatId);
        setSelectedSeats(newSelectedSeats);
        // If no more seats selected, clear lock expiration
        const newExpiresAt = newSelectedSeats.length > 0 ? lockExpiresAt : null;
        if (newSelectedSeats.length === 0) {
          setLockExpiresAt(null);
        }
        // Broadcast to other tabs
        broadcastSeatChange(newSelectedSeats, newExpiresAt);
      } catch (err) {
        console.error("Error unlocking seat:", err);
        setLockError("Không thể bỏ chọn ghế. Vui lòng thử lại.");
      } finally {
        setLocking(null);
      }
    } else {
      // Lock this seat
      setLocking(seatId);
      try {
        const res = await fetch("/api/seats/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventId: id,
            seatIds: [...selectedSeats.map((s) => s.id), seatId],
            sessionId,
          }),
        });
        const data = await res.json();

        if (!data.success) {
          setLockError(data.error || "Không thể giữ ghế. Vui lòng thử lại.");
          return;
        }

        // Use seat's own price and type from database
        const seatWithPrice = {
          ...seat,
          ticketTypeId: seat.seatType?.toLowerCase() || "standard",
          price: seat.price,
        };

        const newSelectedSeats = [...selectedSeats, seatWithPrice];
        const newExpiresAt = new Date(data.data.expiresAt);
        setSelectedSeats(newSelectedSeats);
        setLockExpiresAt(newExpiresAt);
        // Broadcast to other tabs
        broadcastSeatChange(newSelectedSeats, newExpiresAt);
      } catch (err) {
        console.error("Error locking seat:", err);
        setLockError("Không thể giữ ghế. Vui lòng thử lại.");
      } finally {
        setLocking(null);
      }
    }
  };

  // Format countdown timer
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
        {/* Lock countdown timer - Fixed position */}
        {selectedSeats.length > 0 && lockCountdown > 0 && (
          <div className="fixed top-20 right-4 z-50 animate-fade-in">
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
                lockCountdown <= 60 ? "bg-red-600/90" : "bg-yellow-600/90"
              }`}
            >
              <Clock className="w-4 h-4 text-white" />
              <span className="text-white font-bold text-sm">
                Giữ ghế: {formatCountdown(lockCountdown)}
              </span>
            </div>
          </div>
        )}

        {/* Lock error notification */}
        {lockError && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in-down">
            <div className="flex items-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg shadow-lg">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{lockError}</span>
              <button
                onClick={() => setLockError(null)}
                className="ml-2 text-white/80 hover:text-white"
              >
                ✕
              </button>
            </div>
          </div>
        )}

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
            Chọn ghế ngồi của bạn
          </p>
        </div>

        {/* Ticket Types Description */}
        <div className="mb-6 sm:mb-8 animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {event.ticketTypes.map((ticketType) => {
              const isVIP = ticketType.name.toUpperCase().includes("VIP");
              return (
                <div
                  key={ticketType.id}
                  className={`glass-panel rounded-xl p-4 sm:p-5 border ${
                    isVIP
                      ? "border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-yellow-500/5"
                      : "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-green-500/5"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          isVIP
                            ? "bg-gradient-to-br from-yellow-400 to-orange-500"
                            : "bg-gradient-to-br from-emerald-400 to-emerald-600"
                        }`}
                      >
                        {isVIP ? (
                          <Star className="w-5 h-5 text-white" />
                        ) : (
                          <Ticket className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg">
                          {ticketType.name}
                        </h3>
                        {ticketType.subtitle && (
                          <p className="text-xs text-gray-400">
                            {ticketType.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-black text-xl ${
                          isVIP ? "text-orange-400" : "text-emerald-400"
                        }`}
                      >
                        {ticketType.price.toLocaleString("vi-VN")}đ
                      </p>
                    </div>
                  </div>
                  {ticketType.benefits && ticketType.benefits.length > 0 && (
                    <ul className="space-y-1.5">
                      {ticketType.benefits.slice(0, 4).map((benefit, idx) => (
                        <li
                          key={idx}
                          className="flex items-center gap-2 text-sm text-gray-300"
                        >
                          <Check
                            className={`w-4 h-4 flex-shrink-0 ${
                              isVIP ? "text-orange-400" : "text-emerald-400"
                            }`}
                          />
                          <span>{benefit}</span>
                        </li>
                      ))}
                      {ticketType.benefits.length > 4 && (
                        <li className="text-xs text-gray-500 pl-6">
                          +{ticketType.benefits.length - 4} quyền lợi khác
                        </li>
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Seat Selection */}
        <div className="transition-all duration-500">
          <h2 className="text-lg sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="w-8 h-8 sm:w-10 sm:h-10 bg-red-600 shadow-lg shadow-red-500/30 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold">
              1
            </span>
            <span>Chọn ghế ngồi</span>
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
                          className="flex items-center gap-2 sm:gap-3 transition-opacity duration-300"
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
                                  onSelect={handleSeatSelect}
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
                                  onSelect={handleSeatSelect}
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

                  {/* Locked seat */}
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="relative w-7 h-9 flex flex-col items-center opacity-60">
                      {/* Seat back */}
                      <div className="w-5 h-4 rounded-t-md bg-gradient-to-b from-amber-500 to-amber-600 border-t border-l border-r border-white/10" />
                      {/* Seat cushion */}
                      <div className="w-6 h-3 rounded-b-sm bg-gradient-to-b from-amber-600 to-amber-700 border-b border-l border-r border-white/10" />
                      {/* Armrests */}
                      <div className="absolute bottom-0 -left-0.5 w-0.5 h-2 rounded-b-sm bg-amber-700" />
                      <div className="absolute bottom-0 -right-0.5 w-0.5 h-2 rounded-b-sm bg-amber-700" />
                      {/* Clock indicator */}
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full flex items-center justify-center">
                        <Clock className="w-2 h-2 text-white" />
                      </div>
                    </div>
                    <span className="text-gray-300 text-sm font-medium">
                      Đang giữ
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
                              <span
                                className={`text-xs ml-2 px-2 py-0.5 rounded-full ${
                                  seat.seatType === "VIP"
                                    ? "bg-orange-500/20 text-orange-400"
                                    : "bg-emerald-500/20 text-emerald-400"
                                }`}
                              >
                                {seat.seatType || "STANDARD"}
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
                          ? `/checkout?event=${id}&seats=${selectedSeats.map((s) => s.id).join(",")}`
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
                    {selectedSeats.length > 0
                      ? `${selectedSeats.filter((s) => s.seatType === "VIP").length > 0 ? "VIP" : ""}${selectedSeats.filter((s) => s.seatType === "VIP").length > 0 && selectedSeats.filter((s) => s.seatType !== "VIP").length > 0 ? " + " : ""}${selectedSeats.filter((s) => s.seatType !== "VIP").length > 0 ? "STANDARD" : ""}`
                      : "Chọn ghế để đặt vé"}
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
                  ? `/checkout?event=${id}&seats=${selectedSeats.map((s) => s.id).join(",")}`
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
