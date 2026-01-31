import * as XLSX from "xlsx";

// Types for export
interface OrderExport {
  orderNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  eventName: string;
  eventDate: string;
  venue: string;
  seats: string;
  seatTypes: string;
  totalAmount: number;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface SeatExport {
  seatNumber: string;
  row: string;
  col: number;
  section: string;
  seatType: string;
  price: number;
  status: string;
  eventName: string;
}

// Status labels for orders
const orderStatusLabels: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PENDING_CONFIRMATION: "Chờ xác nhận",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
  FAILED: "Thất bại",
};

// Status labels for seats
const seatStatusLabels: Record<string, string> = {
  AVAILABLE: "Còn trống",
  RESERVED: "Đã đặt",
  SOLD: "Đã bán",
  LOCKED: "Đang giữ",
};

// Seat type labels
const seatTypeLabels: Record<string, string> = {
  VIP: "VIP",
  STANDARD: "Tiêu chuẩn",
  ECONOMY: "Phổ thông",
};

// Format date for display
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Format currency
function formatVND(amount: number): string {
  return amount.toLocaleString("vi-VN") + " ₫";
}

// Export orders to Excel
export function exportOrdersToExcel(orders: OrderExport[], filename?: string) {
  const data = orders.map((order) => ({
    "Mã đơn hàng": order.orderNumber,
    "Trạng thái": orderStatusLabels[order.status] || order.status,
    "Tên khách hàng": order.customerName,
    Email: order.customerEmail,
    "Số điện thoại": order.customerPhone || "",
    "Sự kiện": order.eventName,
    "Ngày sự kiện": formatDate(order.eventDate),
    "Địa điểm": order.venue,
    "Ghế": order.seats,
    "Loại ghế": order.seatTypes,
    "Tổng tiền": formatVND(order.totalAmount),
    "Phương thức TT": order.paymentMethod || "",
    "Trạng thái TT": order.paymentStatus || "",
    "Ngày thanh toán": formatDate(order.paidAt),
    "Ngày tạo": formatDate(order.createdAt),
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  ws["!cols"] = [
    { wch: 15 }, // Mã đơn hàng
    { wch: 15 }, // Trạng thái
    { wch: 25 }, // Tên khách hàng
    { wch: 30 }, // Email
    { wch: 15 }, // Số điện thoại
    { wch: 30 }, // Sự kiện
    { wch: 18 }, // Ngày sự kiện
    { wch: 30 }, // Địa điểm
    { wch: 20 }, // Ghế
    { wch: 15 }, // Loại ghế
    { wch: 15 }, // Tổng tiền
    { wch: 15 }, // Phương thức TT
    { wch: 15 }, // Trạng thái TT
    { wch: 18 }, // Ngày thanh toán
    { wch: 18 }, // Ngày tạo
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Đơn hàng");

  const exportFilename =
    filename || `orders_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(wb, exportFilename);
}

// Export seats to Excel
export function exportSeatsToExcel(seats: SeatExport[], filename?: string) {
  const data = seats.map((seat) => ({
    "Số ghế": seat.seatNumber,
    Hàng: seat.row,
    Cột: seat.col,
    Khu: seat.section,
    "Loại ghế": seatTypeLabels[seat.seatType] || seat.seatType,
    Giá: formatVND(seat.price),
    "Trạng thái": seatStatusLabels[seat.status] || seat.status,
    "Sự kiện": seat.eventName,
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  ws["!cols"] = [
    { wch: 10 }, // Số ghế
    { wch: 8 }, // Hàng
    { wch: 8 }, // Cột
    { wch: 15 }, // Khu
    { wch: 15 }, // Loại ghế
    { wch: 15 }, // Giá
    { wch: 12 }, // Trạng thái
    { wch: 30 }, // Sự kiện
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ghế");

  const exportFilename =
    filename || `seats_${new Date().toISOString().split("T")[0]}.xlsx`;
  XLSX.writeFile(wb, exportFilename);
}

