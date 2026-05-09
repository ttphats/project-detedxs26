"use client";

import { useRouter } from "next/navigation";
import { X, Clock, Ticket, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface PendingOrderData {
  orderNumber: string;
  totalAmount: number;
  seatCount: number;
  timeRemaining: number;
  expiresAt: string;
  seats: {
    seatNumber: string;
    seatType: string;
    price: number;
  }[];
  accessToken: string;
}

interface PendingOrderModalProps {
  order: PendingOrderData;
  eventId: string;
  sessionId?: string; // Optional since not used
  onClose: () => void;
  onContinue: () => void;
}

export default function PendingOrderModal({
  order,
  eventId,
  sessionId,
  onClose,
  onContinue,
}: PendingOrderModalProps) {
  const router = useRouter();
  const [timeLeft, setTimeLeft] = useState(order.timeRemaining);
  const [isCanceling, setIsCanceling] = useState(false);

  // Countdown timer
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const handleContinueCheckout = () => {
    // Navigate to checkout page with order info
    router.push(
      `/checkout?event=${eventId}&order=${order.orderNumber}&token=${order.accessToken}`,
    );
  };

  const handleSelectOtherSeats = async () => {
    setIsCanceling(true);
    try {
      // Call API to cancel the pending order
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
      const response = await fetch(
        `${apiUrl}/orders/${order.orderNumber}/cancel?token=${order.accessToken}`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        console.error("Failed to cancel order");
      }

      // Wait a bit for UI feedback, then close modal
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Close modal and let user select new seats
      onContinue();
    } catch (error) {
      console.error("Error canceling order:", error);
      // Still allow user to continue even if cancel fails
      onContinue();
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-[90vw] sm:max-w-sm md:max-w-md max-h-[90vh] bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl sm:rounded-2xl shadow-2xl border border-gray-700/50 overflow-y-auto animate-in zoom-in-95 duration-300">
        {/* Header with glow effect */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-red-600/20 to-orange-600/20 border-b border-red-500/30 p-3 sm:p-5">
          <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 to-orange-600/10 blur-xl" />
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-red-600/20 rounded-lg">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Đơn Hàng Chưa Hoàn Tất
                </h3>
                <p className="text-[10px] sm:text-xs text-gray-300 mt-0.5">
                  Bạn có đơn hàng đang chờ thanh toán
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-5 space-y-2.5 sm:space-y-3">
          {/* Countdown Timer */}
          <div className="flex items-center justify-between p-3 sm:p-3.5 bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-lg sm:rounded-xl">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
              <span className="text-xs sm:text-sm text-gray-300">
                Thời gian còn lại:
              </span>
            </div>
            <span
              className={`text-base sm:text-lg font-bold ${
                timeLeft < 300 ? "text-red-400 animate-pulse" : "text-white"
              }`}
            >
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Order Info */}
          <div className="space-y-2 sm:space-y-2.5">
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-gray-400">Mã đơn hàng:</span>
              <span className="font-mono font-semibold text-white">
                {order.orderNumber}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs sm:text-sm">
              <span className="text-gray-400">Số ghế:</span>
              <span className="font-semibold text-white flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                {order.seatCount} ghế
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs sm:text-sm">
                Tổng tiền:
              </span>
              <span className="text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
                {formatCurrency(order.totalAmount)}
              </span>
            </div>
          </div>

          {/* Seats List (collapsed) */}
          <div className="p-2.5 sm:p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
            <div className="text-[10px] sm:text-xs text-gray-400 mb-1.5 sm:mb-2">
              Ghế đã chọn:
            </div>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {order.seats.map((seat) => (
                <span
                  key={seat.seatNumber}
                  className="px-2 py-0.5 sm:py-1 bg-gray-700/50 rounded text-[10px] sm:text-xs text-gray-300 font-mono"
                >
                  {seat.seatNumber}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-3 sm:p-5 pt-0 space-y-2">
          <button
            onClick={handleContinueCheckout}
            disabled={isCanceling}
            className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white text-xs sm:text-sm font-bold rounded-lg sm:rounded-xl shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            Tiếp Tục Thanh Toán
          </button>
          <button
            onClick={handleSelectOtherSeats}
            disabled={isCanceling}
            className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {isCanceling ? (
              <div className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Đang hủy...</span>
              </div>
            ) : (
              "Chọn Ghế Khác"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
