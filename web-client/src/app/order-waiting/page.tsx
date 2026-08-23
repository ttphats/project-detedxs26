"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { formatVNDate, formatVNTime } from "@/lib/date-utils";
import {
  CheckCircle,
  Loader2,
  Ticket,
  QrCode,
  Users,
  Calendar,
  MapPin,
  AlertTriangle,
  Shield,
  Link2,
  ExternalLink,
} from "lucide-react";

// Polling interval in milliseconds
const POLL_INTERVAL = 5000;
// Ceiling for the backoff applied when the server rate-limits our polling.
const MAX_POLL_INTERVAL = 30000;

interface TicketLine {
  ticketTypeId: string | null;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface TicketUnit {
  id: string;
  index: number;
  ticketCode: string | null;
  qrCodeUrl: string | null;
  typeName: string;
  seatNumber: string | null;
  price: number;
  checkedIn: boolean;
  checkedInAt: string | null;
  attendeeName: string | null;
  attendeeEmail: string | null;
  attendeePhone: string | null;
}

interface TicketData {
  orderNumber: string;
  status: string;
  customerName: string;
  totalAmount: number;
  createdAt: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  qrCodeUrl: string | null;
  canDownload: boolean;
  bookingMode?: "TICKET_CLASS" | "SEAT_MAP";
  ticketLines?: TicketLine[];
  ticketUnits?: TicketUnit[];
  checkInProgress?: { total: number; checkedIn: number; pending: number };
  tokenNeverExpires?: boolean;
  event: {
    id: string;
    name: string;
    venue: string;
    eventDate: string;
    startTime: string;
    doorsOpenTime: string;
    bannerImageUrl: string | null;
    thumbnailUrl: string | null;
  } | null;
  seats: {
    seatNumber: string;
    seatType: string;
    price: number;
    ticketTypeId?: string | null;
    ticketTypeName?: string | null;
  }[];
}

function OrderWaitingContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order");
  const token = searchParams.get("token");

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Fetch ticket status from backend
  const pollDelayRef = useRef(POLL_INTERVAL);
  const isFirstLoadRef = useRef(true);

