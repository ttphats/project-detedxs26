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
  Upload,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined,
  LoadingOutlined,
  DeleteOutlined as DeleteImgOutlined,
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
  image_url: string | null;
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
  const [form] = Form.useForm();
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(
    undefined,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [initialFormValues, setInitialFormValues] = useState<any>({
    color: "#10b981",
    icon: "🎫",
    sort_order: 0,
    is_active: true,
    image_url: null,
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
            (e: any) => e.status === "PUBLISHED",
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

  // Sync form values when modal opens
  useEffect(() => {
    if (isModalOpen && initialFormValues) {
      // Small delay to ensure form is mounted (Turbopack dev mode issue)
      setTimeout(() => {
        form.setFieldsValue(initialFormValues);
      }, 0);
    }
  }, [isModalOpen, initialFormValues, form]);

  const formatVND = (price: number) =>
    `${Math.round(price).toLocaleString("vi-VN")} ₫`;

  const resetModalState = () => {
    setEditingId(null);
    setImageUrl(null);
    form.resetFields();
    setInitialFormValues({
      color: "#10b981",
      icon: "🎫",
      sort_order: 0,
      is_active: true,
      image_url: null,
    });
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subfolder", "ticket-types");

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        const url = data.data.url as string;
        setImageUrl(url);
        form.setFieldsValue({ image_url: url });
        message.success("Upload ảnh thẻ vé thành công");
      } else {
        message.error(data.error || "Upload thất bại");
      }
    } catch {
      message.error("Upload thất bại");
    } finally {
      setUploadingImage(false);
    }
    return false;
  };

  const handleClearImage = () => {
    setImageUrl(null);
    form.setFieldsValue({ image_url: null });
  };

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
        level: Number(values.level) || 1,
        max_quantity: values.max_quantity ? Number(values.max_quantity) : null,
        sort_order: Number(values.sort_order) || 0,
        benefits: benefitsArray,
        event_id: selectedEvent,
        // Explicit null clears image → client falls back to CSS default
        image_url: imageUrl || null,
      };

      const res = editingId
        ? await fetch(`/api/admin/ticket-types/${editingId}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/ticket-types", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });

      const raw = await res.text();
      let data: { success?: boolean; error?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        message.error(
          `Lưu thất bại (HTTP ${res.status}). Backend có thể chưa hỗ trợ image_url.`,
        );
        return;
      }

      if (!res.ok || !data.success) {
        message.error(
          data.error ||
            `Lưu thất bại (HTTP ${res.status}). Kiểm tra cột image_url / deploy backend.`,
        );
        return;
      }

      message.success(editingId ? "Cập nhật thành công" : "Tạo mới thành công");
      setIsModalOpen(false);
      resetModalState();
      fetchData(selectedEvent);
    } catch (error) {
      console.error(error);
      message.error("Có lỗi xảy ra khi lưu loại vé");
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
    const img = record.image_url || null;
    const formValues = { ...record, benefits: benefitsText, image_url: img };
    setImageUrl(img);
    setInitialFormValues(formValues);
    setEditingId(record.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/ticket-types?id=${id}`, {
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
          {record.image_url ? (
            <img
              src={record.image_url}
              alt={record.name}
              style={{
                width: 56,
                height: 36,
                objectFit: "cover",
                borderRadius: 6,
                border: "1px solid #e5e7eb",
              }}
            />
          ) : (
            <span style={{ fontSize: 24 }}>{record.icon}</span>
          )}
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
      title: "Ảnh thẻ",
      dataIndex: "image_url",
      key: "image_url",
      width: 100,
      render: (url: string | null) =>
        url ? (
          <Tag color="blue">Custom</Tag>
        ) : (
          <Tag color="default">CSS default</Tag>
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
      title: "Hành động",
      key: "actions",
      width: 120,
      fixed: "right" as const,
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
                setImageUrl(null);

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
                  image_url: null,
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
            dataSource={ticketTypes.sort((a, b) => a.level - b.level)}
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
            resetModalState();
          }}
          footer={null}
          width={640}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
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

            {/* Card image — optional; blank = CSS gradient on web-client */}
            <Form.Item
              name="image_url"
              label={
                <span>
                  Ảnh thẻ vé{" "}
                  <Tooltip title="Nếu không upload, web-client dùng CSS gradient mặc định theo level/màu">
                    <span className="text-gray-400 text-xs font-normal">
                      (tuỳ chọn)
                    </span>
                  </Tooltip>
                </span>
              }
              extra="Khuyến nghị 800×400px (landscape). Để trống = CSS default."
            >
              <div className="flex items-start gap-4">
                <Upload
                  name="file"
                  listType="picture-card"
                  showUploadList={false}
                  beforeUpload={handleImageUpload}
                  accept="image/jpeg,image/png,image/webp,image/gif"
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Ticket card"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        borderRadius: 8,
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      {uploadingImage ? (
                        <LoadingOutlined />
                      ) : (
                        <UploadOutlined />
                      )}
                      <div style={{ marginTop: 8 }}>
                        {uploadingImage ? "Uploading..." : "Upload ảnh"}
                      </div>
                    </div>
                  )}
                </Upload>
                {imageUrl && (
                  <Button
                    danger
                    size="small"
                    icon={<DeleteImgOutlined />}
                    onClick={handleClearImage}
                  >
                    Xoá ảnh (dùng CSS)
                  </Button>
                )}
              </div>
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
                  formatter={(value) => {
                    if (!value) return "";
                    return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                  }}
                  parser={
                    ((value: string | undefined) => {
                      if (!value) return 0;
                      const parsed = Number(value.replace(/,/g, ""));
                      return isNaN(parsed) ? 0 : parsed;
                    }) as any
                  }
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
                    resetModalState();
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
