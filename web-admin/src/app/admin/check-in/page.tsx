"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { message, Card, Button, Spin, Table, Tag, Empty, Select } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ScanOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CameraOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { AdminLayout } from "@/components/admin";

/** One admitted ticket, as returned by GET /admin/check-in/list/:eventId. */
interface CheckInRecord {
  id: string;
  ticketCode: string | null;
  checkedInAt: string;
  typeName: string;
  seatNumber: string | null;
  orderNumber: string;
  customerName: string;
  attendeeName: string | null;
  attendeeEmail: string | null;
  checkedInBy: string | null;
}

interface AdminEvent {
  id: string;
  name: string;
  status: string;
}

/** Dates are stored as Vietnam local time; render them as given. */
function formatScanTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

interface CheckInResult {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  seatNumbers?: string[];
  ticketCode?: string;
  typeName?: string;
  ticketsCheckedIn?: string[];
  progress?: {
    total: number;
    checkedIn: number;
    pending: number;
    ticketLines?: Array<{ name: string; quantity: number }>;
  };
  event: {
    name: string;
  };
}

export default function CheckInPage() {
  const [scanning, setScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);
  const [stats, setStats] = useState({ total: 0, checkedIn: 0, pending: 0 });
  const [processing, setProcessing] = useState(false);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const lastScanTime = useRef<number>(0);
  const lastScannedQR = useRef<string>(""); // Track last scanned QR to prevent duplicates
  const scannerRef = useRef<Html5Qrcode | null>(null); // Track scanner for cleanup

  // Helper function to force stop all camera tracks
  const forceStopAllCameraTracks = () => {
    try {
      const videoElements = document.querySelectorAll("video");
      let stopped = 0;
      videoElements.forEach((videoElement) => {
        if (videoElement.srcObject) {
          const stream = videoElement.srcObject as MediaStream;
          stream.getTracks().forEach((track) => {
            track.stop();
            stopped++;
            console.log("[FORCE STOP] Stopped track:", track.label);
          });
          videoElement.srcObject = null;
        }
      });
      if (stopped > 0) {
        console.log(`[FORCE STOP] Total tracks stopped: ${stopped}`);
      }
    } catch (err) {
      console.error("Force stop error:", err);
    }
  };

  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  /**
   * Pick the event to scan for. The page had no event at all, which is why the
   * counters sat at zero: the stats endpoint is per-event and was never called.
   * Default to the published event, since that is the one being run.
   */
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch("/api/admin/events", { headers: authHeaders() });
        const json = await res.json();
        const list: AdminEvent[] = json?.data?.events || json?.data || [];
        if (!Array.isArray(list) || list.length === 0) return;
        setEvents(list);
        setEventId(
          (prev) =>
            prev || list.find((e) => e.status === "PUBLISHED")?.id || list[0].id,
        );
      } catch (err) {
        console.error("[CHECK-IN] failed to load events:", err);
      }
    };
    void loadEvents();
  }, []);

  /** Counters and the admitted-ticket log, both read from the server. */
  const refreshCheckInData = useCallback(async () => {
    if (!eventId) return;
    setLoadingLog(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        fetch(`/api/admin/check-in/stats/${eventId}`, { headers: authHeaders() }),
        fetch(`/api/admin/check-in/list/${eventId}`, { headers: authHeaders() }),
      ]);
      const statsJson = await statsRes.json();
      const listJson = await listRes.json();

      if (statsJson?.success && statsJson.data) {
        // Count people, not orders: the door admits tickets one QR at a time,
        // so an order of three that is half scanned is not "checked in".
        const pax = statsJson.data.pax;
        setStats(
          pax
            ? {
                total: pax.total ?? 0,
                checkedIn: pax.checkedIn ?? 0,
                pending: pax.pending ?? 0,
              }
            : {
                total: statsJson.data.total ?? 0,
                checkedIn: statsJson.data.checkedIn ?? 0,
                pending: statsJson.data.pending ?? 0,
              },
        );
      }
      if (listJson?.success && Array.isArray(listJson.data)) {
        setRecords(listJson.data);
      }
    } catch (err) {
      console.error("[CHECK-IN] failed to load stats/log:", err);
      message.error("Không tải được số liệu check-in");
    } finally {
      setLoadingLog(false);
    }
  }, [eventId]);

  useEffect(() => {
    void refreshCheckInData();
  }, [refreshCheckInData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const currentScanner = scannerRef.current;
      if (currentScanner) {
        try {
          const state = currentScanner.getState();
          // State codes: 1 = NOT_STARTED, 2 = SCANNING, 3 = PAUSED
          if (state === 2 || state === 3) {
            console.log("[CLEANUP] Stopping camera on unmount");
            currentScanner.stop().catch((err) => {
              console.error("Cleanup stop error:", err);
            });
          }
          // Clear the scanner
          currentScanner.clear();
        } catch (err) {
          console.error("Cleanup error:", err);
          // Force clear even if error
          try {
            currentScanner.clear();
          } catch (clearErr) {
            console.error("Force clear error:", clearErr);
          }
        }
      }
      // Force stop all camera tracks
      forceStopAllCameraTracks();
    };
  }, []);

  // Stop camera when tab is hidden or page is being unloaded
  useEffect(() => {
    const stopCameraAndCleanup = () => {
      console.log("[CLEANUP] stopCameraAndCleanup called");

      const currentScanner = scannerRef.current;
      if (currentScanner) {
        try {
          const state = currentScanner.getState();
          if (state === 2 || state === 3) {
            // Stop scanner
            currentScanner.stop().catch(() => {});
          }
          // Clear scanner UI
          currentScanner.clear();
          scannerRef.current = null;
          console.log("[CLEANUP] Scanner stopped and cleared");
        } catch (err) {
          console.error("Cleanup error:", err);
          try {
            currentScanner.clear();
          } catch (clearErr) {}
        }
      }

      // FORCE STOP ALL CAMERA TRACKS
      forceStopAllCameraTracks();
    };

    const handleVisibilityChange = async () => {
      if (document.hidden) {
        // Tab is hidden - stop camera to save resources
        console.log("[VISIBILITY] Tab hidden, stopping camera");
        stopCameraAndCleanup();
        setScanning(false);
        setScanner(null);
      }
    };

    // Handle page navigation (React Router / Next.js routing)
    const handleBeforeUnload = () => {
      console.log("[BEFOREUNLOAD] Page unloading, stopping camera");
      stopCameraAndCleanup();
    };

    // Handle page hide (works better on mobile)
    const handlePageHide = () => {
      console.log("[PAGEHIDE] Page hidden, stopping camera");
      stopCameraAndCleanup();
    };

    // Add all event listeners
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  const startScanning = async () => {
    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      setScanner(html5QrCode);
      scannerRef.current = html5QrCode; // Store in ref for cleanup

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: 250, // Use single value for square, or function for responsive
          aspectRatio: 1.0, // 1:1 aspect ratio for container
        },
        onScanSuccess,
        onScanError,
      );

      setScanning(true);
      message.success("Camera started");
    } catch (err: any) {
      message.error(`Failed to start camera: ${err.message}`);
    }
  };

  const stopScanning = async () => {
    if (scanner) {
      try {
        // Check if scanner is actually running before stopping
        // State codes: 1 = NOT_STARTED, 2 = SCANNING, 3 = PAUSED
        const state = scanner.getState();
        if (state === 2 || state === 3) {
          // State 2 = SCANNING, State 3 = PAUSED
          await scanner.stop();
          scanner.clear(); // ← Release camera stream
          message.info("Camera stopped");
        } else {
          // Scanner not running, just clear state
          scanner.clear();
        }

        // FORCE STOP all video tracks immediately
        forceStopAllCameraTracks();

        // Clear all state
        setScanning(false);
        setScanner(null);
        scannerRef.current = null;
      } catch (err: any) {
        console.error("Stop scanner error:", err);
        // Force clear state anyway
        try {
          scanner.clear();
        } catch (clearErr) {
          console.error("Force clear error:", clearErr);
        }

        // FORCE STOP all video tracks
        forceStopAllCameraTracks();

        setScanning(false);
        setScanner(null);
        scannerRef.current = null;
      }
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    const now = Date.now();

    // Prevent processing if already processing
    if (processing) {
      console.log("[SCAN] Ignoring - already processing");
      return;
    }

    // For duplicate scans within 1 second, just ignore silently
    if (
      lastScannedQR.current === decodedText &&
      now - lastScanTime.current < 1000
    ) {
      console.log("[SCAN] Ignoring - same QR within 1s (rapid fire)");
      return;
    }

    console.log("[SCAN] Processing QR:", decodedText);
    lastScanTime.current = now;
    lastScannedQR.current = decodedText;
    await processQRResult(decodedText);
  };

  const onScanError = (err: any) => {
    // Ignore scan errors (too noisy)
  };

  const processQRResult = async (decodedText: string) => {
    // Model B: plain TKT-XXXXXXXX (preferred)
    // Legacy URL: /check-in/TKHXXXX or order number
    const raw = String(decodedText || "").trim();
    const tktMatch = raw.match(/TKT-[A-F0-9]+/i);
    const orderFromUrl = raw.match(/\/check-in\/([A-Z0-9]+)/i);
    const ticketCode = tktMatch ? tktMatch[0].toUpperCase() : null;
    const orderNumber = !ticketCode
      ? orderFromUrl
        ? orderFromUrl[1].toUpperCase()
        : /^[A-Z0-9]{6,}$/i.test(raw)
          ? raw.toUpperCase()
          : null
      : null;

    if (!ticketCode && !orderNumber) {
      message.error("Invalid QR — expect TKT-xxx ticket code");
      return;
    }

    // Set processing state
    setProcessing(true);

    // Call check-in API
    try {
      const token = localStorage.getItem("token");
      const payload = ticketCode
        ? { ticketCode }
        : { orderNumber: orderNumber! };
      console.log("[CHECK-IN] Calling API with:", payload);

      const res = await fetch("/api/admin/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      console.log("[CHECK-IN] Response status:", res.status);
      const data = await res.json();
      console.log("[CHECK-IN] Response data:", data);

      if (data.success) {
        const label = data.data.ticketCode
          ? `${data.data.ticketCode} · ${data.data.typeName || "Ticket"}`
          : data.data.customerName;
        message.success(`✅ Check-in OK: ${label}`, 5);
        setLastResult(data.data);

        // Re-read counters and the log from the server rather than guessing
        // locally: an order scan admits several tickets at once, and other
        // staff are scanning at the same door.
        void refreshCheckInData();

        // Play success sound
        new Audio("/sounds/success.mp3").play().catch(() => {});

        // Pause scanning for 2 seconds to show result, then allow next scan
        if (scanner && scanning) {
          try {
            // pause() doesn't return a promise, so no await needed
            scanner.pause(true);
            setTimeout(() => {
              if (scanner && scanning) {
                scanner.resume();
              }
              // Reset lastScannedQR to allow scanning next ticket (even if not scanning)
              lastScannedQR.current = "";
              console.log("[SCAN] Ready for next QR code");
            }, 2000);
          } catch (err) {
            console.error("Pause/resume scanner error:", err);
          }
        } else {
          // Not scanning, just reset after 2s
          setTimeout(() => {
            lastScannedQR.current = "";
            console.log("[SCAN] Ready for next QR code");
          }, 2000);
        }
      } else {
        // Better error handling for different cases
        const errorMsg = data.error || "Check-in failed";

        if (errorMsg.includes("not found") || res.status === 404) {
          message.error(`❌ Order ${orderNumber} not found in system`, 4);
        } else if (errorMsg.includes("already checked in")) {
          message.warning(`⚠️ Already checked in: ${orderNumber}`, 4);
        } else if (errorMsg.includes("not paid") || errorMsg.includes("PAID")) {
          message.error(`❌ Order not paid yet: ${orderNumber}`, 4);
        } else {
          message.error(`❌ ${errorMsg}`, 4);
        }

        // Reset lastScannedQR after 1s to allow retry/scan next
        setTimeout(() => {
          lastScannedQR.current = "";
          console.log("[SCAN] Ready for next scan after error");
        }, 1000);
      }
    } catch (err: any) {
      message.error(`❌ Network error: ${err.message}`, 4);
      // Reset lastScannedQR after 1s to allow retry
      setTimeout(() => {
        lastScannedQR.current = "";
        console.log("[SCAN] Ready for next scan after network error");
      }, 1000);
    } finally {
      setProcessing(false);
    }
  };

  const logColumns: ColumnsType<CheckInRecord> = [
    {
      title: "Thời gian",
      dataIndex: "checkedInAt",
      key: "checkedInAt",
      width: 150,
      render: (v: string) => (
        <span className="font-mono text-xs">{formatScanTime(v)}</span>
      ),
    },
    {
      title: "Mã vé",
      dataIndex: "ticketCode",
      key: "ticketCode",
      width: 150,
      render: (v: string | null) =>
        v ? (
          <span className="font-mono text-xs font-semibold">{v}</span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
    {
      title: "Loại vé",
      dataIndex: "typeName",
      key: "typeName",
      width: 110,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: "Người tham dự",
      key: "attendee",
      render: (_: unknown, r: CheckInRecord) => (
        <div className="leading-tight">
          <div className="text-sm font-medium">
            {r.attendeeName || r.customerName}
          </div>
          <div className="text-xs text-gray-500">
            {r.attendeeEmail || r.orderNumber}
          </div>
        </div>
      ),
    },
    {
      title: "Đơn hàng",
      dataIndex: "orderNumber",
      key: "orderNumber",
      width: 130,
      render: (v: string) => <span className="font-mono text-xs">{v}</span>,
    },
    {
      title: "Nhân viên quét",
      dataIndex: "checkedInBy",
      key: "checkedInBy",
      width: 140,
      render: (v: string | null) =>
        v || <span className="text-gray-400 text-xs">(không rõ)</span>,
    },
  ];

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ScanOutlined className="text-blue-500" />
              QR Code Check-In
            </h1>
            <div className="flex items-center gap-2">
              {events.length > 1 && (
                <Select
                  value={eventId ?? undefined}
                  onChange={setEventId}
                  style={{ minWidth: 260 }}
                  options={events.map((e) => ({
                    value: e.id,
                    label: `${e.name}${e.status !== "PUBLISHED" ? ` (${e.status})` : ""}`,
                  }))}
                />
              )}
              <Button
                icon={<ReloadOutlined />}
                onClick={() => void refreshCheckInData()}
                loading={loadingLog}
              >
                Làm mới
              </Button>
            </div>
          </div>

          {/* Compact Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card size="small" className="text-center">
              <div className="text-xs text-gray-500 mb-1">Total</div>
              <div className="text-xl font-bold">{stats.total}</div>
            </Card>
            <Card
              size="small"
              className="text-center border-green-200 bg-green-50"
            >
              <div className="text-xs text-gray-500 mb-1">
                <CheckCircleOutlined className="text-green-600" /> Checked
              </div>
              <div className="text-xl font-bold text-green-600">
                {stats.checkedIn}
              </div>
            </Card>
            <Card
              size="small"
              className="text-center border-orange-200 bg-orange-50"
            >
              <div className="text-xs text-gray-500 mb-1">
                <CloseCircleOutlined className="text-orange-600" /> Pending
              </div>
              <div className="text-xl font-bold text-orange-600">
                {stats.pending}
              </div>
            </Card>
          </div>
        </div>

        {/* Scanner Card */}
        <Card>
          <Spin spinning={processing} tip="Processing check-in...">
            {/* Controls */}
            <div className="text-center mb-6">
              {!scanning ? (
                <Button
                  type="primary"
                  size="large"
                  onClick={startScanning}
                  icon={<CameraOutlined />}
                  className="h-12 px-8 text-lg"
                >
                  Start Camera
                </Button>
              ) : (
                <Button
                  type="default"
                  size="large"
                  onClick={stopScanning}
                  danger
                  className="h-12 px-8 text-lg"
                >
                  Stop Camera
                </Button>
              )}
            </div>

            {/* QR Reader with Processing Overlay */}
            <div className="relative">
              <div
                id="qr-reader"
                className={`w-full mx-auto overflow-hidden rounded-lg transition-opacity duration-300 ${
                  processing ? "opacity-30" : "opacity-100"
                }`}
                style={{
                  maxWidth: 600,
                }}
              />
              {processing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 rounded-lg">
                  <div className="bg-white px-6 py-4 rounded-lg shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                      <span className="text-lg font-semibold text-gray-700">
                        Processing...
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Spin>

          {/* Last Check-In Result */}
          {lastResult && (
            <Card className="mt-6 border-green-200 bg-green-50" size="small">
              <h3 className="text-lg font-bold text-green-600 mb-3 flex items-center gap-2">
                <CheckCircleOutlined />
                Last Check-In
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold">Order:</span>{" "}
                  {lastResult.orderNumber}
                </div>
                {lastResult.ticketCode && (
                  <div>
                    <span className="font-semibold">Ticket:</span>{" "}
                    <span className="font-mono">{lastResult.ticketCode}</span>
                    {lastResult.typeName ? ` · ${lastResult.typeName}` : ""}
                  </div>
                )}
                <div>
                  <span className="font-semibold">Customer:</span>{" "}
                  {lastResult.customerName}
                </div>
                <div>
                  <span className="font-semibold">Email:</span>{" "}
                  {lastResult.customerEmail}
                </div>
                {lastResult.progress && (
                  <div>
                    <span className="font-semibold">Order progress:</span>{" "}
                    {lastResult.progress.checkedIn}/{lastResult.progress.total}{" "}
                    tickets in
                  </div>
                )}
                {lastResult.seatNumbers &&
                  lastResult.seatNumbers.length > 0 && (
                    <div>
                      <span className="font-semibold">Seats:</span>{" "}
                      {lastResult.seatNumbers.join(", ")}
                    </div>
                  )}
                <div>
                  <span className="font-semibold">Event:</span>{" "}
                  {lastResult.event.name}
                </div>
              </div>
            </Card>
          )}
        </Card>

        {/* Admitted tickets. One row per QR scanned, newest first — an order
            scanned as a whole contributes one row per ticket it admitted. */}
        <Card
          className="mt-6"
          title={
            <div className="flex items-center gap-2">
              <CheckCircleOutlined className="text-green-600" />
              <span>Lịch sử check-in</span>
              <span className="text-gray-400 font-normal text-sm">
                ({records.length})
              </span>
            </div>
          }
        >
          <Table<CheckInRecord>
            rowKey="id"
            size="small"
            loading={loadingLog}
            columns={logColumns}
            dataSource={records}
            scroll={{ x: 900 }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (t) => `${t} vé đã vào`,
            }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Chưa có vé nào được check-in"
                />
              ),
            }}
          />
        </Card>
      </div>
    </AdminLayout>
  );
}
