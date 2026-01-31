/**
 * TEDx Ticket PDF Document
 *
 * React-PDF component for generating ticket PDFs.
 * Used for both API endpoint PDF generation and email download links.
 *
 * IMPORTANT: This component is server-side only.
 * Do NOT import in client components.
 */

import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";

// Register fonts that support Vietnamese characters
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf",
      fontWeight: 400,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf",
      fontWeight: 500,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf",
      fontWeight: 700,
    },
  ],
});

// TEDx Brand Colors
const COLORS = {
  red: "#e62b1e",
  darkRed: "#b91c14",
  black: "#110808",
  darkGray: "#1a1a1a",
  gray: "#666666",
  lightGray: "#999999",
  white: "#ffffff",
};

// Create styles
const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.black,
    padding: 40,
    fontFamily: "Roboto",
  },
  container: {
    backgroundColor: COLORS.darkGray,
    borderRadius: 12,
    overflow: "hidden",
    border: `1 solid ${COLORS.gray}`,
  },
  // Header Section
  header: {
    backgroundColor: COLORS.red,
    padding: 24,
    alignItems: "center",
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  brandTED: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.white,
  },
  brandX: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.black,
  },
  brandSuffix: {
    fontSize: 14,
    color: COLORS.white,
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: "#22c55e",
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 8,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  // Event Section
  eventSection: {
    padding: 24,
    borderBottom: `1 dashed ${COLORS.gray}`,
  },
  eventName: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: 16,
    textAlign: "center",
  },
  eventDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },
  eventDetailItem: {
    width: "48%",
    marginBottom: 12,
  },
  eventLabel: {
    fontSize: 8,
    color: COLORS.lightGray,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  eventValue: {
    fontSize: 12,
    color: COLORS.white,
    fontWeight: "bold",
  },
  venueItem: {
    width: "100%",
  },
  // Attendee Section
  attendeeSection: {
    padding: 24,
    borderBottom: `1 dashed ${COLORS.gray}`,
  },
  sectionTitle: {
    fontSize: 10,
    color: COLORS.lightGray,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  attendeeName: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.white,
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 12,
    color: COLORS.lightGray,
    fontFamily: "Courier",
  },
  // Seats Section
  seatsSection: {
    padding: 24,
    borderBottom: `1 dashed ${COLORS.gray}`,
  },
  seatsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  seatItem: {
    backgroundColor: "#333333",
    padding: 12,
    borderRadius: 8,
    minWidth: 70,
    alignItems: "center",
    marginRight: 8,
    marginBottom: 8,
  },
  seatVIP: {
    backgroundColor: "#78350f",
    borderColor: "#f59e0b",
    borderWidth: 1,
  },
  seatPremium: {
    backgroundColor: "#581c87",
    borderColor: "#a855f7",
    borderWidth: 1,
  },
  seatNumber: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.white,
  },
  seatType: {
    fontSize: 8,
    color: COLORS.lightGray,
    marginTop: 4,
  },
  // QR Section
  qrSection: {
    padding: 24,
    alignItems: "center",
    backgroundColor: COLORS.white,
  },
  qrLabel: {
    fontSize: 10,
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  qrCode: {
    width: 150,
    height: 150,
    marginBottom: 8,
  },
  qrHint: {
    fontSize: 9,
    color: COLORS.gray,
    textAlign: "center",
  },
  // Footer Section
  footer: {
    padding: 24,
    backgroundColor: COLORS.black,
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 10,
    color: COLORS.lightGray,
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.white,
  },
  footerNote: {
    fontSize: 8,
    color: COLORS.gray,
    marginTop: 16,
    textAlign: "center",
  },
});

// Props interface
export interface TicketDocumentProps {
  orderNumber: string;
  status: string;
  customerName: string;
  totalAmount: number;
  qrCodeUrl: string | null;
  event: {
    name: string;
    venue: string;
    eventDate: string;
    startTime: string;
  } | null;
  seats: {
    seatNumber: string;
    seatType: string;
    price: number;
  }[];
}

// Format currency
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

// Format date
const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

