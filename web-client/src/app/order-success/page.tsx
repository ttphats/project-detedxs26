"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  Download,
  Home,
  Ticket,
  Calendar,
  MapPin,
  Sparkles,
} from "lucide-react";
import { events } from "@/lib/mock-data";
import { formatVNDate } from "@/lib/date-utils";

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderCode = searchParams.get("code") || "ORD-UNKNOWN";
  const seatIds = searchParams.get("seats")?.split(",") || [];
  const event = events[0]; // Default to first event for demo

  return (
    <div className="min-h-screen bg-black pt-24 pb-12">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-green-600/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDuration: "5s" }}
        />
      </div>

      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel rounded-3xl p-8 text-center animate-fade-in relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-green-500/10 rounded-full blur-2xl" />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-red-500/10 rounded-full blur-2xl" />

          {/* Success Icon */}
          <div className="mb-8 relative">
            <div className="relative w-24 h-24 mx-auto">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-green-500/30 rounded-full blur-xl animate-pulse" />
              {/* Icon container */}
              <div className="relative w-24 h-24 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/40">
                <CheckCircle2 className="w-12 h-12 text-white" />
              </div>
              {/* Sparkle decorations */}
              <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-pulse" />
              <Sparkles
                className="absolute -bottom-1 -left-3 w-5 h-5 text-yellow-400 animate-pulse"
                style={{ animationDelay: "0.5s" }}
              />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white mt-6 mb-3">
              Đặt vé thành công!
            </h1>
            <p className="text-gray-400">
              Cảm ơn bạn đã đặt vé. Thông tin vé đã được gửi đến email của bạn.
            </p>
          </div>

          {/* Order Info */}
          <div className="bg-gradient-to-r from-red-600/20 to-red-600/10 rounded-2xl p-6 mb-6 border border-red-500/30">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Ticket className="w-5 h-5 text-red-500" />
              <span className="text-sm font-medium text-gray-400">
                Mã đơn hàng
              </span>
            </div>
            <p className="text-2xl md:text-3xl font-black text-red-500 font-mono tracking-wider">
              {orderCode}
            </p>
          </div>

          {/* Event Details */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 text-left">
            <h3 className="font-bold text-white text-lg mb-4">{event.name}</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-8 h-8 bg-red-600/20 rounded-lg flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-red-500" />
                </div>
                <span>
                  {formatVNDate(event.date, {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-3 text-gray-300">
                <div className="w-8 h-8 bg-red-600/20 rounded-lg flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-red-500" />
                </div>
                <span>
                  {event.venue}, {event.location}
                </span>
              </div>
            </div>

            {/* Seats */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-sm text-gray-400 mb-3">Ghế đã đặt:</p>
              <div className="flex flex-wrap gap-2">
                {seatIds.map((seatId) => (
                  <span
                    key={seatId}
                    className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-full text-sm font-medium border border-red-500/30"
                  >
                    {seatId}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button className="relative w-full py-4 px-6 rounded-xl font-bold text-white flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-500 shadow-xl shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 overflow-hidden group">
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <Download className="relative w-5 h-5" />
              <span className="relative">Tải vé điện tử</span>
            </button>
            <Link href="/" className="block">
              <button className="w-full py-4 px-6 rounded-xl font-bold text-white flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 transition-all duration-300">
                <Home className="w-5 h-5" />
                <span>Về trang chủ</span>
              </button>
            </Link>
          </div>

          {/* Note */}
          <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <p className="text-sm text-yellow-400">
              <strong>Lưu ý:</strong> Vui lòng mang theo vé điện tử hoặc mã QR
              khi đến sự kiện. Vé đã được gửi đến email của bạn.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400">Đang tải...</p>
          </div>
        </div>
      }
    >
      <OrderSuccessContent />
    </Suspense>
  );
}
