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
  Select,
  Space,
  Tag,
  Popconfirm,
  message,
  Switch,
  Row,
  Col,
  Statistic,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  UserOutlined,
  TeamOutlined,
  SafetyOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

interface User {
  id: string;
  username: string;
  email: string | null;
  fullName: string;
  phoneNumber: string | null;
  roleId: string;
  roleName: string;
  roleDescription: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
}

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "red",
  ADMIN: "orange",
  STAFF: "blue",
  USER: "default",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `/api/admin/users?page=${page}&limit=${pagination.limit}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json();
      if (data.success) {
        setUsers(data.data.users);
        setRoles(data.data.roles);
        setPagination((prev) => ({
          ...prev,
          page,
          total: data.data.pagination.total,
        }));
      }
    } catch (error) {
      message.error("Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setModalOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      roleId: user.roleId,
      isActive: user.isActive,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        message.success("User deleted");
        fetchData(pagination.page);
      } else {
        message.error(data.error || "Failed to delete");
      }
    } catch {
      message.error("Failed to delete user");
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const token = localStorage.getItem("token");
      const url = editingUser
        ? `/api/admin/users/${editingUser.id}`
        : "/api/admin/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        message.success(editingUser ? "User updated" : "User created");
        setModalOpen(false);
        fetchData(pagination.page);
      } else {
        message.error(data.error || "Failed to save");
      }
    } catch {
      message.error("Failed to save user");
    }
  };

  const stats = {
    total: users.length,
    active: users.filter((u) => u.isActive).length,
    admins: users.filter((u) => ["SUPER_ADMIN", "ADMIN"].includes(u.roleName))
      .length,
  };

  const columns: ColumnsType<User> = [
    {
      title: "User",
      key: "user",
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.fullName}</div>
          <div className="text-xs text-gray-500">
            <span className="font-mono">@{record.username}</span>
            {record.email && ` • ${record.email}`}
          </div>
        </div>
      ),
    },
    {
      title: "Role",
      dataIndex: "roleName",
      render: (role) => <Tag color={roleColors[role] || "default"}>{role}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "isActive",
      render: (active) => (
        <Tag color={active ? "green" : "red"}>
          {active ? "Active" : "Inactive"}
        </Tag>
      ),
    },
    {
      title: "Last Login",
      dataIndex: "lastLoginAt",
      render: (date) => (date ? dayjs(date).format("DD/MM/YYYY HH:mm") : "-"),
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      render: (date) => dayjs(date).format("DD/MM/YYYY"),
    },
    {
      title: "Actions",
      key: "actions",
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          />
          <Popconfirm
            title="Delete user?"
            description="This action cannot be undone"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            cancelText="Cancel"
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
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Quản lý Users</h1>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => fetchData()}
              loading={loading}
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              Thêm User
            </Button>
          </Space>
        </div>

        {/* Statistics */}
        <Row gutter={16}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Tổng Users"
                value={pagination.total}
                prefix={<TeamOutlined />}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Đang hoạt động"
                value={stats.active}
                prefix={<UserOutlined />}
                styles={{ content: { color: "#3f8600" } }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Admin/Super Admin"
                value={stats.admins}
                prefix={<SafetyOutlined />}
                styles={{ content: { color: "#cf1322" } }}
              />
            </Card>
          </Col>
        </Row>

        {/* Users Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={users}
            rowKey="id"
            loading={loading}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: pagination.total,
              showTotal: (total) => `Tổng ${total} users`,
              onChange: (page) => fetchData(page),
            }}
          />
        </Card>

        {/* Create/Edit Modal */}
        <Modal
          title={editingUser ? "Chỉnh sửa User" : "Thêm User mới"}
          open={modalOpen}
          onCancel={() => setModalOpen(false)}
          footer={null}
          width={500}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="username"
              label="Tên tài khoản"
              rules={[
                {
                  required: true,
                  min: 3,
                  message: "Tên tài khoản ít nhất 3 ký tự",
                },
              ]}
            >
              <Input
                prefix={<span className="text-gray-400">@</span>}
                placeholder="admin"
                disabled={!!editingUser}
              />
            </Form.Item>
            <Form.Item
              name="email"
              label="Email (tùy chọn)"
              rules={[
                {
                  type: "email",
                  message: "Email không hợp lệ",
                },
              ]}
            >
              <Input placeholder="email@example.com" />
            </Form.Item>
            {!editingUser && (
              <Form.Item
                name="password"
                label="Mật khẩu"
                rules={[
                  {
                    required: true,
                    min: 6,
                    message: "Mật khẩu ít nhất 6 ký tự",
                  },
                ]}
              >
                <Input.Password />
              </Form.Item>
            )}
            {editingUser && (
              <Form.Item
                name="password"
                label="Mật khẩu mới (để trống nếu không đổi)"
              >
                <Input.Password />
              </Form.Item>
            )}
            <Form.Item
              name="fullName"
              label="Họ tên"
              rules={[{ required: true, message: "Vui lòng nhập họ tên" }]}
            >
              <Input />
            </Form.Item>
            <Form.Item name="phoneNumber" label="Số điện thoại">
              <Input />
            </Form.Item>
            <Form.Item
              name="roleId"
              label="Vai trò"
              rules={[{ required: true, message: "Vui lòng chọn vai trò" }]}
            >
              <Select placeholder="Chọn vai trò">
                {roles.map((role) => (
                  <Select.Option key={role.id} value={role.id}>
                    <Tag color={roleColors[role.name] || "default"}>
                      {role.name}
                    </Tag>
                    {role.description && (
                      <span className="text-gray-500 ml-2">
                        - {role.description}
                      </span>
                    )}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item
              name="isActive"
              label="Trạng thái"
              valuePropName="checked"
            >
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
            <Form.Item className="mb-0 text-right">
              <Space>
                <Button onClick={() => setModalOpen(false)}>Hủy</Button>
                <Button type="primary" htmlType="submit">
                  {editingUser ? "Cập nhật" : "Tạo mới"}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AdminLayout>
  );
}
