"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin";
import {
  Table,
  Button,
  Tag,
  Tooltip,
  message,
  Modal,
  Select,
  Space,
  Input,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PoweroffOutlined,
  CheckCircleOutlined,
  SendOutlined,
} from "@ant-design/icons";
import Link from "next/link";

// Template categories - flexible system
const TEMPLATE_CATEGORIES = [
  "ORDER",
  "EVENT",
  "NOTIFICATION",
  "GENERAL",
] as const;
type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

interface CategoryInfo {
  key: TemplateCategory;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const CATEGORY_INFO: Record<TemplateCategory, CategoryInfo> = {
  ORDER: {
    key: "ORDER",
    title: "Đơn hàng",
    description: "Templates liên quan đến đơn hàng, thanh toán, vé",
    icon: "🛒",
    color: "blue",
  },
  EVENT: {
    key: "EVENT",
    title: "Sự kiện",
    description: "Templates về nhắc lịch, check-in, thông báo sự kiện",
    icon: "📅",
    color: "purple",
  },
  NOTIFICATION: {
    key: "NOTIFICATION",
    title: "Thông báo",
    description: "Templates thông báo cho admin hoặc hệ thống",
    icon: "🔔",
    color: "orange",
  },
  GENERAL: {
    key: "GENERAL",
    title: "Chung",
    description: "Templates dùng chung, linh hoạt",
    icon: "📧",
    color: "default",
  },
};

const CATEGORY_OPTIONS = [
  { value: "ALL", label: "Tất cả" },
  ...Object.entries(CATEGORY_INFO).map(([key, info]) => ({
    value: key,
    label: `${info.icon} ${info.title}`,
  })),
];

interface EmailTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string | null;
  subject: string;
  htmlContent: string;
  textContent: string | null;
  variables: string[];
  isActive: boolean;
  version: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<
    TemplateCategory | "ALL"
  >("ALL");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Test email modal state
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testTemplateId, setTestTemplateId] = useState<string | null>(null);
  const [testTemplateName, setTestTemplateName] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      let url = "/api/admin/email-templates";
      if (filterCategory !== "ALL") {
        url += `?category=${filterCategory}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      message.error("Không thể tải danh sách templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [filterCategory]);

  const handlePreview = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/email-templates/${id}/preview`);
      const html = await res.text();
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Failed to preview:", error);
      message.error("Không thể xem trước template");
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/email-templates/${id}/activate`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        message.success("Đã kích hoạt template");
        fetchTemplates();
      } else {
        message.error(data.error || "Không thể kích hoạt");
      }
    } catch (error) {
      console.error("Failed to activate:", error);
      message.error("Lỗi khi kích hoạt template");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivate = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/email-templates/${id}/activate`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        message.success("Đã hủy kích hoạt template");
        fetchTemplates();
      } else {
        message.error(data.error || "Không thể hủy kích hoạt");
      }
    } catch (error) {
      console.error("Failed to deactivate:", error);
      message.error("Lỗi khi hủy kích hoạt");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    Modal.confirm({
      title: "Xác nhận xóa",
      content: `Bạn có chắc muốn xóa template "${name}"?`,
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          const res = await fetch(`/api/admin/email-templates/${id}`, {
            method: "DELETE",
          });
          const data = await res.json();
          if (data.success) {
            message.success("Đã xóa template");
            fetchTemplates();
          } else {
            message.error(data.error || "Không thể xóa template");
          }
        } catch (error) {
          console.error("Failed to delete:", error);
          message.error("Lỗi khi xóa template");
        }
      },
    });
  };

  // Open test email modal
  const openTestModal = (id: string, name: string) => {
    setTestTemplateId(id);
    setTestTemplateName(name);
    setTestEmail("");
    setTestModalOpen(true);
  };

  // Send test email
  const handleSendTestEmail = async () => {
    if (!testTemplateId || !testEmail) {
      message.warning("Vui lòng nhập email");
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      message.error("Email không hợp lệ");
      return;
    }

    setSendingTest(true);
    try {
      const res = await fetch(
        `/api/admin/email-templates/${testTemplateId}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: testEmail }),
        },
      );
      const data = await res.json();
      if (data.success) {
        message.success(`Đã gửi test email đến ${testEmail}`);
        setTestModalOpen(false);
      } else {
        message.error(data.error || "Không thể gửi test email");
      }
    } catch (error) {
      console.error("Failed to send test email:", error);
      message.error("Lỗi khi gửi test email");
    } finally {
      setSendingTest(false);
    }
  };

  // Table columns
  const columns: ColumnsType<EmailTemplate> = [
    {
      title: "Danh mục",
      dataIndex: "category",
      key: "category",
      width: 140,
      render: (category: TemplateCategory) => {
        const info = CATEGORY_INFO[category];
        return info ? (
          <Tooltip title={info.description}>
            <Tag color={info.color}>
              {info.icon} {info.title}
            </Tag>
          </Tooltip>
        ) : (
          <Tag>{category}</Tag>
        );
      },
      filters: Object.entries(CATEGORY_INFO).map(([key, info]) => ({
        text: `${info.icon} ${info.title}`,
        value: key,
      })),
      onFilter: (value, record) => record.category === value,
    },
    {
      title: "Tên template",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      render: (name: string, record) => (
        <div>
          <div className="font-medium text-gray-900">{name}</div>
          <div className="text-xs text-gray-500 truncate max-w-xs">
            {record.description || record.subject}
          </div>
        </div>
      ),
    },
    {
      title: "Version",
      dataIndex: "version",
      key: "version",
      width: 80,
      align: "center",
      render: (v: number) => <span className="text-gray-500">v{v}</span>,
    },
    {
      title: "Trạng thái",
      dataIndex: "isActive",
      key: "isActive",
      width: 100,
      align: "center",
      render: (isActive: boolean) =>
        isActive ? (
          <Tag color="success">Active</Tag>
        ) : (
          <Tag color="default">Draft</Tag>
        ),
      filters: [
        { text: "Active", value: true },
        { text: "Draft", value: false },
      ],
      onFilter: (value, record) => record.isActive === value,
    },
    {
      title: "Cập nhật",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString("vi-VN"),
      sorter: (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      defaultSortOrder: "ascend",
    },
    {
      title: "Thao tác",
      key: "actions",
      width: 220,
      align: "center",
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Xem trước">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record.id)}
              loading={actionLoading === record.id}
            />
          </Tooltip>
          <Tooltip title="Test gửi email">
            <Button
              size="small"
              icon={<SendOutlined />}
              onClick={() => openTestModal(record.id, record.name)}
              style={{ color: "#1890ff" }}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa">
            <Link href={`/admin/email-templates/${record.id}`}>
              <Button size="small" icon={<EditOutlined />} />
            </Link>
          </Tooltip>
          {record.isActive ? (
            <Tooltip title="Hủy kích hoạt">
              <Button
                size="small"
                danger
                icon={<PoweroffOutlined />}
                onClick={() => handleDeactivate(record.id)}
                loading={actionLoading === record.id}
              />
            </Tooltip>
          ) : (
            <>
              <Tooltip title="Kích hoạt">
                <Button
                  size="small"
                  type="primary"
                  ghost
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleActivate(record.id)}
                  loading={actionLoading === record.id}
                />
              </Tooltip>
              <Tooltip title="Xóa">
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record.id, record.name)}
                />
              </Tooltip>
            </>
          )}
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
              Email Templates
            </h1>
            <p className="text-gray-600 mt-1">
              Tạo và quản lý email templates linh hoạt theo danh mục
            </p>
          </div>
          <Link href="/admin/email-templates/create">
            <Button type="primary" icon={<PlusOutlined />} size="large">
              Tạo Template
            </Button>
          </Link>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Lọc theo danh mục:</span>
          <Select
            value={filterCategory}
            onChange={(value) =>
              setFilterCategory(value as TemplateCategory | "ALL")
            }
            options={CATEGORY_OPTIONS}
            style={{ width: 200 }}
          />
        </div>

        {/* Templates Table */}
        <div className="bg-white rounded-lg shadow">
          <Table
            columns={columns}
            dataSource={templates}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} templates`,
            }}
            rowClassName={(record) => (record.isActive ? "bg-green-50/50" : "")}
            locale={{
              emptyText: (
                <div className="py-8 text-center">
                  <p className="text-gray-500 mb-2">
                    Chưa có email template nào
                  </p>
                  <Link href="/admin/email-templates/create">
                    <Button type="link">Tạo template đầu tiên</Button>
                  </Link>
                </div>
              ),
            }}
          />
        </div>

        {/* Preview Modal */}
        <Modal
          title="Email Preview"
          open={previewOpen}
          onCancel={() => setPreviewOpen(false)}
          footer={null}
          width={900}
          centered
        >
          <iframe
            srcDoc={previewHtml}
            className="w-full h-125 border-0"
            title="Email Preview"
          />
        </Modal>

        {/* Test Email Modal */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <SendOutlined className="text-blue-500" />
              <span>Test gửi email</span>
            </div>
          }
          open={testModalOpen}
          onCancel={() => setTestModalOpen(false)}
          onOk={handleSendTestEmail}
          okText="Gửi test"
          cancelText="Hủy"
          confirmLoading={sendingTest}
          okButtonProps={{ icon: <SendOutlined /> }}
        >
          <div className="py-4 space-y-4">
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700">
                <strong>Template:</strong> {testTemplateName}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Email sẽ được gửi với dữ liệu mẫu để kiểm tra hiển thị
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email nhận test <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Nhập email để nhận test..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                onPressEnter={handleSendTestEmail}
                size="large"
                prefix={<span className="text-gray-400">📧</span>}
              />
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <p className="text-xs text-yellow-700">
                ⚠️ Email test sẽ có tiêu đề kèm [TEST] để phân biệt với email
                thật
              </p>
            </div>
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
