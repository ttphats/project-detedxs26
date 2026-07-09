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
} from "lucide-react";

// Polling interval in milliseconds
const POLL_INTERVAL = 5000;

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

  // Fetch ticket status from backend
  const fetchTicketStatus = useCallback(async () => {
    if (!orderNumber || !token) return;

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
      const res = await fetch(
        `${apiUrl}/ticket/${orderNumber}?token=${token}`,
      );
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

          {/* Warning - Save/Download */}
          <div className="mb-6 p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl backdrop-blur-sm">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-300 mb-1">
                  Important Notice
                </h3>
                <p className="text-sm text-amber-100/90 leading-relaxed">
                  Please <strong>download your ticket now</strong>. If you leave
                  this page, you will not be able to access this ticket again.
                  The ticket has also been sent to your email.
                </p>
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
                    <span>{ticket.seats.length} tickets</span>
                  </div>
                </div>

                {/* Seats Grid */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Ticket className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Seat
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ticket.seats.map((seat, index) => (
                      <div
                        key={index}
                        className={`relative group px-4 py-3 rounded-xl border transition-all ${
                          seat.seatType === "VIP"
                            ? "bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-amber-500/30"
                            : seat.seatType === "PREMIUM"
                              ? "bg-gradient-to-br from-purple-500/20 to-pink-600/20 border-purple-500/30"
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
                </div>

                {/* QR Code Section */}
                {ticket.qrCodeUrl && (
                  <div className="mb-6 flex flex-col items-center">
                    <div className="flex items-center gap-2 mb-3">
                      <QrCode className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-500 uppercase tracking-wide">
                        Check-in Code
                      </span>
                    </div>
                    <div className="bg-white rounded-lg p-3 flex items-center justify-center">
                      <img
                        src={ticket.qrCodeUrl}
                        alt="QR Code"
                        className="w-72 h-72 object-contain"
                        style={{ imageRendering: "crisp-edges" }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2 text-center">
                      Please present this code to the staff at the event
                    </p>
                  </div>
                )}

                {/* Total Amount */}
                <div className="flex items-center justify-between py-4 border-t border-white/10">
                  <span className="text-gray-400">Total Amount</span>
                  <span className="text-2xl font-bold text-white">
                    {formatCurrency(ticket.totalAmount)}
                  </span>
                </div>

                {/* Download Button */}
                <div className="mt-4">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-bold shadow-xl shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    {downloading ? (
                      <Loader2 className="w-5 h-5 animate-spin relative" />
                    ) : (
                      <Download className="w-5 h-5 relative" />
                    )}
                    <span className="relative">
                      {downloading
                        ? "Downloading..."
                        : "Download Ticket (PDF)"}
                    </span>
                  </button>
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
                <p className="font-semibold text-white">
                  {ticket.event.name}
                </p>
                <p className="text-sm text-gray-500">
                  {formatDate(ticket.event.eventDate)}
                </p>
              </div>
            )}

            {/* Seats */}
            <div className="mb-4 pb-4 border-b border-white/10">
              <p className="text-sm text-gray-400 mb-2">Seats</p>
              <div className="flex flex-wrap gap-2">
                {ticket.seats.map((seat, index) => (
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
                  Do not close this page
                </p>
                <p className="text-xs text-blue-400/80 leading-relaxed">
                  This page will automatically update once your payment is
                  verified. Your e-ticket will appear here.
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
