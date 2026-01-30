"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  message,
  Tooltip,
  Card,
  Switch,
  TimePicker,
  Upload,
  Avatar,
  Empty,
  AutoComplete,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CoffeeOutlined,
  CheckCircleOutlined,
  MenuOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import AdminLayout from "@/components/admin/AdminLayout";
import dayjs from "dayjs";
import type { UploadProps } from "antd";

interface Timeline {
  id: string;
  event_id: string;
  start_time: string;
  end_time: string;
  title: string;
  description: string | null;
  speaker_name: string | null;
  speaker_avatar_url: string | null;
  type: "TALK" | "BREAK" | "CHECKIN" | "OTHER";
  order_index: number;
  status: "DRAFT" | "PUBLISHED";
  created_at: string;
  updated_at: string;
}

interface Event {
  id: string;
  name: string;
}

const TIMELINE_TYPES = [
  { value: "TALK", label: "🎤 Diễn giả", color: "blue" },
  { value: "BREAK", label: "☕ Giải lao", color: "orange" },
  { value: "CHECKIN", label: "📋 Check-in", color: "green" },
  { value: "PERFORMANCE", label: "🎭 Biểu diễn", color: "purple" },
  { value: "OTHER", label: "📌 Khác", color: "default" },
];

export default function TimelinesPage() {
  const [timelines, setTimelines] = useState<Timeline[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Timeline | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form] = Form.useForm();

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch("/api/admin/events");
        const data = await res.json();
        if (data.success) {
          setEvents(data.data);
          if (data.data.length > 0 && !selectedEvent) {
            setSelectedEvent(data.data[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch events:", err);
      }
    };
    fetchEvents();
  }, []);

  // Fetch timelines when event changes
  const fetchTimelines = useCallback(async () => {
    if (!selectedEvent) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/timelines?eventId=${selectedEvent}`);
      const data = await res.json();
      if (data.success) {
        setTimelines(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch timelines:", err);
      message.error("Không thể tải timeline");
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => {
    fetchTimelines();
  }, [fetchTimelines]);

  // Open create/edit modal
  const openModal = (item?: Timeline) => {
    if (item) {
      setEditingItem(item);
      form.setFieldsValue({
        ...item,
        start_time: dayjs(item.start_time, "HH:mm"),
        end_time: dayjs(item.end_time, "HH:mm"),
      });
    } else {
      setEditingItem(null);
      form.resetFields();
      form.setFieldsValue({ type: "TALK", status: "DRAFT" });
    }
    setModalOpen(true);
  };

  // Save timeline
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        event_id: selectedEvent,
        start_time: values.start_time.format("HH:mm"),
        end_time: values.end_time.format("HH:mm"),
        order_index: editingItem?.order_index ?? timelines.length,
      };

      const url = editingItem
        ? `/api/admin/timelines/${editingItem.id}`
        : "/api/admin/timelines";
      const method = editingItem ? "PUT" : "POST";
      const token = localStorage.getItem("token");

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        message.success(
          editingItem ? "Đã cập nhật timeline" : "Đã tạo timeline",
        );
        setModalOpen(false);
        fetchTimelines();
      } else {
        message.error(data.error || "Có lỗi xảy ra");
      }
    } catch (err) {
      console.error("Save error:", err);
    }
  };

  // Delete timeline
  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: "Xác nhận xóa",
      content: "Bạn có chắc chắn muốn xóa timeline này?",
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/admin/timelines/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        if (data.success) {
          message.success("Đã xóa timeline");
          fetchTimelines();
        } else {
          message.error(data.error || "Không thể xóa");
        }
      },
    });
  };

  // Toggle publish
  const handlePublishToggle = async (id: string, publish: boolean) => {
    const token = localStorage.getItem("token");
    const res = await fetch(`/api/admin/timelines/${id}/publish`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ publish }),
    });
    const data = await res.json();
    if (data.success) {
      message.success(publish ? "Đã xuất bản" : "Đã ẩn timeline");
      fetchTimelines();
    } else {
      message.error(data.error || "Có lỗi xảy ra");
    }
  };

  // Move item (reorder)
  const handleMove = async (id: string, direction: "up" | "down") => {
    const index = timelines.findIndex((t) => t.id === id);
    if (
      (direction === "up" && index === 0) ||
      (direction === "down" && index === timelines.length - 1)
    ) {
      return;
    }
    const newIndex = direction === "up" ? index - 1 : index + 1;
    const newTimelines = [...timelines];
    [newTimelines[index], newTimelines[newIndex]] = [
      newTimelines[newIndex],
      newTimelines[index],
    ];

    // Update order_index
    const token = localStorage.getItem("token");
    const items = newTimelines.map((t, i) => ({ id: t.id, order_index: i }));
    const res = await fetch("/api/admin/timelines/reorder", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items, eventId: selectedEvent }),
    });
    if ((await res.json()).success) {
      setTimelines(newTimelines.map((t, i) => ({ ...t, order_index: i })));
    }
  };

  const getTypeInfo = (type: string) =>
    TIMELINE_TYPES.find((t) => t.value === type) || TIMELINE_TYPES[3];

  const columns = [
    {
      title: "",
      key: "move",
      width: 60,
      render: (_: any, record: Timeline, index: number) => (
        <Space orientation="vertical" size={0}>
          <Button
            size="small"
            type="text"
            icon={<span>▲</span>}
            disabled={index === 0}
            onClick={() => handleMove(record.id, "up")}
          />
          <Button
            size="small"
            type="text"
            icon={<span>▼</span>}
            disabled={index === timelines.length - 1}
            onClick={() => handleMove(record.id, "down")}
          />
        </Space>
      ),
    },
    {
      title: "Thời gian",
      key: "time",
      width: 120,
      render: (_: any, record: Timeline) => (
        <div className="text-center">
          <div className="font-bold text-red-600">{record.start_time}</div>
          <div className="text-xs text-gray-400">đến</div>
          <div className="font-medium">{record.end_time}</div>
        </div>
      ),
    },
    {
      title: "Nội dung",
      key: "content",
      render: (_: any, record: Timeline) => {
        const typeInfo = getTypeInfo(record.type);
        return (
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Tag color={typeInfo.color}>{typeInfo.label}</Tag>
              <span className="font-semibold">{record.title}</span>
            </div>
            {record.description && (
              <p className="text-gray-500 text-sm mb-1 line-clamp-2">
                {record.description}
              </p>
            )}
            {record.speaker_name && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Avatar
                  size="small"
                  src={record.speaker_avatar_url}
                  icon={<UserOutlined />}
                />
                <span>{record.speaker_name}</span>
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "Trạng thái",
      key: "status",
      width: 120,
      align: "center" as const,
      render: (_: any, record: Timeline) => (
        <Switch
          checked={record.status === "PUBLISHED"}
          checkedChildren="Công khai"
          unCheckedChildren="Nháp"
          onChange={(checked) => handlePublishToggle(record.id, checked)}
        />
      ),
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 100,
      render: (_: any, record: Timeline) => (
        <Space>
          <Tooltip title="Sửa">
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openModal(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record.id)}
            />
          </Tooltip>
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
              Quản lý Timeline
            </h1>
            <p className="text-gray-500">Tạo và quản lý lịch trình sự kiện</p>
          </div>
          <Space>
            <Select
              style={{ width: 280 }}
              placeholder="Chọn sự kiện"
              value={selectedEvent}
              onChange={setSelectedEvent}
              options={events.map((e) => ({ value: e.id, label: e.name }))}
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => openModal()}
            >
              Thêm mục
            </Button>
            <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>
              Xem trước
            </Button>
          </Space>
        </div>

        {/* Table */}
        <Card>
          <Table
            dataSource={timelines}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  description="Chưa có timeline nào"
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                >
                  <Button type="primary" onClick={() => openModal()}>
                    Tạo timeline đầu tiên
                  </Button>
                </Empty>
              ),
            }}
          />
        </Card>

        {/* Create/Edit Modal */}
        <Modal
          title={editingItem ? "Chỉnh sửa Timeline" : "Thêm Timeline mới"}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          onOk={handleSave}
          okText={editingItem ? "Lưu" : "Tạo"}
          cancelText="Hủy"
          width={600}
        >
          <Form form={form} layout="vertical" className="mt-4">
            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="start_time"
                label="Giờ bắt đầu"
                rules={[{ required: true }]}
              >
                <TimePicker format="HH:mm" className="w-full" />
              </Form.Item>
              <Form.Item
                name="end_time"
                label="Giờ kết thúc"
                rules={[{ required: true }]}
              >
                <TimePicker format="HH:mm" className="w-full" />
              </Form.Item>
            </div>
            <Form.Item
              name="title"
              label="Tiêu đề"
              rules={[{ required: true }]}
            >
              <Input placeholder="VD: Opening Keynote" />
            </Form.Item>
            <Form.Item name="description" label="Mô tả">
              <Input.TextArea
                rows={3}
                placeholder="Mô tả ngắn về nội dung..."
              />
            </Form.Item>
            <Form.Item name="type" label="Loại" rules={[{ required: true }]}>
              <AutoComplete
                options={TIMELINE_TYPES.map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
                placeholder="Chọn hoặc nhập loại mới..."
                filterOption={(inputValue, option) =>
                  option?.value
                    .toLowerCase()
                    .includes(inputValue.toLowerCase()) ||
                  option?.label
                    ?.toString()
                    .toLowerCase()
                    .includes(inputValue.toLowerCase())
                }
              />
            </Form.Item>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="speaker_name" label="Tên diễn giả">
                <Input placeholder="Nguyễn Văn A" />
              </Form.Item>
              <Form.Item name="speaker_avatar_url" label="URL ảnh diễn giả">
                <Input placeholder="https://..." />
              </Form.Item>
            </div>
          </Form>
        </Modal>

        {/* Preview Modal */}
        <Modal
          title="Xem trước Timeline"
          open={previewOpen}
          onCancel={() => setPreviewOpen(false)}
          footer={null}
          width={700}
        >
          <div className="bg-black text-white p-6 rounded-lg min-h-[400px]">
            <h2 className="text-2xl font-bold text-red-500 mb-6 text-center">
              LỊCH TRÌNH SỰ KIỆN
            </h2>
            <div className="space-y-4">
              {timelines.filter((t) => t.status === "PUBLISHED").length ===
              0 ? (
                <p className="text-center text-gray-400">
                  Chưa có mục nào được xuất bản
                </p>
              ) : (
                timelines
                  .filter((t) => t.status === "PUBLISHED")
                  .map((item) => {
                    const typeInfo = getTypeInfo(item.type);
                    return (
                      <div
                        key={item.id}
                        className="flex gap-4 p-4 bg-gray-900 rounded-lg"
                      >
                        <div className="text-center min-w-[80px]">
                          <div className="text-xl font-bold text-red-500">
                            {item.start_time}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.end_time}
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {item.type === "TALK" && <span>🎤</span>}
                            {item.type === "BREAK" && <span>☕</span>}
                            {item.type === "CHECKIN" && <span>📋</span>}
                            <span className="font-semibold">{item.title}</span>
                          </div>
                          {item.description && (
                            <p className="text-gray-400 text-sm">
                              {item.description}
                            </p>
                          )}
                          {item.speaker_name && (
                            <div className="flex items-center gap-2 mt-2 text-sm text-gray-300">
                              <Avatar
                                size="small"
                                src={item.speaker_avatar_url}
                                icon={<UserOutlined />}
                              />
                              <span>{item.speaker_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
