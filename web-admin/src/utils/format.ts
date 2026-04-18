/**
 * Format number as Vietnamese Dong (VND)
 * @param amount - The amount to format
 * @param showSymbol - Whether to show "đ" symbol (default: true)
 * @returns Formatted string like "1.500.000 đ"
 */
export function formatVND(amount: number | string | null | undefined, showSymbol = true): string {
  const num = Number(amount) || 0;
  const formatted = new Intl.NumberFormat("vi-VN").format(num);
  return showSymbol ? `${formatted} đ` : formatted;
}

/**
 * Format number as compact VND (for large numbers)
 * @param amount - The amount to format  
 * @returns Formatted string like "1.5M đ" or "2.5B đ"
 */
export function formatVNDCompact(amount: number | string | null | undefined): string {
  const num = Number(amount) || 0;
  
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B đ`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M đ`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(0)}K đ`;
  }
  return formatVND(num);
}

/**
 * Format date to Vietnamese locale
 * @param date - Date string or Date object
 * @param showTime - Whether to show time (default: false)
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date | null | undefined,
  showTime = false
): string {
  if (!date) return "-";
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return "-";

  const options: Intl.DateTimeFormatOptions = {
    day: "2-digit",
    month: "2-digit", 
    year: "numeric",
  };

  if (showTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }

  return d.toLocaleDateString("vi-VN", options);
}

/**
 * Format datetime with full info
 * @param date - Date string or Date object
 * @returns Formatted datetime string like "18/04/2026 14:30"
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, true);
}

/**
 * Format phone number (Vietnam)
 * @param phone - Phone number string
 * @returns Formatted phone like "0912 345 678"
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Format order number with leading zeros
 * @param orderNumber - Order number string
 * @returns Formatted order number
 */
export function formatOrderNumber(orderNumber: string | null | undefined): string {
  if (!orderNumber) return "-";
  return orderNumber;
}
