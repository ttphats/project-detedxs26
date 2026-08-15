"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatVNDate, formatVNTime } from "@/lib/date-utils";
import {
  Clock,
  Loader2,
  Ticket,
  Users,
  Calendar,
  MapPin,
  AlertTriangle,
  Shield,
} from "lucide-react";

// Polling interval in milliseconds. The ticket status endpoint is rate-limited
// to 10 requests/minute per IP — 8s keeps a single session comfortably under
// that, and BASE/MAX bound the backoff applied when a 429 is hit anyway
// (e.g. multiple tabs/orders sharing one IP).
const BASE_POLL_INTERVAL = 8000;
const MAX_POLL_INTERVAL = 60000;

interface TicketData {
  orderNumber: string;
  status: string;
  customerName: string;
  totalAmount: number;
  createdAt: string;
  checkedIn: boolean;
  checkedInAt: string | null;
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
  tickets: {
    id: string;
    ticketTypeName: string;
    price: number;
    attendeeName: string | null;
    attendeeEmail: string | null;
    attendeePhone: string | null;
  }[];
}

function OrderWaitingContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order");
  const token = searchParams.get("token");

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Refs let the self-scheduling poll loop below read current values without
  // being recreated (and thus without re-triggering the scheduling effect)
  // on every state update.
  const ticketRef = useRef<TicketData | null>(null);
  const isConfirmedRef = useRef(false);
  const pollDelayRef = useRef(BASE_POLL_INTERVAL);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch ticket status from backend. Returns true if the request was
  // rate-limited (429), so the caller can back off before retrying.
  const fetchTicketStatus = useCallback(async (): Promise<boolean> => {
    if (!orderNumber || !token) return false;

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
      const res = await fetch(
        `${apiUrl}/ticket/${orderNumber}?token=${token}`,
      );

      if (res.status === 429) {
        console.warn("[ORDER-WAITING] Rate limited — backing off polling.");
        return true;
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch ticket information.");
      }

      setTicket(data.data);
      ticketRef.current = data.data;

      // Once paid, stop polling. There's no separate confirmed screen —
      // tickets are emailed to each attendee instead, so this page stays
      // on the same view.
      if (data.data.status === "PAID") {
        isConfirmedRef.current = true;
      }
    } catch (err) {
      console.error("[ORDER-WAITING] Fetch error:", err);
      // Only surface an error screen if we've never loaded the ticket yet —
      // a transient failure during polling shouldn't blow away an already
      // rendered view.
      if (!ticketRef.current) {
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred, please try again later.",
        );
      }
    } finally {
      setLoading(false);
    }
    return false;
  }, [orderNumber, token]);

  // Self-scheduling poll loop: fetch, then schedule the next fetch via
  // setTimeout (not setInterval) so a slow request can't overlap with the
  // next tick. Stops once confirmed, and always cleans up its pending
  // timeout on unmount so no duplicate/orphaned timers can accumulate.
  useEffect(() => {
    if (!orderNumber || !token) return;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      const rateLimited = await fetchTicketStatus();
      if (cancelled || isConfirmedRef.current) return;

      // Standard exponential backoff on 429, reset once requests succeed
      pollDelayRef.current = rateLimited
        ? Math.min(pollDelayRef.current * 2, MAX_POLL_INTERVAL)
        : BASE_POLL_INTERVAL;

      pollTimeoutRef.current = setTimeout(poll, pollDelayRef.current);
    };

    poll();

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [orderNumber, token, fetchTicketStatus]);

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

  // Missing params
  if (!orderNumber || !token) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="glass-panel rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Invalid Access
          </h1>
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

          {/* Waiting Animation */}
          <div className="relative mb-8">
            <div className="relative w-24 h-24 mx-auto">
              {/* Spinning ring */}
              <div className="absolute inset-0 rounded-full border-4 border-blue-500/20" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
              {/* Inner icon */}
              <div className="absolute inset-2 bg-gradient-to-br from-blue-600/30 to-blue-800/30 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Clock className="w-10 h-10 text-blue-400" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="text-2xl md:text-3xl font-black text-white mb-3">
            Verifying Your Payment
          </h1>
          <p className="text-gray-400 mb-8 leading-relaxed max-w-sm mx-auto">
            Payment successful — your ticket will be sent to each attendee&apos;s
            email soon.
          </p>

          {/* Pulsing dots indicator */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div
              className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0s" }}
            />
            <div
              className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.2s" }}
            />
            <div
              className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"
              style={{ animationDelay: "0.4s" }}
            />
          </div>

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
                <p className="text-sm text-gray-400 mb-2">Event</p>
                <p className="font-semibold text-white mb-3">
                  {ticket.event.name}
                </p>

                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">
                        Date
                      </p>
                      <p className="text-sm text-white">
                        {formatDate(ticket.event.eventDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">
                        Time
                      </p>
                      <p className="text-sm text-white">
                        {formatTimeLocal(ticket.event.startTime)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wide">
                        Venue
                      </p>
                      <p className="text-sm text-white">{ticket.event.venue}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Attendee Information */}
            <div className="mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4 text-gray-500" />
                <p className="text-sm text-gray-400">
                  Attendee Information ({ticket.tickets.length})
                </p>
              </div>
              <div className="space-y-2">
                {ticket.tickets.map((t, index) => (
                  <div
                    key={index}
                    className="p-3 bg-black/30 rounded-xl border border-white/5"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold text-red-400">
                        Ticket {index + 1}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-red-600/20 text-red-400 rounded-full font-medium border border-red-500/30">
                        {t.ticketTypeName}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-white truncate">
                      {t.attendeeName || "-"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {t.attendeeEmail || "-"} · {t.attendeePhone || "-"}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total</span>
              <span className="text-xl font-bold text-white">
                {formatCurrency(ticket.totalAmount)}
              </span>
            </div>
          </div>

          {/* Status Info */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
            <div className="flex items-start gap-3 text-left">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-300 mb-1">
                  Do not close or leave this page
                </p>
                <p className="text-xs text-blue-400/80 leading-relaxed">
                  If you close or navigate away, you won&apos;t be able to
                  reopen this session page. Don&apos;t worry — once your
                  payment has been verified, your confirmed e-ticket will be
                  sent directly to the email address you provided.
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
