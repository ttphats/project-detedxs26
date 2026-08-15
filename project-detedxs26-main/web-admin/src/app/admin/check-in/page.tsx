"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { message, Card, Button, Spin, Table, Select, Tag, Empty } from "antd";
import {
  ScanOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CameraOutlined,
} from "@ant-design/icons";
import { AdminLayout } from "@/components/admin";
import AnimatedCount from "@/components/admin/AnimatedCount";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

interface CheckInResult {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  ticketTypes: string[];
  event: {
    name: string;
  };
}

interface ScannedTicket {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  ticketTypes: string[];
  checkedInAt: string;
  checkedInBy: string | null;
}

interface EventOption {
  id: string;
  name: string;
  status?: string;
}

export default function CheckInPage() {
  const [scanning, setScanning] = useState(false);
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);
  const [stats, setStats] = useState({ total: 0, checkedIn: 0, pending: 0 });
  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventId, setEventId] = useState<string>("");
  const [scannedTickets, setScannedTickets] = useState<ScannedTicket[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const lastScanTime = useRef<number>(0);
  const lastScannedQR = useRef<string>(""); // Track last scanned QR to prevent duplicates
  const scannerRef = useRef<Html5Qrcode | null>(null); // Track scanner for cleanup
  const pageRef = useRef<HTMLDivElement>(null);

  // Entrance animation for the stat cards. Scoped to the page root so the
  // `.stat-card` selector can never reach outside this component, and
  // skipped entirely for users who prefer reduced motion.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          fullMotion: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
        const { reduceMotion } = ctx.conditions as { reduceMotion: boolean };
        if (reduceMotion) return;
        gsap.from(".stat-card", {
          y: 16,
          autoAlpha: 0,
          duration: 0.5,
          ease: "power2.out",
          stagger: 0.08,
        });
      });
      return () => mm.revert();
    },
    { scope: pageRef },
  );

  // Flash the most recent row each time a new ticket lands in the log, so
  // the operator can see the scan register without reading the whole table.
  useGSAP(
    () => {
      if (scannedTickets.length === 0) return;
      const mm = gsap.matchMedia();
      mm.add(
        {
          reduceMotion: "(prefers-reduced-motion: reduce)",
          fullMotion: "(prefers-reduced-motion: no-preference)",
        },
        (ctx) => {
        const { reduceMotion } = ctx.conditions as { reduceMotion: boolean };
        if (reduceMotion) return;
        gsap.fromTo(
          ".check-in-log .ant-table-tbody tr:first-child td",
          { backgroundColor: "#dcfce7" },
          { backgroundColor: "transparent", duration: 1.4, ease: "power1.out" },
        );
      });
      return () => mm.revert();
    },
    { dependencies: [scannedTickets.length], scope: pageRef },
  );

  // Helper function to force stop all camera tracks
  /**
   * Tear a scanner down safely.
   *
   * html5-qrcode throws "Cannot clear while scan is ongoing, close it first."
   * if clear() runs while the scanner is still SCANNING/PAUSED. stop() is
   * async, so calling clear() straight after it (rather than after it
   * resolves) hits exactly that race. Sequencing them here fixes it, and the
   * returned promise lets async callers await the teardown.
   */
  const teardownScanner = (instance: Html5Qrcode | null): Promise<void> => {
    if (!instance) return Promise.resolve();

    const safeClear = () => {
      try {
        instance.clear();
      } catch (clearErr) {
        // Nothing left to clear (already torn down) — not actionable.
        console.debug("[CLEANUP] clear() skipped:", clearErr);
      }
    };

    let state: number | undefined;
    try {
      state = instance.getState();
    } catch {
      safeClear();
      return Promise.resolve();
    }

    // State codes: 1 = NOT_STARTED, 2 = SCANNING, 3 = PAUSED
    if (state === 2 || state === 3) {
      return instance
        .stop()
        .catch((err) => {
          console.debug("[CLEANUP] stop() failed:", err);
        })
        .then(safeClear);
    }

    safeClear();
    return Promise.resolve();
  };

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

  // Cleanup on unmount
  const authHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  });

  /**
   * Pull the real counters + check-in log from the server.
   *
   * The stats used to live purely in local state seeded at {0,0,0} and were
   * only ever nudged by an optimistic +1/-1 after a scan, so Total stayed 0
   * forever and the other two drifted from reality. Both now come from the
   * API, and are re-pulled after every successful scan.
   */
  const refreshCheckInData = useCallback(
    async (targetEventId: string) => {
      if (!targetEventId) return;
      setLoadingLog(true);
      try {
        const [statsRes, listRes] = await Promise.all([
          fetch(`/api/admin/check-in/stats/${targetEventId}`, { headers: authHeaders() }),
          fetch(`/api/admin/check-in/list/${targetEventId}`, { headers: authHeaders() }),
        ]);

        const statsData = await statsRes.json();
        if (statsData.success && statsData.data) {
          setStats({
            total: statsData.data.total ?? 0,
            checkedIn: statsData.data.checkedIn ?? 0,
            pending: statsData.data.pending ?? 0,
          });
        }

        const listData = await listRes.json();
        if (listData.success && Array.isArray(listData.data)) {
          setScannedTickets(listData.data);
        }
      } catch (err) {
        console.error("[CHECK-IN] Failed to load stats/log:", err);
      } finally {
        setLoadingLog(false);
      }
    },
    [],
  );

  // Load the event list once, then default to the first published event.
  useEffect(() => {
    const loadEvents = async () => {
      try {
        const res = await fetch("/api/admin/events", { headers: authHeaders() });
        const data = await res.json();
        const list: EventOption[] = data?.data || [];
        setEvents(list);
        if (list.length > 0) {
          const preferred = list.find((e) => e.status === "PUBLISHED") || list[0];
          setEventId(preferred.id);
        }
      } catch (err) {
        console.error("[CHECK-IN] Failed to load events:", err);
      }
    };
    loadEvents();
  }, []);

  // Whenever the selected event changes, load its counters and log.
  useEffect(() => {
    if (eventId) refreshCheckInData(eventId);
  }, [eventId, refreshCheckInData]);

  useEffect(() => {
    return () => {
      const currentScanner = scannerRef.current;
      if (currentScanner) {
        console.log("[CLEANUP] Tearing down scanner on unmount");
        // Cleanup functions can't await; the tracks below are stopped
        // immediately regardless, so the camera light goes out right away.
        void teardownScanner(currentScanner);
        scannerRef.current = null;
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
        scannerRef.current = null;
        void teardownScanner(currentScanner).then(() => {
          console.log("[CLEANUP] Scanner stopped and cleared");
        });
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
        const wasRunning = scanner.getState() === 2 || scanner.getState() === 3;
        await teardownScanner(scanner);
        if (wasRunning) message.info("Camera stopped");

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
    // Extract order number from URL: https://tedxfptuniversityhcmc.com/check-in/TKHXXXXXXX
    const match = decodedText.match(/\/check-in\/([A-Z0-9]+)/);
    if (!match) {
      message.error("Invalid QR code format");
      return;
    }

    const orderNumber = match[1];

    // Set processing state
    setProcessing(true);

    // Call check-in API
    try {
      const token = localStorage.getItem("token");
      console.log("[CHECK-IN] Calling API with order:", orderNumber);
      console.log(
        "[CHECK-IN] Token:",
        token ? token.substring(0, 20) + "..." : "NO TOKEN",
      );

      const res = await fetch("/api/admin/check-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderNumber }),
      });

      console.log("[CHECK-IN] Response status:", res.status);
      const data = await res.json();
      console.log("[CHECK-IN] Response data:", data);

      if (data.success) {
        message.success(`✅ Check-in successful: ${data.data.customerName}`, 5);
        setLastResult(data.data);

        // Optimistic bump so the counter reacts instantly, then reconcile
        // with the server so the numbers can't drift.
        setStats((prev) => ({
          ...prev,
          checkedIn: prev.checkedIn + 1,
          pending: Math.max(0, prev.pending - 1),
        }));
        refreshCheckInData(eventId);

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

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto py-6 px-4" ref={pageRef}>
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ScanOutlined className="text-blue-500" />
              QR Code Check-In
            </h1>
            <Select
              value={eventId || undefined}
              onChange={setEventId}
              placeholder="Select event"
              style={{ minWidth: 260 }}
              options={events.map((e) => ({ value: e.id, label: e.name }))}
            />
          </div>

          {/* Compact Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card size="small" className="text-center stat-card">
              <div className="text-xs text-gray-500 mb-1">Total</div>
              <div className="text-xl font-bold">
                <AnimatedCount value={stats.total} />
              </div>
            </Card>
            <Card
              size="small"
              className="text-center border-green-200 bg-green-50 stat-card"
            >
              <div className="text-xs text-gray-500 mb-1">
                <CheckCircleOutlined className="text-green-600" /> Checked
              </div>
              <div className="text-xl font-bold text-green-600">
                <AnimatedCount value={stats.checkedIn} />
              </div>
            </Card>
            <Card
              size="small"
              className="text-center border-orange-200 bg-orange-50 stat-card"
            >
              <div className="text-xs text-gray-500 mb-1">
                <CloseCircleOutlined className="text-orange-600" /> Pending
              </div>
              <div className="text-xl font-bold text-orange-600">
                <AnimatedCount value={stats.pending} />
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
                <div>
                  <span className="font-semibold">Customer:</span>{" "}
                  {lastResult.customerName}
                </div>
                <div>
                  <span className="font-semibold">Email:</span>{" "}
                  {lastResult.customerEmail}
                </div>
                <div>
                  <span className="font-semibold">Tickets:</span>{" "}
                  {lastResult.ticketTypes.join(", ")}
                </div>
                <div>
                  <span className="font-semibold">Event:</span>{" "}
                  {lastResult.event.name}
                </div>
              </div>
            </Card>
          )}
        </Card>

        {/* Scanned tickets log — the record of what has actually been
            checked in, straight from the server rather than local state. */}
        <Card
          className="mt-6 check-in-log"
          title={
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircleOutlined className="text-green-600" />
                Scanned Tickets
              </span>
              <span className="text-xs font-normal text-gray-500">
                {scannedTickets.length} record{scannedTickets.length === 1 ? "" : "s"}
              </span>
            </div>
          }
        >
          <Table
            size="small"
            loading={loadingLog}
            dataSource={scannedTickets}
            rowKey="orderNumber"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: "max-content" }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No tickets scanned yet"
                />
              ),
            }}
            columns={[
              {
                title: "Order",
                dataIndex: "orderNumber",
                key: "orderNumber",
                width: 130,
                render: (v: string) => (
                  <span className="font-mono font-medium">{v}</span>
                ),
              },
              {
                title: "Attendee",
                key: "attendee",
                render: (_: unknown, r: ScannedTicket) => (
                  <div>
                    <div className="font-medium">{r.customerName || "—"}</div>
                    <div className="text-xs text-gray-500">{r.customerEmail}</div>
                  </div>
                ),
              },
              {
                title: "Tickets",
                dataIndex: "ticketTypes",
                key: "ticketTypes",
                render: (types: string[]) => {
                  const counts = new Map<string, number>();
                  for (const t of types || []) {
                    const name = t || "—";
                    counts.set(name, (counts.get(name) || 0) + 1);
                  }
                  if (counts.size === 0) return <span className="text-gray-400">—</span>;
                  return (
                    <div className="flex flex-wrap gap-1">
                      {[...counts.entries()].map(([name, count]) => (
                        <Tag key={name} color={name === "VIP" ? "red" : "blue"}>
                          {count}x {name}
                        </Tag>
                      ))}
                    </div>
                  );
                },
              },
              {
                title: "Checked in at",
                dataIndex: "checkedInAt",
                key: "checkedInAt",
                width: 170,
                render: (v: string) =>
                  v ? new Date(v).toLocaleString("vi-VN") : "—",
              },
              {
                title: "By",
                dataIndex: "checkedInBy",
                key: "checkedInBy",
                width: 140,
                render: (v: string | null) =>
                  v || <span className="text-gray-400">—</span>,
              },
            ]}
          />
        </Card>
      </div>
    </AdminLayout>
  );
}
