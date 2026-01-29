"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "antd";
import {
  SaveOutlined,
  ClearOutlined,
  CheckSquareOutlined,
} from "@ant-design/icons";

// Types
type SeatType = "VIP" | "STANDARD" | "ECONOMY" | "DISABLED";

interface Seat {
  id: string; // "A-1", "A-2", etc.
  row: string;
  col: number;
  side: "left" | "right";
  type: SeatType;
}

interface LayoutConfig {
  rows: number;
  leftSeats: number;
  rightSeats: number;
  aisleWidth: number; // Visual spacing in pixels
}

interface EventOption {
  id: string;
  name: string;
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

// Generate sample 100 seats layout
const generateSampleLayout = (): { config: LayoutConfig; seats: Seat[] } => {
  const config: LayoutConfig = {
    rows: 10,
    leftSeats: 5,
    rightSeats: 5,
    aisleWidth: 60,
  };

  const seats: Seat[] = [];
  for (let r = 0; r < config.rows; r++) {
    const rowLabel = ROW_LABELS[r];
    // Left side
    for (let c = 1; c <= config.leftSeats; c++) {
      seats.push({
        id: `${rowLabel}-L${c}`,
        row: rowLabel,
        col: c,
        side: "left",
        type: r < 2 ? "VIP" : "STANDARD", // First 2 rows are VIP
      });
    }
    // Right side
    for (let c = 1; c <= config.rightSeats; c++) {
      seats.push({
        id: `${rowLabel}-R${c}`,
        row: rowLabel,
        col: c,
        side: "right",
        type: r < 2 ? "VIP" : "STANDARD",
      });
    }
  }

  return { config, seats };
};

export default function LayoutEditorPage() {
  // Load sample data on init
  const sample = generateSampleLayout();

  // Layout config state
  const [config, setConfig] = useState<LayoutConfig>(sample.config);
  const [seats, setSeats] = useState<Seat[]>(sample.seats);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Selection state
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [isMultiSelect, setIsMultiSelect] = useState(false);
  const [currentType, setCurrentType] = useState<SeatType>("STANDARD");

  // View mode
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");

  // Fetch events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/layouts");
      const data = await res.json();
      if (data.success) {
        setEvents(data.data.events);
        if (!selectedEvent && data.data.events.length > 0) {
          setSelectedEvent(data.data.events[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch events:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Regenerate seats when config changes
  const regenerateSeats = useCallback(() => {
    const newSeats: Seat[] = [];
    for (let r = 0; r < config.rows; r++) {
      const rowLabel = ROW_LABELS[r] || `R${r + 1}`;
      // Left side
      for (let c = 1; c <= config.leftSeats; c++) {
        newSeats.push({
          id: `${rowLabel}-L${c}`,
          row: rowLabel,
          col: c,
          side: "left",
          type: "STANDARD",
        });
      }
      // Right side
      for (let c = 1; c <= config.rightSeats; c++) {
        newSeats.push({
          id: `${rowLabel}-R${c}`,
          row: rowLabel,
          col: c,
          side: "right",
          type: "STANDARD",
        });
      }
    }
    setSeats(newSeats);
    setSelectedSeats(new Set());
    setHasChanges(true);
  }, [config]);

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
              Cấu hình số ghế trái/phải và thiết lập hạng vé cho từng ghế
            </p>
          </div>
          <Space>
            <Segmented
              value={viewMode}
              onChange={(v) => setViewMode(v as "edit" | "preview")}
              options={[
                { label: "Chỉnh sửa", value: "edit" },
                { label: "Xem trước", value: "preview" },
              ]}
            />
            {hasChanges && (
              <Button type="primary" icon={<SaveOutlined />}>
                Lưu Layout
              </Button>
            )}
          </Space>
        </div>

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
        {viewMode === "edit" && (
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
                  <Button
                    icon={<CheckSquareOutlined />}
                    onClick={selectAllSeats}
                  >
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
        )}

        {/* Seat Layout */}
        <Card
          title={
            viewMode === "edit"
              ? "Sơ đồ ghế (Click để thay đổi loại)"
              : "Xem trước"
          }
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
    </AdminLayout>
  );
}
