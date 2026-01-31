"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin";
import {
  Button,
  Card,
  InputNumber,
  message,
  Space,
  Tag,
  Tooltip,
  Segmented,
  Select,
  Modal,
  Input,
  Table,
  Popconfirm,
} from "antd";
import {
  SaveOutlined,
  ClearOutlined,
  CheckSquareOutlined,
  ReloadOutlined,
  TableOutlined,
  CloudUploadOutlined,
  HistoryOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  EditOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { exportSeatsToExcel } from "@/lib/excel-export";

// Types
type SeatType = "VIP" | "STANDARD" | "ECONOMY" | "DISABLED";

// Local seat for rendering
interface Seat {
  id: string;
  row: string;
  col: number;
  side: "left" | "right";
  type: SeatType;
  seat_number: string;
}

interface LayoutConfig {
  rows: number;
  leftSeats: number;
  rightSeats: number;
  aisleWidth: number;
}

interface EventOption {
  id: string;
  name: string;
}

interface TicketType {
  id: string;
  name: string;
  price: number;
  color: string;
}

interface LayoutVersion {
  id: string;
  event_id: string;
  version_name: string;
  description: string | null;
  layout_config: LayoutConfig;
  seats_data: Seat[];
  status: "DRAFT" | "PUBLISHED";
  is_active: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

// Constants
const ROW_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const SEAT_COLORS: Record<
  SeatType,
  { back: string; cushion: string; armrest: string; label: string }
> = {
  VIP: {
    back: "from-yellow-400 to-orange-500",
    cushion: "from-orange-500 to-orange-600",
    armrest: "bg-orange-600",
    label: "VIP",
  },
  STANDARD: {
    back: "from-emerald-400 to-emerald-500",
    cushion: "from-emerald-500 to-emerald-600",
    armrest: "bg-emerald-600",
    label: "Tiêu chuẩn",
  },
  ECONOMY: {
    back: "from-cyan-400 to-cyan-500",
    cushion: "from-cyan-500 to-cyan-600",
    armrest: "bg-cyan-600",
    label: "Phổ thông",
  },
  DISABLED: {
    back: "from-gray-600 to-gray-700",
    cushion: "from-gray-700 to-gray-800",
    armrest: "bg-gray-800",
    label: "Vô hiệu",
  },
};

// Default config
const DEFAULT_CONFIG: LayoutConfig = {
  rows: 10,
  leftSeats: 5,
  rightSeats: 5,
  aisleWidth: 60,
};

// Generate seats from config
const generateSeatsFromConfig = (
  cfg: LayoutConfig,
  defaultType: SeatType = "STANDARD",
): Seat[] => {
  const seats: Seat[] = [];
  for (let r = 0; r < cfg.rows; r++) {
    const rowLabel = ROW_LABELS[r] || `R${r + 1}`;
    // Left side
    for (let c = 1; c <= cfg.leftSeats; c++) {
      seats.push({
        id: `${rowLabel}-L${c}`,
        row: rowLabel,
        col: c,
        side: "left",
        type: defaultType,
        seat_number: `${rowLabel}${c}`,
      });
    }
    // Right side
    for (let c = 1; c <= cfg.rightSeats; c++) {
      seats.push({
        id: `${rowLabel}-R${c}`,
        row: rowLabel,
        col: c + cfg.leftSeats,
        side: "right",
        type: defaultType,
        seat_number: `${rowLabel}${c + cfg.leftSeats}`,
      });
    }
  }
  return seats;
};

export default function LayoutEditorPage() {
  // Layout state
  const [config, setConfig] = useState<LayoutConfig>(DEFAULT_CONFIG);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Version management
  const [versions, setVersions] = useState<LayoutVersion[]>([]);
  const [currentVersion, setCurrentVersion] = useState<LayoutVersion | null>(
    null,
  );
  const [showVersionsModal, setShowVersionsModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [versionName, setVersionName] = useState("");
  const [versionDescription, setVersionDescription] = useState("");

  // Selection state
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [currentType, setCurrentType] = useState<SeatType>("STANDARD");

  // Preview mode
  const [showPreview, setShowPreview] = useState(false);

  // Fetch events and versions
  const fetchData = useCallback(async (eventId?: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      // Fetch events list first
      const eventsRes = await fetch("/api/admin/seats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const eventsData = await eventsRes.json();
      if (eventsData.success) {
        setEvents(eventsData.data.events || []);
        if (!eventId && eventsData.data.events?.length > 0) {
          eventId = eventsData.data.events[0].id;
          setSelectedEvent(eventId);
        }
      }

      if (!eventId) {
        setLoading(false);
        return;
      }

      // Fetch versions for selected event
      const versionsRes = await fetch(
        `/api/admin/layout-versions?eventId=${eventId}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const versionsData = await versionsRes.json();
      if (versionsData.success) {
        setVersions(versionsData.data.versions || []);
        setTicketTypes(versionsData.data.ticketTypes || []);

        // Load active version or latest draft
        const activeVersion = versionsData.data.versions?.find(
          (v: LayoutVersion) => v.is_active,
        );
        const latestDraft = versionsData.data.versions?.find(
          (v: LayoutVersion) => v.status === "DRAFT",
        );

        if (activeVersion) {
          loadVersion(activeVersion);
        } else if (latestDraft) {
          loadVersion(latestDraft);
        } else {
          // No versions, load seats from database
          try {
            const seatsRes = await fetch(
              `/api/admin/seats?eventId=${eventId}`,
              {
                headers: { Authorization: `Bearer ${token}` },
              },
            );
            const seatsData = await seatsRes.json();
            if (seatsData.success && seatsData.data.seats?.length > 0) {
              // Convert DB seats to layout format
              const dbSeats = seatsData.data.seats;
              const convertedSeats: Seat[] = dbSeats.map((s: any) => ({
                id: s.id,
                row: s.row,
                col: parseInt(s.col),
                side: s.section === "LEFT" ? "left" : "right",
                type: s.seat_type as SeatType,
                seat_number: s.seat_number,
              }));

              // Calculate config from seats
              const rows = new Set(dbSeats.map((s: any) => s.row)).size;
              const leftSeats =
                dbSeats.filter((s: any) => s.section === "LEFT").length /
                  rows || 5;
              const rightSeats =
                dbSeats.filter((s: any) => s.section === "RIGHT").length /
                  rows || 5;

              setConfig({
                rows,
                leftSeats: Math.round(leftSeats),
                rightSeats: Math.round(rightSeats),
                aisleWidth: 60,
              });
              setSeats(convertedSeats);
              setCurrentVersion(null);
            } else {
              // No seats in DB, create default layout
              const defaultSeats = generateSeatsFromConfig(DEFAULT_CONFIG);
              setConfig(DEFAULT_CONFIG);
              setSeats(defaultSeats);
              setCurrentVersion(null);
            }
          } catch (err) {
            console.error("Failed to load seats from DB:", err);
            const defaultSeats = generateSeatsFromConfig(DEFAULT_CONFIG);
            setConfig(DEFAULT_CONFIG);
            setSeats(defaultSeats);
            setCurrentVersion(null);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
      message.error("Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load a version
  const loadVersion = (version: LayoutVersion) => {
    setConfig(version.layout_config);
    setSeats(version.seats_data);
    setCurrentVersion(version);
    setHasChanges(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Refetch when event changes
  useEffect(() => {
    if (selectedEvent) {
      fetchData(selectedEvent);
    }
  }, [selectedEvent]);

  // Regenerate seats when config changes
  const regenerateSeats = useCallback(() => {
    const newSeats = generateSeatsFromConfig(config);
    setSeats(newSeats);
    setSelectedSeats(new Set());
    setHasChanges(true);
  }, [config]);

  // Save draft
  const handleSaveDraft = async () => {
    if (!selectedEvent) {
      message.error("Vui lòng chọn sự kiện");
      return;
    }
    if (!versionName.trim()) {
      message.error("Vui lòng nhập tên version");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        event_id: selectedEvent,
        version_name: versionName.trim(),
        description: versionDescription.trim() || null,
        layout_config: config,
        seats_data: seats,
      };

      const token = localStorage.getItem("token");
      let res;
      if (currentVersion && currentVersion.status === "DRAFT") {
        // Update existing draft
        res = await fetch(`/api/admin/layout-versions/${currentVersion.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new draft
        res = await fetch("/api/admin/layout-versions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.success) {
        message.success("Đã lưu draft thành công!");
        setShowSaveModal(false);
        setVersionName("");
        setVersionDescription("");
        setHasChanges(false);
        fetchData(selectedEvent);
      } else {
        message.error(data.error || "Lỗi khi lưu draft");
      }
    } catch (error) {
      console.error("Save draft error:", error);
      message.error("Lỗi khi lưu draft");
    } finally {
      setSaving(false);
    }
  };

  // Publish version
  const handlePublish = async (versionId: string) => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/admin/layout-versions/${versionId}/publish`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.success) {
        message.success(data.message || "Đã publish thành công!");
        setShowVersionsModal(false);
        fetchData(selectedEvent);
      } else {
        message.error(data.error || "Lỗi khi publish");
      }
    } catch (error) {
      console.error("Publish error:", error);
      message.error("Lỗi khi publish");
    } finally {
      setSaving(false);
    }
  };

  // Delete version
  const handleDeleteVersion = async (versionId: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/layout-versions?id=${versionId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        message.success("Đã xóa version!");
        fetchData(selectedEvent);
      } else {
        message.error(data.error || "Lỗi khi xóa");
      }
    } catch (error) {
      console.error("Delete error:", error);
      message.error("Lỗi khi xóa");
    }
  };

  // Handle seat click
  const handleSeatClick = (seatId: string) => {
    if (isMultiSelect) {
      // Toggle selection
      const newSelected = new Set(selectedSeats);
      if (newSelected.has(seatId)) {
        newSelected.delete(seatId);
      } else {
        newSelected.add(seatId);
      }
      setSelectedSeats(newSelected);
    } else {
      // Single click - toggle type or set to current type
      setSeats((prev) =>
        prev.map((s) => (s.id === seatId ? { ...s, type: currentType } : s)),
      );
      setHasChanges(true);
    }
  };

  // Apply type to selected seats
  const applyTypeToSelected = (type: SeatType) => {
    if (selectedSeats.size === 0) {
      message.warning("Chưa chọn ghế nào!");
      return;
    }
    setSeats((prev) =>
      prev.map((s) => (selectedSeats.has(s.id) ? { ...s, type } : s)),
    );
    setSelectedSeats(new Set());
    setHasChanges(true);
    message.success(
      `Đã cập nhật ${selectedSeats.size} ghế thành ${SEAT_COLORS[type].label}`,
    );
  };

  // Select all seats
  const selectAllSeats = () => {
    setSelectedSeats(new Set(seats.map((s) => s.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedSeats(new Set());
  };

  // Select row
  const selectRow = (rowLabel: string) => {
    const rowSeats = seats.filter((s) => s.row === rowLabel);
    const newSelected = new Set(selectedSeats);
    rowSeats.forEach((s) => newSelected.add(s.id));
    setSelectedSeats(newSelected);
  };

  // Get seat stats
  const getSeatStats = () => {
    const stats = { VIP: 0, STANDARD: 0, ECONOMY: 0, DISABLED: 0 };
    seats.forEach((s) => stats[s.type]++);
    return stats;
  };

  // Render seat component
  const renderSeat = (seat: Seat) => {
    const isSelected = selectedSeats.has(seat.id);
    const colors = SEAT_COLORS[seat.type];

    return (
      <Tooltip
        key={seat.id}
        title={
          <div className="text-xs">
            <div>Ghế: {seat.id}</div>
            <div>Loại: {colors.label}</div>
          </div>
        }
      >
        <button
          onClick={() => handleSeatClick(seat.id)}
          className={`relative w-9 h-10 flex flex-col items-center transition-all duration-200
            ${seat.type === "DISABLED" ? "opacity-50" : "hover:brightness-110 hover:scale-105"}
            ${isSelected ? "ring-2 ring-red-500 ring-offset-1 ring-offset-black scale-110" : ""}`}
        >
          {/* Seat back */}
          <div
            className={`w-7 h-5 rounded-t-md bg-gradient-to-b ${colors.back} flex items-center justify-center relative border-t border-l border-r border-white/20`}
          >
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-md" />
            <span className="relative text-[10px] font-bold text-white">
              {seat.col}
            </span>
          </div>
          {/* Seat cushion */}
          <div
            className={`w-8 h-3 rounded-b-sm bg-gradient-to-b ${colors.cushion} border-b border-l border-r border-white/10`}
          />
          {/* Armrests */}
          <div
            className={`absolute bottom-0 -left-0.5 w-0.5 h-2.5 rounded-b-sm ${colors.armrest}`}
          />
          <div
            className={`absolute bottom-0 -right-0.5 w-0.5 h-2.5 rounded-b-sm ${colors.armrest}`}
          />
          {/* Disabled X mark */}
          {seat.type === "DISABLED" && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-5 h-0.5 bg-red-500/80 rotate-45" />
              <div className="w-5 h-0.5 bg-red-500/80 -rotate-45 absolute" />
            </div>
          )}
        </button>
      </Tooltip>
    );
  };

  const stats = getSeatStats();

  // Group seats by row
  const getSeatsForRow = (rowLabel: string) => {
    const leftSeats = seats
      .filter((s) => s.row === rowLabel && s.side === "left")
      .sort((a, b) => a.col - b.col);
    const rightSeats = seats
      .filter((s) => s.row === rowLabel && s.side === "right")
      .sort((a, b) => a.col - b.col);
    return { leftSeats, rightSeats };
  };

  // Get unique rows
  const uniqueRows = [...new Set(seats.map((s) => s.row))].sort((a, b) => {
    const idxA = ROW_LABELS.indexOf(a);
    const idxB = ROW_LABELS.indexOf(b);
    return idxA - idxB;
  });

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Thiết kế Layout Ghế
            </h1>
            <p className="text-gray-500">
              Thiết lập layout và publish để đồng bộ với bảng Seats
              {currentVersion && (
                <span className="ml-2">
                  | Version: <strong>{currentVersion.version_name}</strong>
                  {currentVersion.is_active && (
                    <Tag color="green" className="ml-1">
                      Active
                    </Tag>
                  )}
                  {currentVersion.status === "DRAFT" && (
                    <Tag color="orange" className="ml-1">
                      Draft
                    </Tag>
                  )}
                </span>
              )}
            </p>
          </div>
          <Space wrap>
            <Link href="/admin/seats">
              <Button icon={<TableOutlined />}>Quản lý Seats</Button>
            </Link>
            <Button
              icon={<DownloadOutlined />}
              onClick={() => {
                const eventName =
                  events.find((e) => e.id === selectedEvent)?.name ||
                  "Unknown Event";
                const exportData = seats
                  .filter((s) => s.type !== "DISABLED")
                  .map((seat) => ({
                    seatNumber: seat.seat_number,
                    row: seat.row,
                    col: seat.col,
                    section: seat.side === "left" ? "Trái" : "Phải",
                    seatType: seat.type,
                    price: 0, // Layout editor không có giá
                    status: "AVAILABLE",
                    eventName: eventName,
                  }));
                exportSeatsToExcel(
                  exportData,
                  `layout_${eventName.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`,
                );
                message.success(
                  `Đã xuất ${exportData.length} ghế ra file Excel!`,
                );
              }}
              disabled={seats.filter((s) => s.type !== "DISABLED").length === 0}
            >
              Xuất Excel
            </Button>
            <Button
              icon={<HistoryOutlined />}
              onClick={() => setShowVersionsModal(true)}
            >
              Versions ({versions.length})
            </Button>
            <Button
              icon={<CheckSquareOutlined />}
              onClick={() => {
                // Save current state to sessionStorage before opening preview
                const previewData = {
                  config,
                  seats,
                  eventId: selectedEvent,
                  versionName: currentVersion?.version_name || "Draft",
                  timestamp: Date.now(),
                };
                sessionStorage.setItem(
                  "layout-preview-data",
                  JSON.stringify(previewData),
                );
                // Open layout preview page in new tab with preview mode flag
                window.open("/admin/layout-preview?mode=editor", "_blank");
              }}
            >
              Xem trước
            </Button>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={() => {
                if (currentVersion?.status === "DRAFT") {
                  setVersionName(currentVersion.version_name);
                  setVersionDescription(currentVersion.description || "");
                }
                setShowSaveModal(true);
              }}
              disabled={!hasChanges && !seats.length}
            >
              Lưu Draft
            </Button>
          </Space>
        </div>

        {/* Event Selector */}
        <Card size="small">
          <div className="flex items-center gap-4">
            <span className="font-medium">Sự kiện:</span>
            <Select
              style={{ width: 300 }}
              value={selectedEvent}
              onChange={(v) => setSelectedEvent(v)}
              options={events.map((e) => ({ label: e.name, value: e.id }))}
              placeholder="Chọn sự kiện"
              loading={loading}
            />
            {ticketTypes.length > 0 && (
              <div className="flex gap-2 ml-4">
                <span className="text-gray-500">Giá vé:</span>
                {ticketTypes.map((tt) => (
                  <Tag key={tt.id} color={tt.color}>
                    {tt.name}: {tt.price.toLocaleString("vi-VN")}đ
                  </Tag>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Config Panel */}
        <Card title="Cấu hình Layout" size="small">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số hàng
              </label>
              <InputNumber
                min={1}
                max={26}
                value={config.rows}
                onChange={(v) => setConfig({ ...config, rows: v || 1 })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ghế bên trái
              </label>
              <InputNumber
                min={0}
                max={20}
                value={config.leftSeats}
                onChange={(v) => setConfig({ ...config, leftSeats: v || 0 })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ghế bên phải
              </label>
              <InputNumber
                min={0}
                max={20}
                value={config.rightSeats}
                onChange={(v) => setConfig({ ...config, rightSeats: v || 0 })}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Khoảng cách (px)
              </label>
              <InputNumber
                min={20}
                max={200}
                value={config.aisleWidth}
                onChange={(v) => setConfig({ ...config, aisleWidth: v || 60 })}
                className="w-full"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={regenerateSeats} className="w-full">
                Tạo lại ghế
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
            <Tag color="orange">VIP: {stats.VIP}</Tag>
            <Tag color="green">Tiêu chuẩn: {stats.STANDARD}</Tag>
            <Tag color="cyan">Phổ thông: {stats.ECONOMY}</Tag>
            <Tag color="default">Vô hiệu: {stats.DISABLED}</Tag>
            <Tag color="blue">Tổng: {seats.length}</Tag>
          </div>
        </Card>

        {/* Selection Tools */}
        <Card title="Công cụ chọn ghế" size="small">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Chế độ:</span>
              <Segmented
                value={isMultiSelect ? "multi" : "single"}
                onChange={(v) => setIsMultiSelect(v === "multi")}
                options={[
                  { label: "Click đổi loại", value: "single" },
                  { label: "Chọn nhiều", value: "multi" },
                ]}
              />
            </div>

            {!isMultiSelect && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Loại ghế:</span>
                <Segmented
                  value={currentType}
                  onChange={(v) => setCurrentType(v as SeatType)}
                  options={[
                    { label: "VIP", value: "VIP" },
                    { label: "Tiêu chuẩn", value: "STANDARD" },
                    { label: "Phổ thông", value: "ECONOMY" },
                    { label: "Vô hiệu", value: "DISABLED" },
                  ]}
                />
              </div>
            )}

            {isMultiSelect && (
              <>
                <Button icon={<CheckSquareOutlined />} onClick={selectAllSeats}>
                  Chọn tất cả
                </Button>
                <Button icon={<ClearOutlined />} onClick={clearSelection}>
                  Bỏ chọn ({selectedSeats.size})
                </Button>
                <div className="border-l pl-4 flex gap-2">
                  <span className="text-sm font-medium self-center">
                    Đặt loại:
                  </span>
                  <Button
                    size="small"
                    onClick={() => applyTypeToSelected("VIP")}
                  >
                    VIP
                  </Button>
                  <Button
                    size="small"
                    onClick={() => applyTypeToSelected("STANDARD")}
                  >
                    Tiêu chuẩn
                  </Button>
                  <Button
                    size="small"
                    onClick={() => applyTypeToSelected("ECONOMY")}
                  >
                    Phổ thông
                  </Button>
                  <Button
                    size="small"
                    onClick={() => applyTypeToSelected("DISABLED")}
                  >
                    Vô hiệu
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>

        {/* Seat Layout */}
        <Card
          title="Sơ đồ ghế (Click để thay đổi loại)"
          className="overflow-auto"
        >
          <div className="min-h-[500px] bg-gradient-to-b from-gray-900 to-black rounded-xl p-6 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute top-10 right-10 w-[200px] h-[200px] bg-red-600/10 rounded-full blur-3xl" />
              <div className="absolute bottom-10 left-10 w-[150px] h-[150px] bg-red-600/5 rounded-full blur-3xl" />
            </div>

            {/* Stage */}
            <div className="relative mb-8">
              <div className="bg-gradient-to-r from-red-700 via-red-600 to-red-700 text-white py-4 px-8 rounded-xl text-center shadow-2xl shadow-red-500/30 border border-red-500/50">
                <span className="font-black uppercase tracking-widest">
                  Sân Khấu
                </span>
              </div>
            </div>

            {/* Seats Grid */}
            <div className="space-y-2">
              {uniqueRows.map((rowLabel) => {
                const { leftSeats: left, rightSeats: right } =
                  getSeatsForRow(rowLabel);

                return (
                  <div
                    key={rowLabel}
                    className="flex items-center justify-center gap-2"
                  >
                    {/* Row label left */}
                    <button
                      onClick={() => isMultiSelect && selectRow(rowLabel)}
                      className={`w-8 text-center font-bold text-sm ${
                        left.some((s) => s.type === "VIP")
                          ? "text-orange-400"
                          : "text-gray-500"
                      } ${isMultiSelect ? "hover:text-white cursor-pointer" : ""}`}
                    >
                      {rowLabel}
                    </button>

                    {/* Left seats */}
                    <div className="flex gap-1">
                      {left.map((seat) => renderSeat(seat))}
                    </div>

                    {/* Aisle */}
                    <div
                      className="flex items-center justify-center text-gray-600 text-xs"
                      style={{ width: config.aisleWidth }}
                    >
                      │
                    </div>

                    {/* Right seats */}
                    <div className="flex gap-1">
                      {right.map((seat) => renderSeat(seat))}
                    </div>

                    {/* Row label right */}
                    <button
                      onClick={() => isMultiSelect && selectRow(rowLabel)}
                      className={`w-8 text-center font-bold text-sm ${
                        right.some((s) => s.type === "VIP")
                          ? "text-orange-400"
                          : "text-gray-500"
                      } ${isMultiSelect ? "hover:text-white cursor-pointer" : ""}`}
                    >
                      {rowLabel}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-6 mt-8 pt-6 border-t border-white/10">
              {(["VIP", "STANDARD", "ECONOMY", "DISABLED"] as const).map(
                (type) => {
                  const colors = SEAT_COLORS[type];
                  return (
                    <div
                      key={type}
                      className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/5"
                    >
                      <div
                        className={`w-6 h-6 rounded bg-gradient-to-b ${colors.back}`}
                      />
                      <span className="text-white/80 text-sm">
                        {colors.label}
                      </span>
                    </div>
                  );
                },
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Save Draft Modal */}
      <Modal
        title={
          currentVersion?.status === "DRAFT"
            ? "Cập nhật Draft"
            : "Lưu Draft mới"
        }
        open={showSaveModal}
        onCancel={() => setShowSaveModal(false)}
        onOk={handleSaveDraft}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
      >
        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Tên version *
            </label>
            <Input
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="VD: Layout v1.0, Draft 2025..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Mô tả</label>
            <Input.TextArea
              value={versionDescription}
              onChange={(e) => setVersionDescription(e.target.value)}
              placeholder="Mô tả về version này..."
              rows={3}
            />
          </div>
          <div className="bg-gray-50 p-3 rounded text-sm">
            <p>
              <strong>Layout:</strong> {config.rows} hàng ×{" "}
              {config.leftSeats + config.rightSeats} ghế/hàng
            </p>
            <p>
              <strong>Tổng ghế:</strong> {seats.length}
            </p>
            <p>
              <strong>Phân loại:</strong> {getSeatStats().VIP} VIP,{" "}
              {getSeatStats().STANDARD} Standard, {getSeatStats().ECONOMY}{" "}
              Economy
            </p>
          </div>
        </div>
      </Modal>

      {/* Versions Modal */}
      <Modal
        title="Quản lý Versions"
        open={showVersionsModal}
        onCancel={() => setShowVersionsModal(false)}
        footer={null}
        width={800}
      >
        <Table
          dataSource={versions}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            {
              title: "Tên version",
              dataIndex: "version_name",
              key: "version_name",
              render: (name: string, record: LayoutVersion) => (
                <div>
                  <strong>{name}</strong>
                  {record.description && (
                    <p className="text-gray-500 text-xs">
                      {record.description}
                    </p>
                  )}
                </div>
              ),
            },
            {
              title: "Trạng thái",
              dataIndex: "status",
              key: "status",
              width: 120,
              render: (status: string, record: LayoutVersion) => (
                <div className="space-x-1">
                  {status === "PUBLISHED" ? (
                    <Tag color="blue">Published</Tag>
                  ) : (
                    <Tag color="orange">Draft</Tag>
                  )}
                  {record.is_active && <Tag color="green">Active</Tag>}
                </div>
              ),
            },
            {
              title: "Ghế",
              key: "seats",
              width: 80,
              render: (_: unknown, record: LayoutVersion) => (
                <span>{record.seats_data?.length || 0}</span>
              ),
            },
            {
              title: "Ngày tạo",
              dataIndex: "created_at",
              key: "created_at",
              width: 150,
              render: (date: string) =>
                new Date(date).toLocaleDateString("vi-VN"),
            },
            {
              title: "Hành động",
              key: "actions",
              width: 200,
              render: (_: unknown, record: LayoutVersion) => (
                <Space size="small">
                  <Button
                    size="small"
                    onClick={() => {
                      loadVersion(record);
                      setShowVersionsModal(false);
                      message.success(
                        `Đã load version: ${record.version_name}`,
                      );
                    }}
                  >
                    Load
                  </Button>
                  {record.status === "DRAFT" && (
                    <Popconfirm
                      title="Publish version này?"
                      description="Sẽ cập nhật bảng Seats theo layout này"
                      onConfirm={() => handlePublish(record.id)}
                      okText="Publish"
                      cancelText="Hủy"
                    >
                      <Button
                        size="small"
                        type="primary"
                        icon={<CloudUploadOutlined />}
                      >
                        Publish
                      </Button>
                    </Popconfirm>
                  )}
                  {!record.is_active && (
                    <Popconfirm
                      title="Xóa version này?"
                      onConfirm={() => handleDeleteVersion(record.id)}
                      okText="Xóa"
                      cancelText="Hủy"
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
        {versions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Chưa có version nào. Tạo layout và lưu draft để bắt đầu.
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}