  const fetchTicketStatus = useCallback(async () => {
    if (!orderNumber || !token) return;

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
      const res = await fetch(`${apiUrl}/ticket/${orderNumber}?token=${token}`);

      // A 429 only means we asked too often. The order is fine, so slow the
      // polling down and try again instead of showing the buyer an error.
      if (res.status === 429) {
        pollDelayRef.current = Math.min(
          pollDelayRef.current * 2,
          MAX_POLL_INTERVAL,
        );
        return;
      }

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch ticket information.");
      }

      pollDelayRef.current = POLL_INTERVAL;
      setTicket(data.data);

      // Check if payment has been confirmed
      if (data.data.status === "PAID") {
        setIsConfirmed(true);
      }
    } catch (err) {
      console.error("[ORDER-WAITING] Fetch error:", err);
      // Only surface an error on the very first load, never mid-poll.
      if (isFirstLoadRef.current) {
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred, please try again later.",
        );
      }
    } finally {
      isFirstLoadRef.current = false;
      setLoading(false);
    }
  }, [orderNumber, token]);

  // Initial fetch
  useEffect(() => {
    fetchTicketStatus();
  }, []);

  // Polling effect - only when not yet confirmed
  useEffect(() => {
    if (isConfirmed || !orderNumber || !token) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = async () => {
      await fetchTicketStatus();
      if (cancelled) return;
      timer = setTimeout(tick, pollDelayRef.current);
    };
    timer = setTimeout(tick, pollDelayRef.current);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isConfirmed, orderNumber, token, fetchTicketStatus]);

  // Format helpers
  const formatDate = (dateString: string) => {
    return formatVNDate(dateString, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTimeLocal = (dateString: string) => {
    return formatVNTime(dateString);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const isTicketClass =
    ticket?.bookingMode === "TICKET_CLASS" ||
    (Array.isArray(ticket?.ticketLines) && ticket!.ticketLines!.length > 0);

  const ticketLines: TicketLine[] = (() => {
    if (!ticket) return [];
    if (ticket.ticketLines?.length) return ticket.ticketLines;
    // Fallback group seats
    const map = new Map<string, TicketLine>();
    for (const s of ticket.seats || []) {
      const name = s.ticketTypeName || s.seatType || "Ticket";
      const key = `${s.ticketTypeId || ""}|${name}|${s.price}`;
      const cur = map.get(key);
      if (cur) {
        cur.quantity += 1;
        cur.lineTotal += s.price;
      } else {
        map.set(key, {
          ticketTypeId: s.ticketTypeId || null,
          name,
          unitPrice: s.price,
          quantity: 1,
          lineTotal: s.price,
        });
      }
    }
    return Array.from(map.values());
  })();

  // Missing params
  if (!orderNumber || !token) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="glass-panel rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Invalid Access</h1>
          <p className="text-gray-400 mb-6">
            Missing order information. Please return to the checkout page.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            Back to home
          </a>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading order information...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="glass-panel rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Error</h1>
          <p className="text-gray-400 mb-6">
            {error || "Could not load order information."}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            Back to home
          </a>
        </div>
      </div>
    );
  }

  // ─── STATE 2: CONFIRMED (PAID) ─── E-Ticket View ───

  // ─── STATE 1: WAITING (PENDING_CONFIRMATION) ───
  return (
    <div className="min-h-screen bg-black">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-20 right-20 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-20 left-20 w-[400px] h-[400px] bg-red-600/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "5s" }}
        />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-12 md:py-20">
        {/* Waiting Card */}
        <div className="glass-panel rounded-3xl p-8 text-center animate-fade-in relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />

          {/* Success mark */}
          <div className="relative mb-8">
            <div className="relative w-24 h-24 mx-auto">
              <div className="absolute inset-0 bg-emerald-500/25 rounded-full blur-xl" />
              <div className="relative w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-black text-white mb-3">
            Payment successful
          </h1>
          <p className="text-gray-400 mb-8 leading-relaxed max-w-sm mx-auto">
            Your ticket will be sent via email soon.
          </p>

          {/* Order Info */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-left mb-6">
            {/* Order Number */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Ticket className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-400">Order Number</span>
              </div>
              <span className="text-lg font-bold text-red-500 font-mono">
                {ticket.orderNumber}
              </span>
            </div>

            {/* Customer */}
            <div className="mb-4 pb-4 border-b border-white/10">
              <p className="text-sm text-gray-400 mb-1">Customer</p>
              <p className="font-semibold text-white">{ticket.customerName}</p>
            </div>

            {/* Event */}
            {ticket.event && (
              <div className="mb-4 pb-4 border-b border-white/10">
                <p className="text-sm text-gray-400 mb-1">Event</p>
                <p className="font-semibold text-white">{ticket.event.name}</p>
                <p className="text-sm text-gray-500">
                  {formatDate(ticket.event.eventDate)}
                </p>
              </div>
            )}

            {/* Tickets / seats summary */}
            <div className="mb-4 pb-4 border-b border-white/10">
              <p className="text-sm text-gray-400 mb-2">
                {isTicketClass ? "Tickets" : "Seats"}
              </p>
              <div className="flex flex-wrap gap-2">
                {isTicketClass
                  ? ticketLines.map((line, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-[#e62b1e]/15 text-[#ff6b5e] rounded-full text-sm font-medium border border-[#e62b1e]/30"
                      >
                        {line.name} × {line.quantity}
                      </span>
                    ))
                  : ticket.seats.map((seat, index) => (
                      <span
                        key={index}
                        className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-full text-sm font-medium border border-red-500/30"
                      >
                        {seat.seatNumber} ({seat.seatType})
                      </span>
                    ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-gray-400">Total</span>
              <span className="text-xl font-bold text-white">
                {formatCurrency(ticket.totalAmount)}
              </span>
            </div>

            {/* Who each ticket belongs to, captured during checkout. */}
            {(ticket.ticketUnits?.length ?? 0) > 0 && (
              <div className="pt-4 border-t border-white/10">
                <p className="text-sm text-gray-400 mb-3">Ticket holders</p>
                <div className="space-y-2.5">
                  {ticket.ticketUnits!.map((unit) => (
                    <div
                      key={unit.id}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                          Ticket {unit.index}
                        </span>
                        <span className="text-[11px] font-semibold text-[#ff6b5e]">
                          {unit.typeName}
                        </span>
                      </div>
                      {unit.attendeeName ? (
                        <>
                          <p className="text-sm font-semibold text-white">
                            {unit.attendeeName}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5 break-all">
                            {[unit.attendeeEmail, unit.attendeePhone]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-500">
                          No attendee details provided
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* Status Info */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-left">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-300 mb-1">
                  What happens next
                </p>
                <p className="text-xs text-blue-400/80 leading-relaxed">
                  Once our team verifies your transfer, each ticket is emailed to
                  the address given for that ticket holder. You can close this
                  page safely.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-8 text-xs text-gray-600">
          <p>
            TEDxFPTUniversityHCMC 2026. For inquiries, please contact our
            fanpage.
          </p>
          <p className="mt-1">© 2026 TEDxFPTUniversityHCMC</p>
        </div>
      </div>
    </div>
  );
}

export default function OrderWaitingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <OrderWaitingContent />
    </Suspense>
  );
}
