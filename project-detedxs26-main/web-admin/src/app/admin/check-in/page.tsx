"use client";

import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { message, Card, Button, Spin } from "antd";
import {
  ScanOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CameraOutlined,
} from "@ant-design/icons";
import { AdminLayout } from "@/components/admin";

interface CheckInResult {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  seatNumbers: string[];
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

        // Update stats
        setStats((prev) => ({
          ...prev,
          checkedIn: prev.checkedIn + 1,
          pending: prev.pending - 1,
        }));

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
      <div className="max-w-2xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <ScanOutlined className="text-blue-500" />
            QR Code Check-In
          </h1>

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
                <div>
                  <span className="font-semibold">Customer:</span>{" "}
                  {lastResult.customerName}
                </div>
                <div>
                  <span className="font-semibold">Email:</span>{" "}
                  {lastResult.customerEmail}
                </div>
                <div>
                  <span className="font-semibold">Seats:</span>{" "}
                  {lastResult.seatNumbers.join(", ")}
                </div>
                <div>
                  <span className="font-semibold">Event:</span>{" "}
                  {lastResult.event.name}
                </div>
              </div>
            </Card>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}
