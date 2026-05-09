/**
 * Menu labels for admin sidebar
 * Centralized management for consistency
 */
export const MENU_LABELS = {
  DASHBOARD: 'Dashboard',
  EVENTS: 'Sự kiện',
  TICKET_TYPES: 'Loại vé',
  SPEAKERS: 'Diễn giả',
  TIMELINE: 'Thời gian biểu',
  SEATS_LAYOUT: 'Sơ đồ ghế',
  SEAT_LOCKS: 'Khóa ghế',
  ORDERS: 'Đơn hàng',
  CUSTOMERS: 'Khách hàng',
  EMAIL_TEMPLATES: 'Mẫu Email',
  AUDIT_LOGS: 'Nhật ký',
  USERS: 'Người dùng',
  SETTINGS: 'Cài đặt',
  LOGOUT: 'Đăng xuất',
} as const

export type MenuLabel = typeof MENU_LABELS[keyof typeof MENU_LABELS]
