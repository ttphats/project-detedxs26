"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { formatVNDate, formatVNTime } from "@/lib/date-utils";
import {
  Clock,
  CheckCircle,
  Loader2,
  Download,
  Ticket,
  Sparkles,
  QrCode,
  Users,
  Calendar,
  MapPin,
  AlertTriangle,
  Shield,
  Copy,
  Link2,
  ExternalLink,
} from "lucide-react";

// Polling interval in milliseconds
const POLL_INTERVAL = 5000;

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
  seatNumber: string;
  price: number;
  checkedIn: boolean;
  checkedInAt: string | null;
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
  const [downloading, setDownloading] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch ticket status from backend
  const fetchTicketStatus = useCallback(async () => {
    if (!orderNumber || !token) return;

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
      const res = await fetch(`${apiUrl}/ticket/${orderNumber}?token=${token}`);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to fetch ticket information.");
      }

      setTicket(data.data);

      // Check if payment has been confirmed
      if (data.data.status === "PAID") {
        setIsConfirmed(true);
        setShowConfetti(true);
        // Hide confetti after animation
        setTimeout(() => setShowConfetti(false), 4000);
      }
    } catch (err) {
      console.error("[ORDER-WAITING] Fetch error:", err);
      // Only set error on first load, not during polling
      if (loading) {
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred, please try again later.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [orderNumber, token, loading]);

  // Initial fetch
  useEffect(() => {
    fetchTicketStatus();
  }, []);

  // Polling effect - only when not yet confirmed
  useEffect(() => {
    if (isConfirmed || !orderNumber || !token) return;

    const interval = setInterval(() => {
      fetchTicketStatus();
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
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

  const ticketUrl =
    typeof window !== "undefined" && orderNumber && token
      ? `${window.location.origin}/ticket/${orderNumber}?token=${token}`
      : "";

  // Permanent ticket link — access token is hash-verified and does NOT expire by time
  const handleCopyLink = async () => {
    if (!ticketUrl) return;
    try {
      await navigator.clipboard.writeText(ticketUrl);
      setCopied(true);
      toast.success("Ticket link copied — save it to reopen anytime");
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy:", err);
      toast.error("Could not copy link");
    }
  };

  // Download ticket as PDF
  const handleDownload = async () => {
    if (!ticket) return;

    setDownloading(true);
    try {
      const response = await fetch(
        `/api/ticket/${orderNumber}/pdf?token=${token}`,
      );

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ticket-${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Ticket downloaded successfully!");
    } catch (err) {
      console.error("Failed to download:", err);
      toast.error("Failed to download ticket. Please try again.");
    } finally {
      setDownloading(false);
    }
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
  if (isConfirmed) {
    return (
      <div className="min-h-screen bg-black">
        {/* Confetti Effect */}
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="absolute animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${2 + Math.random() * 3}s`,
                }}
              >
                <div
                  className="w-2 h-3 rounded-sm"
                  style={{
                    backgroundColor: [
                      "#ef4444",
                      "#f59e0b",
                      "#10b981",
                      "#3b82f6",
                      "#8b5cf6",
                      "#ec4899",
                    ][i % 6],
                    transform: `rotate(${Math.random() * 360}deg)`,
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Animated Background */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-red-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-lg mx-auto px-4 py-8 md:py-12">
          {/* Success Header */}
          <div className="text-center mb-8 animate-fade-in">
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl animate-pulse" />
              <div className="relative w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/40">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white mb-2">
              Payment Confirmed!
            </h1>
            <p className="text-gray-400">
              Your ticket is ready. Please download it below.
            </p>
          </div>

          {/* Save ticket link — token does NOT expire by time */}
          <div className="mb-6 p-4 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-orange-500/10 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                <Link2 className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-amber-300 mb-1">
                  Save your ticket link
                </h3>
                <p className="text-sm text-amber-100/85 leading-relaxed mb-3">
                  Copy and bookmark this URL to open your e-ticket anytime. The
                  access token <strong>does not expire</strong> — only keep it
                  private. A copy was also sent to your email.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/40 border border-white/10 font-mono text-[11px] text-gray-400 truncate">
                    {ticketUrl}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#e62b1e] hover:bg-[#c41e12] text-white text-sm font-bold shrink-0 transition-colors"
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                    {copied ? "Copied" : "Copy URL"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Ticket Card */}
          <div className="relative">
            {/* Ticket Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600/30 via-emerald-500/20 to-emerald-600/30 rounded-3xl blur-xl opacity-75" />

            {/* Ticket Container */}
            <div className="relative bg-gradient-to-b from-zinc-900 to-black rounded-3xl overflow-hidden border border-white/10">
              {/* Top Section - Event Info */}
              <div className="relative p-6 pb-8">
                {ticket.event?.bannerImageUrl && (
                  <div
                    className="absolute inset-0 opacity-30"
                    style={{
                      backgroundImage: `url(${ticket.event.bannerImageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-emerald-900/50 via-black/80 to-black" />

                <div className="relative">
                  {/* Status Badge */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border-emerald-500/30 border mb-4">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-400">
                      Paid
                    </span>
                  </div>

                  {/* Event Name */}
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                    {ticket.event?.name || "TEDx Event"}
                  </h2>

                  {/* Event Details Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Date
                        </p>
                        <p className="text-sm text-white font-medium">
                          {ticket.event
                            ? formatDate(ticket.event.eventDate)
                            : "-"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <Clock className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Time
                        </p>
                        <p className="text-sm text-white font-medium">
                          {ticket.event
                            ? formatTimeLocal(ticket.event.startTime)
                            : "-"}
                        </p>
                      </div>
                    </div>

                    <div className="col-span-2 flex items-start gap-3">
                      <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <MapPin className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">
                          Venue
                        </p>
                        <p className="text-sm text-white font-medium">
                          {ticket.event?.venue || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Perforated Line */}
              <div className="relative h-8 flex items-center">
                <div className="absolute left-0 w-4 h-8 bg-black rounded-r-full -ml-1" />
                <div className="absolute right-0 w-4 h-8 bg-black rounded-l-full -mr-1" />
                <div className="flex-1 mx-4 border-t-2 border-dashed border-white/20" />
              </div>

              {/* Bottom Section */}
              <div className="p-6 pt-2">
                {/* Attendee Info */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Attendee Information
                    </span>
                  </div>
                  <p className="text-xl font-bold text-white mb-1">
                    {ticket.customerName}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span className="font-mono bg-white/5 px-2 py-1 rounded">
                      #{ticket.orderNumber}
                    </span>
                    <span>
                      {isTicketClass
                        ? `${ticketLines.reduce((s, l) => s + l.quantity, 0)} tickets`
                        : `${ticket.seats.length} tickets`}
                    </span>
                  </div>
                </div>

                {/* Inventory lines (ticket-class) or seats (seat-map) */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Ticket className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      {isTicketClass ? "Tickets" : "Seats"}
                    </span>
                  </div>
                  {isTicketClass ? (
                    <div className="space-y-2">
                      {ticketLines.map((line, index) => (
                        <div
                          key={`${line.name}-${index}`}
                          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.04]"
                        >
                          <div className="min-w-0">
                            <p className="text-base font-bold text-white truncate">
                              {line.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {Number(line.unitPrice).toLocaleString("en-US")}{" "}
                              VND each
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-white tabular-nums">
                              × {line.quantity}
                            </p>
                            <p className="text-xs text-gray-400 tabular-nums">
                              {Number(line.lineTotal).toLocaleString("en-US")}{" "}
                              VND
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {ticket.seats.map((seat, index) => (
                        <div
                          key={index}
                          className={`relative px-4 py-3 rounded-xl border transition-all ${
                            seat.seatType === "VIP"
                              ? "bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-amber-500/30"
                              : "bg-white/5 border-white/10"
                          }`}
                        >
                          {seat.seatType === "VIP" && (
                            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-400" />
                          )}
                          <p className="text-lg font-bold text-white">
                            {seat.seatNumber}
                          </p>
                          <p className="text-xs text-gray-400">
                            {seat.seatType}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Per-ticket QR units (model B) */}
                {ticket.ticketUnits && ticket.ticketUnits.length > 0 ? (
                  <div className="mb-6">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-gray-500" />
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Check-in QR ({ticket.ticketUnits.length})
                        </span>
                      </div>
                      {ticket.checkInProgress && (
                        <span className="text-[11px] text-gray-500 tabular-nums">
                          {ticket.checkInProgress.checkedIn}/
                          {ticket.checkInProgress.total} in
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {ticket.ticketUnits.map((unit) => (
                        <div
                          key={unit.id || unit.index}
                          className={`rounded-xl border p-3 ${
                            unit.checkedIn
                              ? "border-emerald-500/30 bg-emerald-500/5"
                              : "border-white/10 bg-white/[0.03]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-white truncate">
                                {unit.typeName}
                              </p>
                              <p className="text-[11px] text-gray-500 font-mono">
                                {unit.ticketCode || `Ticket #${unit.index}`}
                              </p>
                            </div>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                                unit.checkedIn
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-white/10 text-gray-400"
                              }`}
                            >
                              {unit.checkedIn ? "In" : "Ready"}
                            </span>
                          </div>
                          {unit.qrCodeUrl && (
                            <div className="bg-white rounded-lg p-2 flex items-center justify-center">
                              <img
                                src={unit.qrCodeUrl}
                                alt={unit.ticketCode || "QR"}
                                className="w-36 h-36 object-contain"
                                style={{ imageRendering: "crisp-edges" }}
                              />
                            </div>
                          )}
                          <p className="text-[11px] text-gray-500 mt-2 text-center tabular-nums">
                            {Number(unit.price).toLocaleString("en-US")} VND
                          </p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-600 mt-3 text-center">
                      Each QR is unique — staff scan once per person
                    </p>
                  </div>
                ) : (
                  ticket.qrCodeUrl && (
                    <div className="mb-6 flex flex-col items-center">
                      <div className="flex items-center gap-2 mb-3">
                        <QrCode className="w-4 h-4 text-gray-500" />
                        <span className="text-xs text-gray-500 uppercase tracking-wide">
                          Check-in Code
                        </span>
                      </div>
                      <div className="bg-white rounded-xl p-3 flex items-center justify-center">
                        <img
                          src={ticket.qrCodeUrl}
                          alt="QR Code"
                          className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
                          style={{ imageRendering: "crisp-edges" }}
                        />
                      </div>
                    </div>
                  )
                )}

                {/* Total */}
                <div className="flex items-center justify-between py-4 border-t border-white/10">
                  <span className="text-gray-400">Total Amount</span>
                  <span className="text-2xl font-bold text-white">
                    {formatCurrency(ticket.totalAmount)}
                  </span>
                </div>

                {/* Actions: Download + Copy + Open ticket page */}
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-[#e62b1e] to-red-600 text-white rounded-xl font-bold shadow-xl shadow-[#e62b1e]/25 hover:shadow-[#e62b1e]/40 transition-all disabled:opacity-50 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    {downloading ? (
                      <Loader2 className="w-5 h-5 animate-spin relative" />
                    ) : (
                      <Download className="w-5 h-5 relative" />
                    )}
                    <span className="relative">
                      {downloading ? "Downloading..." : "Download Ticket (PDF)"}
                    </span>
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold border border-white/10 transition-colors"
                    >
                      {copied ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    <a
                      href={ticketUrl}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold border border-white/10 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open ticket
                    </a>
                  </div>
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
            Please wait while we verify your bank transfer. This usually takes a
            few minutes.
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

            {/* Save link while waiting */}
            <button
              type="button"
              onClick={handleCopyLink}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-gray-300 font-medium transition-colors"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? "Ticket link copied" : "Copy ticket link for later"}
            </button>
          </div>

          {/* Status Info */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-left">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-300 mb-1">
                  Keep this page open (optional)
                </p>
                <p className="text-xs text-blue-400/80 leading-relaxed">
                  We update automatically when payment is verified. You can also
                  copy the ticket link above — the token does not expire — and
                  reopen it later from email or bookmarks.
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
