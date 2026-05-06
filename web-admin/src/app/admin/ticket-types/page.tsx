"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin";
import {
  Table,
  Button,
  Card,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Popconfirm,
  message,
  ColorPicker,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  MinusCircleOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

interface TicketType {
  id: string;
  event_id: string;
  event_name: string;
  name: string;
  description: string | null;
  subtitle: string | null;
  benefits: string[] | null;
  price: number;
  level: number; // 1 = cheapest, 2 = mid, 3 = expensive
  color: string;
  icon: string;
  max_quantity: number | null;
  sold_quantity: number;
  is_active: boolean;
  sort_order: number;
}

interface Event {
  id: string;
  name: string;
}

export default function TicketTypesPage() {
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(
    undefined,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [initialFormValues, setInitialFormValues] = useState<any>({
    color: "#10b981",
    icon: "🎫",
    sort_order: 0,
    is_active: true,
  });

  const fetchData = async (eventId?: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (eventId) params.set("eventId", eventId);
      const res = await fetch(`/api/admin/ticket-types?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTicketTypes(data.data.ticketTypes);
        setEvents(data.data.events);
        // Auto-select PUBLISHED event first, otherwise first event
        if (!eventId && data.data.events.length > 0) {
          const publishedEvent = data.data.events.find(
            (e: Event) => e.status === "PUBLISHED",
          );
          const defaultEventId = publishedEvent?.id || data.data.events[0].id;
          setSelectedEvent(defaultEventId);
          // Fetch again with the selected event
          const res2 = await fetch(
            `/api/admin/ticket-types?eventId=${defaultEventId}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );
          const data2 = await res2.json();
          if (data2.success) {
            setTicketTypes(data2.data.ticketTypes);
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(selectedEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatVND = (price: number) =>
    `${Math.round(price).toLocaleString("vi-VN")} ₫`;

  const handleSubmit = async (values: any) => {
    try {
      const token = localStorage.getItem("token");

      // Convert benefits from text to array
      const benefitsArray = values.benefits
        ? values.benefits.split("\n").filter((b: string) => b.trim())
        : [];

      const payload = {
        ...values,
        price: Number(values.price) || 0,
        max_quantity: values.max_quantity ? Number(values.max_quantity) : null,
        sort_order: Number(values.sort_order) || 0,
        benefits: benefitsArray,
        event_id: selectedEvent,
      };

      if (editingId) {
        await fetch(`/api/admin/ticket-types/${editingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        message.success("Cập nhật thành công");
      } else {
        await fetch("/api/admin/ticket-types", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        message.success("Tạo mới thành công");
      }
      setIsModalOpen(false);
      setEditingId(null);
      setInitialFormValues({
        color: "#10b981",
        icon: "🎫",
        sort_order: 0,
        is_active: true,
      });
      fetchData();
    } catch (error) {
      message.error("Có lỗi xảy ra");
    }
  };

  const handleEdit = (record: TicketType) => {
    let benefitsText = "";
    if (record.benefits) {
      const benefitsArray =
        typeof record.benefits === "string"
          ? JSON.parse(record.benefits)
          : record.benefits;
      benefitsText = Array.isArray(benefitsArray)
        ? benefitsArray.join("\n")
        : "";
    }
    setInitialFormValues({ ...record, benefits: benefitsText });
    setEditingId(record.id);
    setFormKey((prev) => prev + 1);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/ticket-types/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        message.success("Đã xóa");
        fetchData();
      } else {
        message.error(data.error);
      }
    } catch (error) {
      message.error("Có lỗi xảy ra");
    }
  };

  const columns: ColumnsType<TicketType> = [
    {
      title: "Loại vé",
      key: "name",
      width: 300,
      render: (_, record) => (
        <Space align="start">
          <span style={{ fontSize: 24 }}>{record.icon}</span>
          <div>
            <div className="font-bold text-base">{record.name}</div>
            {record.subtitle && (
              <div className="text-gray-600 text-sm">{record.subtitle}</div>
            )}
            {record.benefits &&
              (() => {
                const benefits =
                  typeof record.benefits === "string"
                    ? JSON.parse(record.benefits)
                    : record.benefits;
                return (
                  benefits.length > 0 && (
                    <div className="mt-1">
                      {benefits.slice(0, 2).map((b: string, i: number) => (
                        <Tag key={i} color="blue" className="text-xs mb-1">
                          {b}
                        </Tag>
                      ))}
                      {benefits.length > 2 && (
                        <Tag color="default">+{benefits.length - 2}</Tag>
                      )}
                    </div>
                  )
                );
              })()}
          </div>
        </Space>
      ),
    },
    {
      title: "Giá",
      dataIndex: "price",
      key: "price",
      render: (price) => (
        <span className="font-semibold">{formatVND(price)}</span>
      ),
    },
    {
      title: "Màu",
      dataIndex: "color",
      key: "color",
      render: (color) => (
        <div
          className="w-8 h-8 rounded-full border-2 border-gray-200"
          style={{ backgroundColor: color }}
        />
      ),
    },
    {
      title: "Số lượng",
      key: "quantity",
      render: (_, record) => (
        <span>
          {record.sold_quantity}/{record.max_quantity || "∞"}
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "is_active",
      key: "is_active",
      render: (active) => (
        <Tag color={active ? "green" : "red"}>
          {active ? "Hoạt động" : "Tắt"}
        </Tag>
      ),
    },
    {
      title: "Level",
      dataIndex: "level",
      key: "level",
      render: (level) => {
        const colors = [
          "green",
          "blue",
          "cyan",
          "purple",
          "magenta",
          "gold",
          "volcano",
          "orange",
        ];
        const color =
          level === 1
            ? "green"
            : colors[Math.min(level - 1, colors.length - 1)];
        return <Tag color={color}>Level {level}</Tag>;
      },
    },
    {
      title: "Hành động",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Xóa loại vé này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
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
            <h1 className="text-2xl font-bold text-gray-900">
              Quản lý loại vé
            </h1>
            <p className="text-gray-600 mt-1">
              Tạo và quản lý các loại vé cho sự kiện
            </p>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => fetchData()}>
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingId(null);

                // Auto-suggest next level based on existing ticket types
                const currentEventTickets = ticketTypes.filter(
                  (tt) => tt.event_id === selectedEvent,
                );
                const suggestedLevel =
                  currentEventTickets.length > 0
                    ? Math.max(...currentEventTickets.map((tt) => tt.level)) + 1
                    : 1;

                setInitialFormValues({
                  color: "#10b981",
                  icon: "🎫",
                  level: suggestedLevel,
                  sort_order: 0,
                  is_active: true,
                });
                setIsModalOpen(true);
              }}
              style={{ backgroundColor: "#e62b1e" }}
            >
              Thêm loại vé
            </Button>
          </Space>
        </div>

        {/* Event Selector */}
        <Card>
          <div className="flex items-center gap-4">
            <span className="font-medium">Sự kiện:</span>
            <Select
              style={{ width: 300 }}
              value={selectedEvent}
              onChange={(value) => {
                setSelectedEvent(value);
                fetchData(value);
              }}
              options={events.map((e) => ({ label: e.name, value: e.id }))}
              placeholder="Chọn sự kiện"
            />
          </div>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={ticketTypes}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>

        {/* Modal */}
        <Modal
          title={editingId ? "Chỉnh sửa loại vé" : "Thêm loại vé mới"}
          open={isModalOpen}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingId(null);
            setInitialFormValues({
              color: "#10b981",
              icon: "🎫",
              sort_order: 0,
              is_active: true,
            });
          }}
          footer={null}
          width={600}
        >
          <Form
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={initialFormValues}
            key={formKey}
          >
            <Form.Item
              name="name"
              label="Tên loại vé"
              rules={[{ required: true, message: "Vui lòng nhập tên" }]}
            >
              <Input placeholder="VD: VIP Experience, Standard Pass..." />
            </Form.Item>
            <Form.Item name="subtitle" label="Tiêu đề phụ (hiển thị trên web)">
              <Input placeholder="VD: Premium seating, Speaker meet & greet..." />
            </Form.Item>
            <Form.Item name="description" label="Mô tả chi tiết">
              <Input.TextArea
                rows={2}
                placeholder="Mô tả chi tiết về loại vé..."
              />
            </Form.Item>

            {/* Benefits - Simplified for now */}
            <Form.Item name="benefits" label="Quyền lợi (Benefits)">
              <Input.TextArea
                rows={3}
                placeholder="Nhập các quyền lợi, mỗi dòng một quyền lợi"
              />
            </Form.Item>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="price"
                label="Giá (VND)"
                rules={[{ required: true, message: "Vui lòng nhập giá" }]}
              >
                <InputNumber
                  min={0}
                  step={1000}
                  style={{ width: "100%" }}
                  placeholder="VD: 800000"
                  formatter={(value) =>
                    `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                  }
                  parser={(value) => value!.replace(/,/g, "")}
                />
              </Form.Item>
              <Form.Item name="max_quantity" label="Số lượng tối đa">
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  placeholder="Để trống = không giới hạn"
                />
              </Form.Item>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <Form.Item name="icon" label="Icon">
                <Input placeholder="🎫" />
              </Form.Item>
              <Form.Item name="color" label="Màu sắc">
                <Input type="color" />
              </Form.Item>
              <Form.Item
                name="level"
                label="Level"
                rules={[{ required: true, message: "Vui lòng nhập level" }]}
                tooltip="Level 1 = rẻ nhất, Level càng cao = càng đắt. Hệ thống tự chọn vé có level thấp nhất khi tạo ghế mới."
              >
                <InputNumber
                  min={1}
                  max={100}
                  style={{ width: "100%" }}
                  placeholder="Nhập level (1 = rẻ nhất)"
                />
              </Form.Item>
              <Form.Item name="sort_order" label="Thứ tự hiển thị">
                <Input type="number" min={0} style={{ width: "100%" }} />
              </Form.Item>
            </div>
            <Form.Item name="is_active" label="Trạng thái">
              <Select
                options={[
                  { label: "Hoạt động", value: true },
                  { label: "Tắt", value: false },
                ]}
              />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  htmlType="submit"
                  style={{ backgroundColor: "#e62b1e" }}
                >
                  {editingId ? "Cập nhật" : "Tạo mới"}
                </Button>
                <Button
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingId(null);
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
