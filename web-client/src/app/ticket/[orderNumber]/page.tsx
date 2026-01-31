"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Download,
  Share2,
  Ticket,
  Sparkles,
  QrCode,
  Users,
  Shield,
} from "lucide-react";

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

const STATUS_CONFIG = {
  PENDING: {
    color: "yellow",
    bgClass: "bg-yellow-500/20",
    textClass: "text-yellow-400",
    borderClass: "border-yellow-500/30",
    icon: AlertTriangle,
    text: "Chờ thanh toán",
    description: "Vé đang chờ xác nhận thanh toán từ hệ thống",
  },
  PENDING_CONFIRMATION: {
    color: "blue",
    bgClass: "bg-blue-500/20",
    textClass: "text-blue-400",
    borderClass: "border-blue-500/30",
    icon: Clock,
    text: "Chờ xác nhận",
    description:
      "Đã nhận thông tin thanh toán. Đang chờ admin xác nhận và gửi vé điện tử.",
  },
  PAID: {
    color: "green",
    bgClass: "bg-emerald-500/20",
    textClass: "text-emerald-400",
    borderClass: "border-emerald-500/30",
    icon: CheckCircle,
    text: "Đã xác nhận",
    description: "Vé đã được xác nhận. Vui lòng mang mã QR đến sự kiện",
  },
  CANCELLED: {
    color: "red",
    bgClass: "bg-red-500/20",
    textClass: "text-red-400",
    borderClass: "border-red-500/30",
    icon: XCircle,
    text: "Đã hủy",
    description: "Vé đã bị hủy và không còn hiệu lực",
  },
  EXPIRED: {
    color: "gray",
    bgClass: "bg-gray-500/20",
    textClass: "text-gray-400",
    borderClass: "border-gray-500/30",
    icon: Clock,
    text: "Hết hạn",
    description: "Vé đã hết hạn thanh toán",
  },
};

