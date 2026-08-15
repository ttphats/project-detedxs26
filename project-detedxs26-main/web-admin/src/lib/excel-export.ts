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
  tickets: string;
  attendees: string;
  totalAmount: number;
  paymentMethod: string | null;
  paymentStatus: string | null;
  paidAt: string | null;
  createdAt: string;
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
    "Loại vé": order.tickets,
    "Người tham dự": order.attendees,
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
    { wch: 24 }, // Loại vé
    { wch: 30 }, // Người tham dự
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

