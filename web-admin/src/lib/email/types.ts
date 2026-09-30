// Email Template Types and Constants

export const EMAIL_PURPOSE = {
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  TICKET_CONFIRMED: 'TICKET_CONFIRMED',
  TICKET_CANCELLED: 'TICKET_CANCELLED',
  EVENT_REMINDER: 'EVENT_REMINDER',
  CHECKIN_CONFIRMATION: 'CHECKIN_CONFIRMATION',
  EVENT_THANK_YOU: 'EVENT_THANK_YOU',
  ADMIN_NOTIFICATION: 'ADMIN_NOTIFICATION',
} as const;

export type EmailPurpose = typeof EMAIL_PURPOSE[keyof typeof EMAIL_PURPOSE];

// Purpose metadata with title, description, recipient type
export interface PurposeInfo {
  key: EmailPurpose;
  title: string;
  description: string;
  recipient: 'customer' | 'admin' | 'both';
  icon: string;
  color: string;
}

export const EMAIL_PURPOSE_INFO: Record<EmailPurpose, PurposeInfo> = {
  PAYMENT_PENDING: {
    key: 'PAYMENT_PENDING',
    title: 'Chờ thanh toán',
    description: 'Gửi cho khách hàng ngay sau khi đặt vé, hướng dẫn chuyển khoản và cung cấp thông tin thanh toán.',
    recipient: 'customer',
    icon: '⏳',
    color: 'bg-yellow-100 text-yellow-800',
  },
  PAYMENT_RECEIVED: {
    key: 'PAYMENT_RECEIVED',
    title: 'Đã nhận thông tin thanh toán',
    description: 'Thông báo cho admin rằng khách hàng đã gửi bằng chứng thanh toán và cần được xác nhận thủ công.',
    recipient: 'admin',
    icon: '📥',
    color: 'bg-blue-100 text-blue-800',
  },
  PAYMENT_CONFIRMED: {
    key: 'PAYMENT_CONFIRMED',
    title: 'Thanh toán thành công',
    description: 'Gửi cho khách hàng khi admin xác nhận đã nhận tiền, vé bắt đầu có hiệu lực.',
    recipient: 'customer',
    icon: '✅',
    color: 'bg-green-100 text-green-800',
  },
  PAYMENT_REJECTED: {
    key: 'PAYMENT_REJECTED',
    title: 'Thanh toán bị từ chối',
    description: 'Gửi cho khách hàng khi thanh toán không hợp lệ, yêu cầu thực hiện lại hoặc liên hệ hỗ trợ.',
    recipient: 'customer',
    icon: '❌',
    color: 'bg-red-100 text-red-800',
  },
  TICKET_CONFIRMED: {
    key: 'TICKET_CONFIRMED',
    title: 'Vé hợp lệ',
    description: 'Gửi khi vé đã được kích hoạt, kèm thông tin ghế và QR check-in.',
    recipient: 'customer',
    icon: '🎫',
    color: 'bg-indigo-100 text-indigo-800',
  },
  TICKET_CANCELLED: {
    key: 'TICKET_CANCELLED',
    title: 'Vé bị hủy',
    description: 'Thông báo vé không còn hiệu lực do quá hạn thanh toán hoặc admin huỷ.',
    recipient: 'customer',
    icon: '🚫',
    color: 'bg-gray-100 text-gray-800',
  },
  EVENT_REMINDER: {
    key: 'EVENT_REMINDER',
    title: 'Nhắc lịch sự kiện',
    description: 'Gửi trước ngày diễn ra sự kiện để nhắc khách tham dự, kèm thông tin địa điểm, thời gian.',
    recipient: 'customer',
    icon: '🔔',
    color: 'bg-purple-100 text-purple-800',
  },
  CHECKIN_CONFIRMATION: {
    key: 'CHECKIN_CONFIRMATION',
    title: 'Check-in thành công',
    description: 'Gửi sau khi khách đã check-in tại sự kiện, dùng làm xác nhận tham dự.',
    recipient: 'customer',
    icon: '✓',
    color: 'bg-teal-100 text-teal-800',
  },
  EVENT_THANK_YOU: {
    key: 'EVENT_THANK_YOU',
    title: 'Cảm ơn sau sự kiện',
    description: 'Gửi cho người giữ vé / người tham dự sau khi sự kiện kết thúc, kèm link khảo sát cảm nhận.',
    recipient: 'customer',
    icon: '💚',
    color: 'bg-emerald-100 text-emerald-800',
  },
  ADMIN_NOTIFICATION: {
    key: 'ADMIN_NOTIFICATION',
    title: 'Thông báo nội bộ cho admin',
    description: 'Gửi cho admin khi có sự kiện quan trọng (đơn mới, thanh toán mới, lỗi hệ thống).',
    recipient: 'admin',
    icon: '🔔',
    color: 'bg-orange-100 text-orange-800',
  },
};

// Simple labels for backward compatibility
export const EMAIL_PURPOSE_LABELS: Record<EmailPurpose, string> = Object.fromEntries(
  Object.entries(EMAIL_PURPOSE_INFO).map(([key, info]) => [key, info.title])
) as Record<EmailPurpose, string>;

