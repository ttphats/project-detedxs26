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
  DatePicker,
  Upload,
  Image,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UploadOutlined,
  LoadingOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

interface Event {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  venue: string;
  event_date: string;
  doors_open_time: string;
  start_time: string;
  end_time: string;
  status: string;
  max_capacity: number;
  available_seats: number;
  banner_image_url: string | null;
  thumbnail_url: string | null;
  is_published: boolean;
  total_seats: number;
  booked_seats: number;
  speaker_count: number;
}

const statusColors: Record<string, string> = {
  DRAFT: "default",
  PUBLISHED: "green",
  CANCELLED: "red",
  COMPLETED: "blue",
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string>("");
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/events", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setEvents(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch:", error);
      message.error("Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        ...values,
        event_date: values.event_date?.toISOString(),
        doors_open_time: values.doors_open_time?.toISOString(),
        start_time: values.start_time?.toISOString(),
        end_time: values.end_time?.toISOString(),
        banner_image_url: bannerUrl || null,
        thumbnail_url: thumbnailUrl || null,
      };

      const token = localStorage.getItem("token");
      if (editingId) {
        const res = await fetch(`/api/admin/events/${editingId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          message.success("Cập nhật thành công");
        } else {
          message.error(data.error);
          return;
        }
      } else {
        const res = await fetch("/api/admin/events", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (data.success) {
          message.success("Tạo mới thành công");
        } else {
          message.error(data.error);
          return;
        }
      }
      closeModal();
      fetchData();
    } catch (error) {
      message.error("Có lỗi xảy ra");
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setBannerUrl("");
    setThumbnailUrl("");
    form.resetFields();
  };

  const handleEdit = (record: Event) => {
    setEditingId(record.id);
    setBannerUrl(record.banner_image_url || "");
    setThumbnailUrl(record.thumbnail_url || "");
    form.setFieldsValue({
      ...record,
      event_date: record.event_date ? dayjs(record.event_date) : null,
      doors_open_time: record.doors_open_time
        ? dayjs(record.doors_open_time)
        : null,
      start_time: record.start_time ? dayjs(record.start_time) : null,
      end_time: record.end_time ? dayjs(record.end_time) : null,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/events/${id}`, {
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

  const handleImageUpload = async (
    file: File,
    type: "banner" | "thumbnail",
  ) => {
    setUploading(true);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subfolder", "events");

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        if (type === "banner") {
          setBannerUrl(data.data.url);
        } else {
          setThumbnailUrl(data.data.url);
        }
        message.success("Upload thành công");
      } else {
        message.error(data.error || "Upload thất bại");
      }
    } catch (error) {
      message.error("Upload thất bại");
    } finally {
      setUploading(false);
    }
    return false;
  };

  const handleTogglePublish = async (id: string, isPublished: boolean) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: isPublished ? "DRAFT" : "PUBLISHED",
          is_published: !isPublished,
        }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(isPublished ? "Đã ẩn sự kiện" : "Đã publish sự kiện");
        fetchData();
      } else {
        message.error(data.error);
      }
    } catch (error) {
      message.error("Có lỗi xảy ra");
    }
  };

  const columns: ColumnsType<Event> = [
    {
      title: "Sự kiện",
      key: "event",
      render: (_, record) => (
        <div className="flex items-center gap-3">
          {record.thumbnail_url ? (
            <Image
              src={record.thumbnail_url}
              alt={record.name}
              width={60}
              height={40}
              className="rounded object-cover"
              style={{ objectFit: "cover" }}
            />
          ) : (
            <div className="w-[60px] h-[40px] bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">
              No img
            </div>
          )}
          <div>
            <div className="font-medium">{record.name}</div>
            <div className="text-xs text-gray-500">{record.venue}</div>
          </div>
        </div>
      ),
    },
    {
      title: "Ngày",
      dataIndex: "event_date",
      key: "event_date",
      render: (date: string) => dayjs(date).format("DD/MM/YYYY"),
      width: 120,
    },
    {
      title: "Ghế",
      key: "seats",
      render: (_, record) => (
        <span>
          {record.booked_seats}/{record.total_seats}
        </span>
      ),
      width: 80,
    },
    {
      title: "Speakers",
      dataIndex: "speaker_count",
      key: "speaker_count",
      width: 80,
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      render: (status: string) => (
        <Tag color={statusColors[status] || "default"}>{status}</Tag>
      ),
      width: 100,
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() =>
              window.open(`/admin/layout-editor?eventId=${record.id}`, "_blank")
            }
          />
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Xóa sự kiện này?"
            description="Tất cả dữ liệu liên quan sẽ bị xóa"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
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
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Events</h1>
            <p className="text-gray-600 mt-1">
              Tạo và quản lý các sự kiện TEDx
            </p>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingId(null);
                form.resetFields();
                form.setFieldsValue({ status: "DRAFT", max_capacity: 100 });
                setBannerUrl("");
                setThumbnailUrl("");
                setIsModalOpen(true);
              }}
              style={{ backgroundColor: "#e62b1e" }}
            >
              Thêm Event
            </Button>
          </Space>
        </div>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={events}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>

        {/* Modal */}
        <Modal
          title={editingId ? "Chỉnh sửa Event" : "Thêm Event mới"}
          open={isModalOpen}
          onCancel={closeModal}
          footer={null}
          width={700}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="name"
              label="Tên sự kiện"
              rules={[{ required: true, message: "Vui lòng nhập tên" }]}
            >
              <Input placeholder="VD: TEDxFPTUniversityHCMC 2026" />
            </Form.Item>

            <Form.Item
              name="venue"
              label="Địa điểm"
              rules={[{ required: true, message: "Vui lòng nhập địa điểm" }]}
            >
              <Input placeholder="VD: FPT University HCMC" />
            </Form.Item>

            <Form.Item name="description" label="Mô tả">
              <Input.TextArea rows={3} placeholder="Mô tả sự kiện..." />
            </Form.Item>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="event_date"
                label="Ngày sự kiện"
                rules={[{ required: true, message: "Chọn ngày" }]}
              >
                <DatePicker
                  showTime
                  format="DD/MM/YYYY HH:mm"
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item name="doors_open_time" label="Giờ mở cửa">
                <DatePicker
                  showTime
                  format="DD/MM/YYYY HH:mm"
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="start_time" label="Giờ bắt đầu">
                <DatePicker
                  showTime
                  format="DD/MM/YYYY HH:mm"
                  style={{ width: "100%" }}
                />
              </Form.Item>
              <Form.Item name="end_time" label="Giờ kết thúc">
                <DatePicker
                  showTime
                  format="DD/MM/YYYY HH:mm"
                  style={{ width: "100%" }}
                />
              </Form.Item>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item name="max_capacity" label="Sức chứa tối đa">
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="status" label="Trạng thái">
                <Select
                  options={[
                    { label: "Nháp", value: "DRAFT" },
                    { label: "Đã publish", value: "PUBLISHED" },
                    { label: "Đã hủy", value: "CANCELLED" },
                    { label: "Hoàn thành", value: "COMPLETED" },
                  ]}
                />
              </Form.Item>
            </div>

            {/* Banner Image */}
            <Form.Item label="Banner Image">
              <div className="flex items-start gap-4">
                {bannerUrl && (
                  <Image
                    src={bannerUrl}
                    alt="Banner"
                    width={200}
                    height={100}
                    className="rounded object-cover"
                  />
                )}
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={(file) => handleImageUpload(file, "banner")}
                >
                  <Button
                    icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}
                  >
                    {bannerUrl ? "Đổi ảnh" : "Upload Banner"}
                  </Button>
                </Upload>
              </div>
            </Form.Item>

            {/* Thumbnail */}
            <Form.Item label="Thumbnail">
              <div className="flex items-start gap-4">
                {thumbnailUrl && (
                  <Image
                    src={thumbnailUrl}
                    alt="Thumbnail"
                    width={100}
                    height={100}
                    className="rounded object-cover"
                  />
                )}
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={(file) => handleImageUpload(file, "thumbnail")}
                >
                  <Button
                    icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}
                  >
                    {thumbnailUrl ? "Đổi ảnh" : "Upload Thumbnail"}
                  </Button>
                </Upload>
              </div>
            </Form.Item>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={closeModal}>Hủy</Button>
              <Button
                type="primary"
                htmlType="submit"
                style={{ backgroundColor: "#e62b1e" }}
              >
                {editingId ? "Cập nhật" : "Tạo mới"}
              </Button>
            </div>
          </Form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