// Format time
const formatTime = (dateString: string): string => {
  return new Date(dateString).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Status config
const getStatusConfig = (status: string) => {
  switch (status) {
    case "PAID":
      return { color: "#22c55e", text: "Đã xác nhận" };
    case "PENDING":
      return { color: "#eab308", text: "Chờ thanh toán" };
    case "PENDING_CONFIRMATION":
      return { color: "#3b82f6", text: "Chờ xác nhận" };
    case "CANCELLED":
      return { color: "#ef4444", text: "Đã hủy" };
    case "EXPIRED":
      return { color: "#6b7280", text: "Hết hạn" };
    default:
      return { color: "#6b7280", text: status };
  }
};

// Main Document Component
export function TicketDocument({
  orderNumber,
  status,
  customerName,
  totalAmount,
  qrCodeUrl,
  event,
  seats,
}: TicketDocumentProps) {
  const statusConfig = getStatusConfig(status);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.container}>
          {/* Header with Brand */}
          <View style={styles.header}>
            <View style={styles.brandContainer}>
              <Text style={styles.brandTED}>TED</Text>
              <Text style={styles.brandX}>x</Text>
            </View>
            <Text style={styles.brandSuffix}>FPTUniversityHCMC</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusConfig.color },
              ]}
            >
              <Text style={styles.statusText}>{statusConfig.text}</Text>
            </View>
          </View>

          {/* Event Info */}
          <View style={styles.eventSection}>
            <Text style={styles.eventName}>
              {event?.name || "TEDx Event 2026"}
            </Text>
            <View style={styles.eventDetails}>
              <View style={styles.eventDetailItem}>
                <Text style={styles.eventLabel}>Ngày</Text>
                <Text style={styles.eventValue}>
                  {event ? formatDate(event.eventDate) : "-"}
                </Text>
              </View>
              <View style={styles.eventDetailItem}>
                <Text style={styles.eventLabel}>Giờ</Text>
                <Text style={styles.eventValue}>
                  {event ? formatTime(event.startTime) : "-"}
                </Text>
              </View>
              <View style={[styles.eventDetailItem, styles.venueItem]}>
                <Text style={styles.eventLabel}>Địa điểm</Text>
                <Text style={styles.eventValue}>{event?.venue || "-"}</Text>
              </View>
            </View>
          </View>

          {/* Attendee Info */}
          <View style={styles.attendeeSection}>
            <Text style={styles.sectionTitle}>Thông tin người tham dự</Text>
            <Text style={styles.attendeeName}>{customerName}</Text>
            <Text style={styles.orderNumber}>#{orderNumber}</Text>
          </View>

          {/* Seats */}
          <View style={styles.seatsSection}>
            <Text style={styles.sectionTitle}>
              Ghế ngồi ({seats.length} vé)
            </Text>
            <View style={styles.seatsGrid}>
              {seats.map((seat, index) => {
                // Determine seat style based on type
                const seatStyle =
                  seat.seatType === "VIP"
                    ? [styles.seatItem, styles.seatVIP]
                    : seat.seatType === "PREMIUM"
                      ? [styles.seatItem, styles.seatPremium]
                      : [styles.seatItem];

                return (
                  <View key={index} style={seatStyle}>
                    <Text style={styles.seatNumber}>{seat.seatNumber}</Text>
                    <Text style={styles.seatType}>{seat.seatType}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* QR Code */}
          {qrCodeUrl && (
            <View style={styles.qrSection}>
              <Text style={styles.qrLabel}>Mã check-in</Text>
              <Image src={qrCodeUrl} style={styles.qrCode} />
              <Text style={styles.qrHint}>Quét mã này tại quầy check-in</Text>
            </View>
          )}

          {/* Footer with Total */}
          <View style={styles.footer}>
            <Text style={styles.totalLabel}>Tổng tiền</Text>
            <Text style={styles.totalAmount}>
              {formatCurrency(totalAmount)}
            </Text>
            <Text style={styles.footerNote}>
              © 2026 TEDxFPTUniversityHCMC. Vui lòng mang vé này đến sự kiện.
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
