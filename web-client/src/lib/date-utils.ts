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

  if (options) {
    return date.toLocaleDateString("vi-VN", { ...options, timeZone: "Asia/Ho_Chi_Minh" });
  }
  return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
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

  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh"
  });
}

/**
 * Generate Google Calendar URL for an event
 */
export function generateGoogleCalendarUrl(event: { name: string, date: string, time?: string, venue: string, location?: string }): string {
  if (!event.date) return "#";
  
  const dateObj = new Date(event.date);
  if (isNaN(dateObj.getTime())) return "#";

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(dateObj);
  
  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;
  const dateStr = `${y}${m}${d}`;

  let startTimeStr = "080000";
  let endTimeStr = "120000";

  if (event.time) {
    const match = event.time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*(?:-|to)\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (match) {
      const [_, h1, m1, ap1, h2, m2, ap2] = match;
      
      let hour1 = parseInt(h1, 10);
      if (ap1?.toUpperCase() === 'PM' && hour1 < 12) hour1 += 12;
      if (ap1?.toUpperCase() === 'AM' && hour1 === 12) hour1 = 0;
      
      let hour2 = parseInt(h2, 10);
      if (ap2?.toUpperCase() === 'PM' && hour2 < 12) hour2 += 12;
      if (ap2?.toUpperCase() === 'AM' && hour2 === 12) hour2 = 0;

      startTimeStr = `${hour1.toString().padStart(2, '0')}${m1}00`;
      endTimeStr = `${hour2.toString().padStart(2, '0')}${m2}00`;
    }
  }

  const dates = `${dateStr}T${startTimeStr}/${dateStr}T${endTimeStr}`;
  const location = `${event.venue}${event.location ? ', ' + event.location : ''}`;
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.name)}&dates=${dates}&ctz=Asia/Ho_Chi_Minh&location=${encodeURIComponent(location)}`;
}