// Required variables for each purpose
export const REQUIRED_VARIABLES: Record<EmailPurpose, string[]> = {
  PAYMENT_PENDING: ['customerName', 'orderNumber', 'totalAmount', 'paymentDeadline', 'bankName', 'accountNumber', 'accountName', 'transferContent'],
  PAYMENT_RECEIVED: ['orderNumber', 'customerName', 'customerEmail', 'totalAmount', 'submittedAt'],
  PAYMENT_CONFIRMED: ['customerName', 'orderNumber', 'totalAmount', 'eventName'],
  PAYMENT_REJECTED: ['customerName', 'orderNumber', 'reason'],
  TICKET_CONFIRMED: ['customerName', 'eventName', 'eventDate', 'eventTime', 'eventVenue', 'orderNumber', 'ticketUrl', 'qrCodeUrl'],
  TICKET_CANCELLED: ['customerName', 'orderNumber', 'reason'],
  EVENT_REMINDER: ['customerName', 'eventName', 'eventDate', 'eventTime', 'eventVenue', 'ticketUrl'],
  CHECKIN_CONFIRMATION: ['customerName', 'eventName', 'checkinTime', 'seatNumber'],
  EVENT_THANK_YOU: ['customerName'],
  ADMIN_NOTIFICATION: ['subject', 'message'],
};

// Mock data for preview
export const MOCK_DATA: Record<EmailPurpose, Record<string, unknown>> = {
  PAYMENT_PENDING: {
    customerName: 'Nguyễn Văn A',
    orderNumber: 'ORD-2026-DEMO',
    totalAmount: 500000,
    paymentDeadline: '30/01/2026 23:59',
    eventName: 'TEDx Ideas Worth Spreading 2026',
    bankName: 'Vietcombank',
    accountNumber: '1234567890',
    accountName: 'TEDxFPTUniversityHCMC',
    transferContent: 'ORD-2026-DEMO',
  },
  PAYMENT_RECEIVED: {
    orderNumber: 'ORD-2026-DEMO',
    customerName: 'Nguyễn Văn A',
    customerEmail: 'customer@example.com',
    totalAmount: 500000,
    submittedAt: '30/01/2026 10:30',
  },
  PAYMENT_CONFIRMED: {
    customerName: 'Nguyễn Văn A',
    orderNumber: 'ORD-2026-DEMO',
    totalAmount: 500000,
    eventName: 'TEDx Ideas Worth Spreading 2026',
    eventDate: '15/03/2026',
    eventTime: '18:00',
    eventVenue: 'Nhà hát Thành phố',
  },
  PAYMENT_REJECTED: {
    customerName: 'Nguyễn Văn A',
    orderNumber: 'ORD-2026-DEMO',
    reason: 'Không tìm thấy giao dịch chuyển khoản phù hợp',
  },
  TICKET_CONFIRMED: {
    customerName: 'Nguyễn Văn A',
    eventName: 'TEDx Ideas Worth Spreading 2026',
    eventDate: '15/03/2026',
    eventTime: '18:00',
    eventVenue: 'Nhà hát Thành phố',
    eventAddress: '7 Lam Sơn, Quận 1, TP.HCM',
    orderNumber: 'ORD-2026-DEMO',
    seats: [
      { seatNumber: 'A1', seatType: 'VIP', price: 500000 },
      { seatNumber: 'A2', seatType: 'VIP', price: 500000 },
      { seatNumber: 'B5', seatType: 'Standard', price: 300000 },
    ],
    totalAmount: 1300000,
    qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=DEMO-TICKET',
    ticketUrl: 'http://localhost:3000/ticket/ORD-2026-DEMO?token=demo-token-12345',
    logoUrl: 'https://tedxfptuhcmc.com/logo.png',
  },
  TICKET_CANCELLED: {
    customerName: 'Nguyễn Văn A',
    orderNumber: 'ORD-2026-DEMO',
    reason: 'Khách hàng yêu cầu hủy vé',
    refundAmount: 500000,
  },
  EVENT_REMINDER: {
    customerName: 'Nguyễn Văn A',
    eventName: 'TEDx Ideas Worth Spreading 2026',
    eventDate: '15/03/2026',
    eventTime: '18:00',
    eventVenue: 'Nhà hát Thành phố',
    eventAddress: '7 Lam Sơn, Quận 1, TP.HCM',
    orderNumber: 'ORD-2026-DEMO',
    ticketUrl: 'http://localhost:3000/ticket/ORD-2026-DEMO?token=demo-token-12345',
  },
  CHECKIN_CONFIRMATION: {
    customerName: 'Nguyễn Văn A',
    eventName: 'TEDx Ideas Worth Spreading 2026',
    checkinTime: '18:30',
    seatNumber: 'A1',
  },
  EVENT_THANK_YOU: {
    customerName: 'Nguyễn Văn A',
  },
  ADMIN_NOTIFICATION: {
    subject: 'Thông báo hệ thống',
    message: 'Đây là email thông báo từ hệ thống quản trị.',
  },
};

export interface EmailTemplateData {
  id: string;
  purpose: EmailPurpose;
  name: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  variables: string[];
  isActive: boolean;
  version: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendEmailParams {
  purpose: EmailPurpose;
  to: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  // NO SPAM fields
  businessEvent?: string; // PAYMENT_CONFIRMED, ORDER_CANCELLED, etc.
  orderId?: string; // For anti-spam check
  triggeredBy?: string; // Admin user ID who triggered send
  allowDuplicate?: boolean; // For resend - bypasses anti-spam check
}

// Business events that trigger email
export const BUSINESS_EVENTS = {
  PAYMENT_CONFIRMED: 'PAYMENT_CONFIRMED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  ORDER_EXPIRED: 'ORDER_EXPIRED',
  PAYMENT_REMINDER_SENT: 'PAYMENT_REMINDER_SENT',
  EMAIL_RESENT: 'EMAIL_RESENT',
  CHECKIN_SUCCESS: 'CHECKIN_SUCCESS',
} as const;

export type BusinessEvent = typeof BUSINESS_EVENTS[keyof typeof BUSINESS_EVENTS];

