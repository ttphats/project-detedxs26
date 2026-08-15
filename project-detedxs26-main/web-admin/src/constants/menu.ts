/**
 * Menu labels for admin sidebar
 * Centralized management for consistency
 */
export const MENU_LABELS = {
  DASHBOARD: 'Dashboard',
  EVENTS: 'Events',
  TICKET_TYPES: 'Ticket Types',
  PROMOTIONS: 'Promotions',
  SPEAKERS: 'Speakers',
  TIMELINE: 'Timeline',
  ORDERS: 'Orders',
  CUSTOMERS: 'Customers',
  EMAIL_TEMPLATES: 'Email Templates',
  AUDIT_LOGS: 'Audit Logs',
  USERS: 'Users',
  SETTINGS: 'Settings',
  LOGOUT: 'Logout',
} as const

export type MenuLabel = typeof MENU_LABELS[keyof typeof MENU_LABELS]
