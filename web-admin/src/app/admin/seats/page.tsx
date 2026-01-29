"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin";
import {
  Table,
  Button,
  Select,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Card,
  Statistic,
  Row,
  Col,
} from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  LayoutOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

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

export default function SeatsPage() {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState<Seat | null>(null);
  const [form] = Form.useForm();

  // Filters
  const [eventFilter, setEventFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined,
  );
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);

  const fetchSeats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventFilter) params.set("eventId", eventFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("seatType", typeFilter);

      const res = await fetch(`/api/admin/seats?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setSeats(data.data.seats);
        setEvents(data.data.events);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch seats:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeats();
  }, [eventFilter, statusFilter, typeFilter]);

  const handleBulkUpdate = async (status: string) => {
    if (selectedRowKeys.length === 0) return;
    try {
      const res = await fetch("/api/admin/seats", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatIds: selectedRowKeys, status }),
      });
      if (res.ok) {
        message.success(`Đã cập nhật ${selectedRowKeys.length} ghế`);
        setSelectedRowKeys([]);
        fetchSeats();
      }
    } catch (error) {
      message.error("Lỗi khi cập nhật ghế");
    }
  };

  const handleDelete = async (seatIds: string[]) => {
    try {
      const res = await fetch("/api/admin/seats", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatIds }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(`Đã xóa ${seatIds.length} ghế`);
        setSelectedRowKeys([]);
        fetchSeats();
      } else {
        message.error(data.error || "Lỗi khi xóa ghế");
      }
    } catch (error) {
      message.error("Lỗi khi xóa ghế");
    }
  };

  const handleCreateOrUpdate = async (values: any) => {
    try {
      if (editingSeat) {
        // Update single seat
        const res = await fetch(`/api/admin/seats/${editingSeat.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        });
        if (res.ok) {
          message.success("Đã cập nhật ghế");
          setIsModalOpen(false);
          setEditingSeat(null);
          form.resetFields();
          fetchSeats();
        }
      } else {
        // Create new seats
        const res = await fetch("/api/admin/seats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_id: values.event_id,
            seats: [
              {
                row: values.row,
                col: values.col,
                seat_type: values.seat_type,
                price: values.price,
              },
            ],
          }),
        });
        if (res.ok) {
          message.success("Đã tạo ghế mới");
          setIsModalOpen(false);
          form.resetFields();
          fetchSeats();
        }
      }
    } catch (error) {
      message.error("Lỗi khi lưu ghế");
    }
  };

  const openEditModal = (seat: Seat) => {
    setEditingSeat(seat);
    form.setFieldsValue({
      event_id: seat.event_id,
      row: seat.row,
      col: seat.col,
      seat_type: seat.seat_type,
      price: seat.price,
      status: seat.status,
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingSeat(null);
    form.resetFields();
    if (events.length > 0) {
      form.setFieldsValue({
        event_id: events[0].id,
        seat_type: "STANDARD",
        price: 1500000,
      });
    }
    setIsModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "green";
      case "RESERVED":
        return "orange";
      case "SOLD":
        return "red";
      case "LOCKED":
        return "default";
      default:
        return "default";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "VIP":
        return "purple";
      case "STANDARD":
        return "blue";
      case "ECONOMY":
        return "default";
      default:
        return "default";
    }
  };

  const formatVND = (price: number) => `${price.toLocaleString("vi-VN")} ₫`;

  const columns: ColumnsType<Seat> = [
    {
      title: "ID",
      dataIndex: "id",
      key: "id",
      width: 100,
      render: (id: string) => (
        <span className="font-mono text-xs text-gray-500">
          {id.slice(0, 8)}...
        </span>
      ),
    },
    {
      title: "Ghế",
      dataIndex: "seat_number",
      key: "seat_number",
      render: (text, record) => (
        <span>
          <strong>{text}</strong>{" "}
          <span style={{ color: "#888" }}>Hàng {record.row}</span>
        </span>
      ),
    },
    {
      title: "Section",
      dataIndex: "section",
      key: "section",
      render: (section: string) => <Tag color="blue">{section}</Tag>,
    },
    { title: "Sự kiện", dataIndex: "event_name", key: "event_name" },
    {
      title: "Loại",
      dataIndex: "seat_type",
      key: "seat_type",
      render: (type) => <Tag color={getTypeColor(type)}>{type}</Tag>,
    },
    {
      title: "Giá",
      dataIndex: "price",
      key: "price",
      render: (price) => formatVND(price),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status) => <Tag color={getStatusColor(status)}>{status}</Tag>,
    },
    {
      title: "Hành động",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            onClick={() => openEditModal(record)}
          />
          <Popconfirm
            title="Xóa ghế này?"
            onConfirm={() => handleDelete([record.id])}
            okText="Xóa"
            cancelText="Hủy"
            disabled={record.status === "SOLD"}
          >
            <Button
              icon={<DeleteOutlined />}
              size="small"
              danger
              disabled={record.status === "SOLD"}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý ghế</h1>
            <p className="text-gray-600 mt-1">
              Quản lý ghế cho tất cả sự kiện • Data đồng bộ với{" "}
              <Link
                href="/admin/layout-editor"
                className="text-blue-600 hover:underline"
              >
                Layout
              </Link>
            </p>
          </div>
          <Space>
            <Link href="/admin/layout-editor">
              <Button icon={<LayoutOutlined />}>Xem Layout</Button>
            </Link>
            <Button icon={<ReloadOutlined />} onClick={fetchSeats}>
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openCreateModal}
              style={{ backgroundColor: "#e62b1e" }}
            >
              Thêm ghế
            </Button>
          </Space>
        </div>

        {/* Stats Cards */}
        {stats && (
          <Row gutter={16}>
            <Col span={4}>
              <Card>
                <Statistic title="Tổng" value={stats.total} />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic
                  title="Có sẵn"
                  value={stats.available}
                  styles={{ content: { color: "#52c41a" } }}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic
                  title="Đã đặt"
                  value={stats.reserved}
                  styles={{ content: { color: "#faad14" } }}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic
                  title="Đã bán"
                  value={stats.sold}
                  styles={{ content: { color: "#f5222d" } }}
                />
              </Card>
            </Col>
            <Col span={5}>
              <Card>
                <Statistic
                  title="Đã khóa"
                  value={stats.locked}
                  styles={{ content: { color: "#8c8c8c" } }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* Filters */}
        <Card>
          <Space wrap>
            <Select
              placeholder="Tất cả sự kiện"
              allowClear
              style={{ width: 200 }}
              value={eventFilter}
              onChange={(v) => setEventFilter(v)}
              options={events.map((e) => ({ label: e.name, value: e.id }))}
            />
            <Select
              placeholder="Tất cả trạng thái"
              allowClear
              style={{ width: 150 }}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
              options={[
                { label: "Available", value: "AVAILABLE" },
                { label: "Reserved", value: "RESERVED" },
                { label: "Sold", value: "SOLD" },
                { label: "Locked", value: "LOCKED" },
              ]}
            />
            <Select
              placeholder="Tất cả loại"
              allowClear
              style={{ width: 150 }}
              value={typeFilter}
              onChange={(v) => setTypeFilter(v)}
              options={[
                { label: "VIP", value: "VIP" },
                { label: "Standard", value: "STANDARD" },
                { label: "Economy", value: "ECONOMY" },
              ]}
            />
          </Space>
        </Card>

        {/* Bulk Actions */}
        {selectedRowKeys.length > 0 && (
          <Card style={{ backgroundColor: "#e62b1e" }}>
            <Space>
              <span style={{ color: "white" }}>
                {selectedRowKeys.length} ghế được chọn
              </span>
              <Button
                type="primary"
                style={{ backgroundColor: "#52c41a" }}
                onClick={() => handleBulkUpdate("AVAILABLE")}
              >
                Mở
              </Button>
              <Button onClick={() => handleBulkUpdate("LOCKED")}>Khóa</Button>
              <Popconfirm
                title={`Xóa ${selectedRowKeys.length} ghế?`}
                onConfirm={() => handleDelete(selectedRowKeys as string[])}
                okText="Xóa"
                cancelText="Hủy"
              >
                <Button danger>Xóa</Button>
              </Popconfirm>
              <Button onClick={() => setSelectedRowKeys([])}>Bỏ chọn</Button>
            </Space>
          </Card>
        )}

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={seats}
            rowKey="id"
            loading={loading}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} ghế`,
            }}
          />
        </Card>

        {/* Create/Edit Modal */}
        <Modal
          title={editingSeat ? "Sửa ghế" : "Thêm ghế mới"}
          open={isModalOpen}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingSeat(null);
            form.resetFields();
          }}
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleCreateOrUpdate}>
            <Form.Item
              name="event_id"
              label="Sự kiện"
              rules={[{ required: true, message: "Chọn sự kiện" }]}
            >
              <Select
                options={events.map((e) => ({ label: e.name, value: e.id }))}
                disabled={!!editingSeat}
              />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="row"
                  label="Hàng"
                  rules={[{ required: true, message: "Nhập hàng" }]}
                >
                  <Input placeholder="A, B, C..." disabled={!!editingSeat} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="col"
                  label="Cột"
                  rules={[{ required: true, message: "Nhập cột" }]}
                >
                  <InputNumber
                    min={1}
                    style={{ width: "100%" }}
                    disabled={!!editingSeat}
                  />
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
                  { label: "VIP", value: "VIP" },
                  { label: "Standard", value: "STANDARD" },
                  { label: "Economy", value: "ECONOMY" },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="price"
              label="Giá (VND)"
              rules={[{ required: true, message: "Nhập giá" }]}
            >
              <InputNumber
                min={0}
                step={100000}
                style={{ width: "100%" }}
                addonAfter="₫"
              />
            </Form.Item>
            {editingSeat && (
              <Form.Item name="status" label="Trạng thái">
                <Select
                  options={[
                    { label: "Available", value: "AVAILABLE" },
                    { label: "Reserved", value: "RESERVED" },
                    { label: "Locked", value: "LOCKED" },
                  ]}
                  disabled={editingSeat?.status === "SOLD"}
                />
              </Form.Item>
            )}
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  style={{ backgroundColor: "#e62b1e" }}
                >
                  {editingSeat ? "Lưu" : "Tạo"}
                </Button>
                <Button
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingSeat(null);
                    form.resetFields();
                  }}
                >
                  Hủy
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