export default function TicketPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = use(params);
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Thiếu mã truy cập vé");
      setLoading(false);
      return;
    }

    const fetchTicket = async () => {
      try {
        const res = await fetch(`/api/ticket/${orderNumber}?token=${token}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Không thể tải thông tin vé");
        }

        setTicket(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [orderNumber, token]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  // Copy ticket URL to clipboard
  const handleCopyLink = async () => {
    const ticketUrl = `${window.location.origin}/ticket/${orderNumber}?token=${token}`;
    try {
      await navigator.clipboard.writeText(ticketUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Download ticket as PDF via API
  const handleDownload = async () => {
    if (!token || !ticket) return;

    setDownloading(true);
    try {
      // Open PDF in new tab for download
      const pdfUrl = `/api/ticket/${ticket.orderNumber}/pdf?token=${token}`;

      // Use fetch to download the PDF
      const response = await fetch(pdfUrl);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Không thể tải PDF");
      }

      // Get the blob and create download link
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ticket-${ticket.orderNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download:", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Không thể tải vé. Vui lòng thử lại.",
      );
    } finally {
      setDownloading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Đang tải thông tin vé...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="glass-dark rounded-3xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Shield className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Không thể truy cập vé
          </h1>
          <p className="text-gray-400 mb-6">
            {error || "Vé không tồn tại hoặc đã hết hạn"}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
          >
            Về trang chủ
          </a>
        </div>
      </div>
    );
  }

  const statusConfig =
    STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG] ||
    STATUS_CONFIG.PENDING;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-black">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-red-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-red-900/5 to-transparent" />
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm rounded-full border border-white/10 mb-4">
            <Ticket className="w-4 h-4 text-red-500" />
            <span className="text-sm text-gray-400">Vé điện tử</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2">
            <span className="text-white">TED</span>
            <span className="text-red-500">x</span>
            <span className="text-white font-light">FPTUniversityHCMC</span>
          </h1>
        </div>

        {/* Important Notice - Save URL */}
        <div className="mb-6 p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-amber-400 font-bold mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Lưu ý quan trọng
              </h3>
              <p className="text-sm text-amber-100/90 leading-relaxed">
                Vui lòng <strong>lưu đường link này</strong> (bookmark hoặc copy
                URL) để xem trạng thái vé sau này. Link chứa mã xác thực duy
                nhất của bạn và không thể khôi phục nếu bị mất.
              </p>
            </div>
          </div>
        </div>

        {/* Main Ticket Card */}
        <div className="relative">
          {/* Ticket Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-red-600/30 via-red-500/20 to-red-600/30 rounded-3xl blur-xl opacity-75" />

          {/* Ticket Container */}
          <div
            id="ticket-card"
            className="relative bg-gradient-to-b from-zinc-900 to-black rounded-3xl overflow-hidden border border-white/10"
          >
            {/* Top Section - Event Info */}
            <div className="relative p-6 pb-8">
              {/* Event Banner Background */}
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
              <div className="absolute inset-0 bg-gradient-to-b from-red-900/50 via-black/80 to-black" />

              <div className="relative">
                {/* Status Badge */}
                <div
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusConfig.bgClass} ${statusConfig.borderClass} border mb-4`}
                >
                  <StatusIcon className={`w-4 h-4 ${statusConfig.textClass}`} />
                  <span
                    className={`text-sm font-medium ${statusConfig.textClass}`}
                  >
                    {statusConfig.text}
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
                        Ngày
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
                        Giờ
                      </p>
                      <p className="text-sm text-white font-medium">
                        {ticket.event
                          ? formatTime(ticket.event.startTime)
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
                        Địa điểm
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

            {/* Bottom Section - Ticket Info & QR */}
            <div className="p-6 pt-2">
              {/* Attendee Info */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span className="text-xs text-gray-500 uppercase tracking-wide">
                    Thông tin người tham dự
                  </span>
                </div>
                <p className="text-xl font-bold text-white mb-1">
                  {ticket.customerName}
                </p>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="font-mono bg-white/5 px-2 py-1 rounded">
                    #{ticket.orderNumber}
                  </span>
                  <span>{ticket.seats.length} vé</span>
                </div>
              </div>

              {/* Seats Grid */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Ticket className="w-4 h-4 text-gray-500" />
                  <span className="text-xs text-gray-500 uppercase tracking-wide">
                    Ghế ngồi
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
                      <p className="text-xs text-gray-400">{seat.seatType}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* QR Code Section */}
              {ticket.canDownload && ticket.qrCodeUrl && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-3">
                    <QrCode className="w-4 h-4 text-gray-500" />
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      Mã check-in
                    </span>
                  </div>
                  <div className="bg-white rounded-2xl p-4 inline-block">
                    <img
                      src={ticket.qrCodeUrl}
                      alt="QR Code"
                      className="w-40 h-40"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Quét mã này tại quầy check-in
                  </p>
                </div>
              )}

              {/* Check-in Status */}
              {ticket.checkedIn && (
                <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-emerald-400 font-semibold">
                      Đã check-in thành công!
                    </p>
                    <p className="text-sm text-gray-400">
                      {ticket.checkedInAt &&
                        new Date(ticket.checkedInAt).toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>
              )}

              {/* Total Amount */}
              <div className="flex items-center justify-between py-4 border-t border-white/10">
                <span className="text-gray-400">Tổng tiền</span>
                <span className="text-2xl font-bold text-white">
                  {formatCurrency(ticket.totalAmount)}
                </span>
              </div>

              {/* Action Buttons - Show for PENDING_CONFIRMATION and PAID */}
              {(ticket.status === "PENDING_CONFIRMATION" ||
                ticket.canDownload) && (
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    {downloading ? "Đang tải..." : "Tải vé"}
                  </button>
                  <button
                    onClick={handleCopyLink}
                    className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-colors relative"
                  >
                    {copied ? (
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Share2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              )}

              {/* Status Description */}
              <div
                className={`mt-4 p-4 rounded-xl ${statusConfig.bgClass} ${statusConfig.borderClass} border`}
              >
                <p className={`text-sm ${statusConfig.textClass}`}>
                  {statusConfig.description}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Note */}
        <div className="text-center mt-8 text-xs text-gray-600">
          <p>Vui lòng lưu lại đường link này để truy cập vé của bạn</p>
          <p className="mt-1">© 2026 TEDxFPTUniversityHCMC</p>
        </div>
      </div>
    </div>
  );
}
