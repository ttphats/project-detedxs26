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
  Avatar,
  Switch,
  Upload,
  Spin,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UserOutlined,
  UploadOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

interface Speaker {
  id: string;
  event_id: string;
  event_name: string;
  name: string;
  title: string | null;
  company: string | null;
  bio: string | null;
  image_url: string | null;
  topic: string | null;
  social_links: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Event {
  id: string;
  name: string;
}

export default function SpeakersPage() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<string | undefined>(
    undefined,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");

  const fetchData = async (eventId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventId) params.set("eventId", eventId);
      const res = await fetch(`/api/admin/speakers?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSpeakers(data.data.speakers);
        setEvents(data.data.events);
        if (!eventId && data.data.events.length > 0) {
          const firstEventId = data.data.events[0].id;
          setSelectedEvent(firstEventId);
          const res2 = await fetch(
            `/api/admin/speakers?eventId=${firstEventId}`,
          );
          const data2 = await res2.json();
          if (data2.success) {
            setSpeakers(data2.data.speakers);
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

  const handleSubmit = async (values: any) => {
    try {
      const payload = { ...values, event_id: selectedEvent };

      if (editingId) {
        await fetch(`/api/admin/speakers/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        message.success("Cập nhật thành công");
      } else {
        await fetch("/api/admin/speakers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        message.success("Tạo mới thành công");
      }
      setIsModalOpen(false);
      form.resetFields();
      setEditingId(null);
      fetchData(selectedEvent);
    } catch (error) {
      message.error("Có lỗi xảy ra");
    }
  };

  const handleEdit = (record: Speaker) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setImageUrl(record.image_url || "");
    setIsModalOpen(true);
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subfolder", "speakers");

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setImageUrl(data.data.url);
        form.setFieldsValue({ image_url: data.data.url });
        message.success("Upload thành công");
      } else {
        message.error(data.error || "Upload thất bại");
      }
    } catch (error) {
      message.error("Upload thất bại");
    } finally {
      setUploading(false);
    }
    return false; // Prevent default upload behavior
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/speakers/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        message.success("Đã xóa");
        fetchData(selectedEvent);
      } else {
        message.error(data.error);
      }
    } catch (error) {
      message.error("Có lỗi xảy ra");
    }
  };

  const handleToggleActive = async (id: string, is_active: boolean) => {
    try {
      await fetch(`/api/admin/speakers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      });
      fetchData(selectedEvent);
    } catch (error) {
      message.error("Có lỗi xảy ra");
    }
  };

  const columns: ColumnsType<Speaker> = [
    {
      title: "Speaker",
      key: "speaker",
      width: 350,
      render: (_, record) => (
        <Space align="start">
          <Avatar
            size={64}
            src={record.image_url}
            icon={<UserOutlined />}
            className="flex-shrink-0"
          />
          <div>
            <div className="font-bold text-base">{record.name}</div>
            {record.company && (
              <div className="text-gray-600 text-sm">{record.company}</div>
            )}
            {record.title && (
              <div className="text-gray-500 text-xs mt-1 line-clamp-2">
                {record.title}
              </div>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: "Topic",
      dataIndex: "topic",
      key: "topic",
      width: 250,
      render: (topic) => topic && <Tag color="red">{topic}</Tag>,
    },
    {
      title: "Thứ tự",
      dataIndex: "sort_order",
      key: "sort_order",
      width: 80,
    },
    {
      title: "Hiển thị",
      dataIndex: "is_active",
      key: "is_active",
      width: 100,
      render: (active, record) => (
        <Switch
          checked={active}
          onChange={(checked) => handleToggleActive(record.id, checked)}
        />
      ),
    },
    {
      title: "Hành động",
      key: "actions",
      width: 120,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Xóa speaker này?"
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
              Quản lý Speakers
            </h1>
            <p className="text-gray-600 mt-1">
              Thêm và quản lý diễn giả cho sự kiện
            </p>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchData(selectedEvent)}
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingId(null);
                form.resetFields();
                form.setFieldsValue({ sort_order: 0, is_active: true });
                setImageUrl("");
                setIsModalOpen(true);
              }}
              style={{ backgroundColor: "#e62b1e" }}
            >
              Thêm Speaker
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
            dataSource={speakers}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>

        {/* Modal */}
        <Modal
          title={editingId ? "Chỉnh sửa Speaker" : "Thêm Speaker mới"}
          open={isModalOpen}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingId(null);
            setImageUrl("");
            form.resetFields();
          }}
          footer={null}
          width={600}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="name"
              label="Họ và tên"
              rules={[{ required: true, message: "Vui lòng nhập tên" }]}
            >
              <Input placeholder="VD: Dr. Nguyen Thi Mai" />
            </Form.Item>
            <Form.Item name="company" label="Công ty/Tổ chức">
              <Input placeholder="VD: VinAI Research" />
            </Form.Item>
            <Form.Item name="title" label="Chức danh/Mô tả ngắn">
              <Input.TextArea
                rows={2}
                placeholder="VD: AI Research Director với hơn 15 năm kinh nghiệm..."
              />
            </Form.Item>
            <Form.Item name="topic" label="Chủ đề nói (Topic)">
              <Input placeholder="VD: The Future of AI in Southeast Asia" />
            </Form.Item>
            <Form.Item name="bio" label="Tiểu sử">
              <Input.TextArea rows={3} placeholder="Tiểu sử chi tiết..." />
            </Form.Item>
            <Form.Item label="Hình ảnh">
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
                      alt="Speaker"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      {uploading ? <LoadingOutlined /> : <UploadOutlined />}
                      <div style={{ marginTop: 8 }}>
                        {uploading ? "Đang tải..." : "Upload"}
                      </div>
                    </div>
                  )}
                </Upload>
                <div className="flex-1">
                  <Form.Item name="image_url" noStyle>
                    <Input
                      placeholder="Hoặc nhập URL hình ảnh..."
                      onChange={(e) => setImageUrl(e.target.value)}
                    />
                  </Form.Item>
                  <p className="text-gray-500 text-xs mt-1">
                    Hỗ trợ: JPEG, PNG, WebP, GIF (tối đa 5MB)
                  </p>
                </div>
              </div>
            </Form.Item>
            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="sort_order" label="Thứ tự hiển thị">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                name="is_active"
                label="Hiển thị"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </div>
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
                    setImageUrl("");
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
