"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin";
import {
  Select,
  Button,
  Card,
  Tooltip,
  Modal,
  Form,
  InputNumber,
  Input,
  message,
  Space,
  Row,
  Col,
  Statistic,
  Popconfirm,
  Divider,
} from "antd";
import {
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  CopyOutlined,
  AppstoreOutlined,
} from "@ant-design/icons";

interface Seat {
  id: string;
  event_id: string;
  event_name: string;
  seat_number: string;
  row: string;
  col: number;
  section: string;
  seat_type: "VIP" | "STANDARD" | "ECONOMY";
  price: number;
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "LOCKED";
  ticket_type_id?: string | null;
}

interface Event {
  id: string;
  name: string;
}

interface Stats {
  total: number;
  available: number;
  reserved: number;
  sold: number;
  locked: number;
}

interface TicketType {
  id: string;
  event_id: string;
  name: string;
  description: string | null;
  price: number;
  color: string;
  icon: string;
}

interface SectionConfig {
  name: string;
  rows: number;
  cols: number;
  seat_type: "VIP" | "STANDARD" | "ECONOMY";
  price: number;
}

export default function SeatLayoutPage() {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(
    undefined,
  );
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [isEditSectionModalOpen, setIsEditSectionModalOpen] = useState(false);
  const [isAssignTicketModalOpen, setIsAssignTicketModalOpen] = useState(false);
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [addSectionForm] = Form.useForm();
  const [editSectionForm] = Form.useForm();

  const fetchSeats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedEvent) params.set("eventId", selectedEvent);
      const res = await fetch(`/api/admin/seats?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSeats(data.data.seats);
        setEvents(data.data.events);
        setStats(data.data.stats);
        if (!selectedEvent && data.data.events.length > 0) {
          setSelectedEvent(data.data.events[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch seats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketTypes = async () => {
    if (!selectedEvent) return;
    try {
      const res = await fetch(
        `/api/admin/ticket-types?eventId=${selectedEvent}`,
      );
      const data = await res.json();
      if (data.success) {
        setTicketTypes(data.data.ticketTypes);
      }
    } catch (error) {
      console.error("Failed to fetch ticket types:", error);
    }
  };

  useEffect(() => {
    fetchSeats();
  }, [selectedEvent]);

  useEffect(() => {
    fetchTicketTypes();
  }, [selectedEvent]);

  // Group seats by section
  const seatsBySection = seats.reduce(
    (acc, seat) => {
      const section = seat.section || "MAIN";
      if (!acc[section]) acc[section] = [];
      acc[section].push(seat);
      return acc;
    },
    {} as Record<string, Seat[]>,
  );

  const sections = Object.keys(seatsBySection).sort();

  // Get section stats
  const getSectionStats = (sectionName: string) => {
    const sectionSeats = seatsBySection[sectionName] || [];
    const rows = [...new Set(sectionSeats.map((s) => s.row))].sort();
    const cols = Math.max(...sectionSeats.map((s) => s.col), 0);
    const sold = sectionSeats.filter((s) => s.status === "SOLD").length;
    const total = sectionSeats.length;
    return {
      rows: rows.length,
      cols,
      sold,
      total,
      soldPercent: total > 0 ? Math.round((sold / total) * 100) : 0,
    };
  };

  // Get seat background color
  const getSeatBgColor = (seat: Seat) => {
    if (selectedSeats.includes(seat.id)) return "#dc2626"; // Selected
    if (seat.status === "SOLD") return "#374151"; // Sold
    if (seat.status === "LOCKED") return "#6b7280"; // Locked
    if (seat.status === "RESERVED") return "#f59e0b"; // Reserved
    if (seat.seat_type === "VIP") return "#f59e0b"; // VIP - orange/gold
    if (seat.seat_type === "ECONOMY") return "#06b6d4"; // Economy
    return "#10b981"; // Standard
  };

  // Add new section
  const handleAddSection = async (values: SectionConfig) => {
    if (!selectedEvent) {
      message.error("Vui lòng chọn sự kiện");
      return;
    }
    if (seatsBySection[values.name]) {
      message.error(`Section "${values.name}" đã tồn tại`);
      return;
    }
    const newSeats = [];
    const rowLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let r = 0; r < values.rows; r++) {
      for (let c = 1; c <= values.cols; c++) {
        newSeats.push({
          row: rowLabels[r] || `R${r + 1}`,
          col: c,
          section: values.name,
          seat_type: values.seat_type,
          price: values.price,
        });
      }
    }
    try {
      const res = await fetch("/api/admin/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: selectedEvent, seats: newSeats }),
      });
      if (res.ok) {
        message.success(
          `Đã tạo section "${values.name}" với ${values.rows}x${values.cols} = ${newSeats.length} ghế`,
        );
        setIsAddSectionModalOpen(false);
        addSectionForm.resetFields();
        fetchSeats();
      }
    } catch (error) {
      message.error("Lỗi khi tạo section");
    }
  };

  // Delete entire section
  const handleDeleteSection = async (sectionName: string) => {
    const sectionSeats = seatsBySection[sectionName];
    if (!sectionSeats) return;
    const hasSold = sectionSeats.some((s) => s.status === "SOLD");
    if (hasSold) {
      message.error("Không thể xóa section có ghế đã bán");
      return;
    }
    try {
      const res = await fetch("/api/admin/seats", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatIds: sectionSeats.map((s) => s.id) }),
      });
      if (res.ok) {
        message.success(`Đã xóa section "${sectionName}"`);
        if (selectedSection === sectionName) setSelectedSection(null);
        fetchSeats();
      }
    } catch (error) {
      message.error("Lỗi khi xóa section");
    }
  };

  // Clone section
  const handleCloneSection = async (sectionName: string) => {
    const sectionSeats = seatsBySection[sectionName];
    if (!sectionSeats || !selectedEvent) return;
    const newName = `${sectionName} (Copy)`;
    let counter = 1;
    let finalName = newName;
    while (seatsBySection[finalName]) {
      finalName = `${sectionName} (Copy ${counter++})`;
    }
    const newSeats = sectionSeats.map((s) => ({
      row: s.row,
      col: s.col,
      section: finalName,
      seat_type: s.seat_type,
      price: s.price,
    }));
    try {
      const res = await fetch("/api/admin/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: selectedEvent, seats: newSeats }),
      });
      if (res.ok) {
        message.success(`Đã clone section thành "${finalName}"`);
        fetchSeats();
      }
    } catch (error) {
      message.error("Lỗi khi clone section");
    }
  };

  // Toggle seat selection
  const handleSeatSelect = (seat: Seat) => {
    setSelectedSeats((prev) =>
      prev.includes(seat.id)
        ? prev.filter((id) => id !== seat.id)
        : [...prev, seat.id],
    );
  };

  // Edit section (change type/price for all seats)
  const handleEditSection = async (values: {
    seat_type: string;
    price: number;
  }) => {
    if (!selectedSection || !seatsBySection[selectedSection]) return;
    const sectionSeats = seatsBySection[selectedSection];
    try {
      for (const seat of sectionSeats) {
        await fetch(`/api/admin/seats/${seat.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            seat_type: values.seat_type,
            price: values.price,
          }),
        });
      }
      message.success(`Đã cập nhật section "${selectedSection}"`);
      setIsEditSectionModalOpen(false);
      fetchSeats();
    } catch (error) {
      message.error("Lỗi khi cập nhật section");
    }
  };

  const openEditSectionModal = (sectionName: string) => {
    const sectionSeats = seatsBySection[sectionName];
    if (sectionSeats && sectionSeats.length > 0) {
      editSectionForm.setFieldsValue({
        seat_type: sectionSeats[0].seat_type,
        price: sectionSeats[0].price,
      });
      setSelectedSection(sectionName);
      setIsEditSectionModalOpen(true);
    }
  };

  // Bulk update selected seats
  const handleBulkUpdate = async (status: string) => {
    if (selectedSeats.length === 0) return;
    try {
      const res = await fetch("/api/admin/seats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatIds: selectedSeats, status }),
      });
      if (res.ok) {
        message.success(`Đã cập nhật ${selectedSeats.length} ghế`);
        setSelectedSeats([]);
        fetchSeats();
      }
    } catch (error) {
      message.error("Lỗi khi cập nhật ghế");
    }
  };

  const formatVND = (price: number) => `${price.toLocaleString("vi-VN")} ₫`;

  // Render section seats as grid
  const renderSectionSeats = (sectionName: string) => {
    const sectionSeats = seatsBySection[sectionName] || [];
    const rows = [...new Set(sectionSeats.map((s) => s.row))].sort();
    return rows.map((row) => {
      const rowSeats = sectionSeats
        .filter((s) => s.row === row)
        .sort((a, b) => a.col - b.col);
      return (
        <div key={row} className="flex gap-1 mb-1">
          {rowSeats.map((seat) => (
            <Tooltip
              key={seat.id}
              title={
                <div>
                  <strong>{seat.seat_number}</strong>
                  <div>Loại: {seat.seat_type}</div>
                  <div>Giá: {formatVND(seat.price)}</div>
                  <div>Trạng thái: {seat.status}</div>
                </div>
              }
            >
              <div
                onClick={() => handleSeatSelect(seat)}
                className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold cursor-pointer transition-all hover:scale-110"
                style={{ backgroundColor: getSeatBgColor(seat) }}
              >
                {seat.status === "SOLD" ? "✕" : ""}
              </div>
            </Tooltip>
          ))}
        </div>
      );
    });
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Layout Configurator
            </h1>
            <p className="text-gray-600 mt-1">
              Quản lý ghế theo Section - Click ghế để chọn
            </p>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchSeats}>
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<AppstoreOutlined />}
              onClick={() => setIsAddSectionModalOpen(true)}
              style={{ backgroundColor: "#e62b1e" }}
            >
              Add Section
            </Button>
          </Space>
        </div>

        {/* Event Selector & Stats */}
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <div className="mb-2 font-medium">Chọn sự kiện</div>
              <Select
                style={{ width: "100%" }}
                value={selectedEvent}
                onChange={setSelectedEvent}
                options={events.map((e) => ({ label: e.name, value: e.id }))}
                placeholder="Chọn sự kiện"
              />
            </Card>
          </Col>
          {stats && (
            <>
              <Col span={3}>
                <Card>
                  <Statistic title="Tổng" value={stats.total} />
                </Card>
              </Col>
              <Col span={3}>
                <Card>
                  <Statistic
                    title="Có sẵn"
                    value={stats.available}
                    styles={{ content: { color: "#52c41a" } }}
                  />
                </Card>
              </Col>
              <Col span={3}>
                <Card>
                  <Statistic
                    title="Đã đặt"
                    value={stats.reserved}
                    styles={{ content: { color: "#faad14" } }}
                  />
                </Card>
              </Col>
              <Col span={3}>
                <Card>
                  <Statistic
                    title="Đã bán"
                    value={stats.sold}
                    styles={{ content: { color: "#f5222d" } }}
                  />
                </Card>
              </Col>
              <Col span={3}>
                <Card>
                  <Statistic
                    title="Khóa"
                    value={stats.locked}
                    styles={{ content: { color: "#434343" } }}
                  />
                </Card>
              </Col>
            </>
          )}
        </Row>

        {/* Main Layout Area */}
        <Row gutter={16}>
          {/* Left: Sections Canvas */}
          <Col span={18}>
            <Card
              className="bg-[#1a1a2e]"
              style={{ backgroundColor: "#1a1a2e", minHeight: 500 }}
            >
              {/* Legend */}
              <div className="mb-4 flex justify-between items-center">
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: "#f59e0b" }}
                    />
                    <span className="text-white">VIP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: "#10b981" }}
                    />
                    <span className="text-white">Standard</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: "#06b6d4" }}
                    />
                    <span className="text-white">Economy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: "#dc2626" }}
                    />
                    <span className="text-white">Đang chọn</span>
                  </div>
                </div>
              </div>

              {/* Stage */}
              <div className="flex justify-center mb-8">
                <div className="bg-gradient-to-r from-[#2a1a1a] to-[#3a2020] text-gray-300 px-24 py-4 rounded-lg font-bold text-lg border border-[#4a3030]">
                  STAGE AREA
                </div>
              </div>

              {loading ? (
                <div className="text-center py-20 text-gray-500">
                  Đang tải...
                </div>
              ) : sections.length === 0 ? (
                <div className="text-center py-20 text-gray-500">
                  Chưa có section nào. Hãy thêm section mới.
                </div>
              ) : (
                <div className="flex flex-wrap gap-6 justify-center">
                  {sections.map((sectionName) => {
                    const sectionStats = getSectionStats(sectionName);
                    const sectionSeats = seatsBySection[sectionName] || [];
                    const seatType = sectionSeats[0]?.seat_type || "STANDARD";
                    const isSelected = selectedSection === sectionName;

                    return (
                      <div
                        key={sectionName}
                        className={`bg-[#2a2a4e] rounded-lg p-4 cursor-pointer transition-all ${isSelected ? "ring-2 ring-[#e62b1e]" : "hover:bg-[#3a3a5e]"}`}
                        onClick={() => setSelectedSection(sectionName)}
                      >
                        {/* Section header */}
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-white font-bold">
                            {sectionName}
                          </span>
                          <span
                            className="text-xs px-2 py-1 rounded"
                            style={{
                              backgroundColor:
                                sectionStats.soldPercent > 0
                                  ? "#dc2626"
                                  : "#374151",
                              color: "white",
                            }}
                          >
                            {sectionStats.soldPercent}% SOLD
                          </span>
                        </div>
                        {/* Section grid */}
                        <div>{renderSectionSeats(sectionName)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </Col>

          {/* Right: Properties Panel */}
          <Col span={6}>
            <Card title="PROPERTIES" style={{ minHeight: 500 }}>
              {selectedSection ? (
                <div className="space-y-4">
                  <div>
                    <div className="text-gray-500 text-sm mb-1">
                      SECTION NAME
                    </div>
                    <div className="bg-[#2a1a3e] text-white p-3 rounded">
                      {selectedSection}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 text-sm mb-1">
                      ROW CONFIGURATION
                    </div>
                    <Row gutter={8}>
                      <Col span={12}>
                        <div className="bg-[#2a1a3e] text-white p-3 rounded text-center">
                          <div className="text-xs text-gray-400">Rows</div>
                          <div className="text-2xl font-bold">
                            {getSectionStats(selectedSection).rows}
                          </div>
                        </div>
                      </Col>
                      <Col span={12}>
                        <div className="bg-[#2a1a3e] text-white p-3 rounded text-center">
                          <div className="text-xs text-gray-400">Cols</div>
                          <div className="text-2xl font-bold">
                            {getSectionStats(selectedSection).cols}
                          </div>
                        </div>
                      </Col>
                    </Row>
                  </div>
                  <div>
                    <div className="text-gray-500 text-sm mb-1">
                      SEAT TYPE & PRICE
                    </div>
                    <div className="bg-[#2a1a3e] text-white p-3 rounded">
                      {seatsBySection[selectedSection]?.[0]?.seat_type || "N/A"}{" "}
                      -{" "}
                      {formatVND(
                        seatsBySection[selectedSection]?.[0]?.price || 0,
                      )}
                    </div>
                  </div>
                  <Divider />
                  <Button
                    block
                    icon={<CopyOutlined />}
                    onClick={() => handleCloneSection(selectedSection)}
                    style={{
                      backgroundColor: "#e62b1e",
                      borderColor: "#e62b1e",
                      color: "white",
                    }}
                  >
                    Clone Section
                  </Button>
                  <Button
                    block
                    icon={<EditOutlined />}
                    onClick={() => openEditSectionModal(selectedSection)}
                  >
                    Edit Section
                  </Button>
                  <Popconfirm
                    title={`Xóa section "${selectedSection}"?`}
                    onConfirm={() => handleDeleteSection(selectedSection)}
                    okText="Xóa"
                    cancelText="Hủy"
                  >
                    <Button block danger icon={<DeleteOutlined />}>
                      Delete Section
                    </Button>
                  </Popconfirm>
                </div>
              ) : (
                <div className="text-center text-gray-400 py-10">
                  Click vào một section để xem thông tin
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* Selected Seats Actions */}
        {selectedSeats.length > 0 && (
          <Card style={{ backgroundColor: "#2a1a3e" }}>
            <div className="flex items-center gap-4">
              <span className="text-white font-bold">
                SELECTED SEATS ({selectedSeats.length})
              </span>
              <Button
                size="small"
                onClick={() => handleBulkUpdate("AVAILABLE")}
                style={{
                  backgroundColor: "#10b981",
                  borderColor: "#10b981",
                  color: "white",
                }}
              >
                Available
              </Button>
              <Button
                size="small"
                onClick={() => handleBulkUpdate("LOCKED")}
                style={{
                  backgroundColor: "#f59e0b",
                  borderColor: "#f59e0b",
                  color: "white",
                }}
              >
                Locked
              </Button>
              <Button
                size="small"
                onClick={() => handleBulkUpdate("RESERVED")}
                style={{
                  backgroundColor: "#dc2626",
                  borderColor: "#dc2626",
                  color: "white",
                }}
              >
                Reserved
              </Button>
              <Button size="small" onClick={() => setSelectedSeats([])}>
                ✕
              </Button>
            </div>
          </Card>
        )}

        {/* Footer Stats */}
        {stats && (
          <div className="flex gap-4 text-sm text-gray-500">
            <span>● TOTAL CAPACITY: {stats.total}</span>
            <span>● SEATS SOLD: {stats.sold}</span>
            <span>● MAINTENANCE: {stats.locked}</span>
          </div>
        )}

        {/* Add Section Modal */}
        <Modal
          title="Add Section"
          open={isAddSectionModalOpen}
          onCancel={() => setIsAddSectionModalOpen(false)}
          footer={null}
          width={500}
        >
          <Form
            form={addSectionForm}
            layout="vertical"
            onFinish={handleAddSection}
            initialValues={{
              rows: 3,
              cols: 4,
              seat_type: "STANDARD",
              price: 1500000,
            }}
          >
            <Form.Item
              name="name"
              label="Section Name"
              rules={[{ required: true, message: "Vui lòng nhập tên section" }]}
            >
              <Input placeholder="VD: Section A, VIP Zone, ..." />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="rows"
                  label="Số hàng (Rows)"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={1} max={26} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="cols"
                  label="Số cột (Cols)"
                  rules={[{ required: true }]}
                >
                  <InputNumber min={1} max={50} style={{ width: "100%" }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item
              name="seat_type"
              label="Loại ghế"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { label: "🌟 VIP ($150)", value: "VIP" },
                  { label: "🎫 Standard ($95)", value: "STANDARD" },
                  { label: "💺 Economy ($45)", value: "ECONOMY" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="price"
              label="Giá (VND)"
              rules={[{ required: true }]}
            >
              <InputNumber
                min={0}
                step={100000}
                style={{ width: "100%" }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(v) => v?.replace(/,/g, "") as unknown as number}
                addonAfter="₫"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  style={{ backgroundColor: "#e62b1e" }}
                >
                  Create Section
                </Button>
                <Button onClick={() => setIsAddSectionModalOpen(false)}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* Edit Section Modal */}
        <Modal
          title={`Edit Section: ${selectedSection}`}
          open={isEditSectionModalOpen}
          onCancel={() => setIsEditSectionModalOpen(false)}
          footer={null}
        >
          <Form
            form={editSectionForm}
            layout="vertical"
            onFinish={handleEditSection}
          >
            <Form.Item
              name="seat_type"
              label="Loại ghế"
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { label: "🌟 VIP", value: "VIP" },
                  { label: "🎫 Standard", value: "STANDARD" },
                  { label: "💺 Economy", value: "ECONOMY" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="price"
              label="Giá (VND)"
              rules={[{ required: true }]}
            >
              <InputNumber
                min={0}
                step={100000}
                style={{ width: "100%" }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                parser={(v) => v?.replace(/,/g, "") as unknown as number}
                addonAfter="₫"
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  style={{ backgroundColor: "#e62b1e" }}
                >
                  Save
                </Button>
                <Button onClick={() => setIsEditSectionModalOpen(false)}>
                  Cancel
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
