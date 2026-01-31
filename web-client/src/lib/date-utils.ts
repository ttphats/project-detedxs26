/**
 * Date utilities for handling Vietnam timezone
 * Database stores dates in Vietnam time (UTC+7), but JavaScript parses them as UTC
 * This causes a 7-hour offset when displaying dates
 */

/**
 * Format date from database (stored as Vietnam time but parsed as UTC)
 * Subtracts 7 hours to correct the timezone offset
 */
export function formatVNDate(
  dateStr: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";

  // Database stores Vietnam time, but JS parses as UTC and browser adds local offset
  // So we subtract 7 hours to get correct Vietnam time display
  const vnDate = new Date(date.getTime() - 7 * 60 * 60 * 1000);

  if (options) {
    return vnDate.toLocaleDateString("vi-VN", options);
  }
  return vnDate.toLocaleString("vi-VN");
}

/**
 * Format date for display with time
 */
export function formatVNDateTime(dateStr: string | Date | null | undefined): string {
  return formatVNDate(dateStr);
}

/**
 * Format date only (no time)
 */
export function formatVNDateOnly(
  dateStr: string | Date | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  return formatVNDate(dateStr, options || defaultOptions);
}

/**
 * Format time only
 */
export function formatVNTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "-";

  const vnDate = new Date(date.getTime() - 7 * 60 * 60 * 1000);
  return vnDate.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

