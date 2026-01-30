"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin";
import {
  Table,
  Card,
  Space,
  Tag,
  Select,
  DatePicker,
  Input,
  Button,
  Modal,
  Descriptions,
  Statistic,
  Row,
  Col,
  Tooltip,
} from "antd";
import {
  ReloadOutlined,
  EyeOutlined,
  HistoryOutlined,
  UserOutlined,
  FileTextOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";

const { RangePicker } = DatePicker;

interface AuditLog {
  id: string;
  userId: string | null;
  userRole: string | null;
  userName: string;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  oldValue: Record<string, any> | null;
  newValue: Record<string, any> | null;
  changes: Record<string, any> | null;
  metadata: Record<string, any> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface Stats {
  byAction: { action: string; count: number }[];
  byEntity: { entity: string; count: number }[];
}

const actionColors: Record<string, string> = {
  CREATE: "green",
  UPDATE: "blue",
  DELETE: "red",
  CONFIRM: "success",
  REJECT: "error",
  PUBLISH: "cyan",
  UNPUBLISH: "orange",
  LOGIN: "purple",
  LOGOUT: "default",
  RESEND_EMAIL: "magenta",
  CHECK_IN: "lime",
  CANCEL: "volcano",
};

const entityColors: Record<string, string> = {
  EVENT: "blue",
  PAYMENT: "green",
  ORDER: "gold",
  TICKET: "purple",
  SEAT: "cyan",
  SEAT_LAYOUT: "geekblue",
  EMAIL: "magenta",
  USER: "orange",
  SETTING: "red",
  SPEAKER: "lime",
};

const roleColors: Record<string, string> = {
  SUPER_ADMIN: "red",
  ADMIN: "orange",
  STAFF: "blue",
  USER: "default",
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ byAction: [], byEntity: [] });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [detailModal, setDetailModal] = useState<AuditLog | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [entityFilter, setEntityFilter] = useState<string | undefined>();
  const [roleFilter, setRoleFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(
    null,
  );
  const [searchText, setSearchText] = useState("");

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", pagination.limit.toString());
      if (actionFilter) params.set("action", actionFilter);
      if (entityFilter) params.set("entity", entityFilter);
      if (roleFilter) params.set("userRole", roleFilter);
      if (dateRange) {
        params.set("startDate", dateRange[0].format("YYYY-MM-DD"));
        params.set("endDate", dateRange[1].format("YYYY-MM-DD"));
      }
      if (searchText) params.set("search", searchText);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data.logs);
        setStats(data.data.stats);
        setPagination((prev) => ({
          ...prev,
          page: data.data.pagination.page,
          total: data.data.pagination.total,
        }));
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [actionFilter, entityFilter, roleFilter, dateRange]);

  const handleSearch = () => {
    fetchData(1);
  };

  const handleReset = () => {
    setActionFilter(undefined);
    setEntityFilter(undefined);
    setRoleFilter(undefined);
    setDateRange(null);
    setSearchText("");
    fetchData(1);
  };

  const columns: ColumnsType<AuditLog> = [
    {
      title: "Thời gian",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (date) => (
        <div>
          <div>{dayjs(date).format("DD/MM/YYYY")}</div>
          <div className="text-xs text-gray-500">
            {dayjs(date).format("HH:mm:ss")}
          </div>
        </div>
      ),
    },
    {
      title: "Người thực hiện",
      key: "user",
      width: 180,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.userName}</div>
          <div className="text-xs text-gray-500">{record.userEmail}</div>
          {record.userRole && (
            <Tag
              color={roleColors[record.userRole] || "default"}
              className="mt-1"
            >
              {record.userRole}
            </Tag>
          )}
        </div>
      ),
    },
    {
      title: "Hành động",
      dataIndex: "action",
      key: "action",
      width: 130,
      render: (action) => (
        <Tag color={actionColors[action] || "default"}>{action}</Tag>
      ),
    },
    {
      title: "Đối tượng",
      key: "entity",
      width: 150,
      render: (_, record) => (
        <div>
          <Tag color={entityColors[record.entity] || "default"}>
            {record.entity}
          </Tag>
          {record.entityId && (
            <div className="text-xs text-gray-500 mt-1 truncate max-w-[120px]">
              {record.entityId.slice(0, 8)}...
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Chi tiết",
      key: "details",
      render: (_, record) => {
        const details = record.newValue || record.metadata || record.changes;
        if (!details) return "-";
        const preview = JSON.stringify(details).slice(0, 50);
        return (
          <Tooltip title="Xem chi tiết">
            <span className="text-gray-600 cursor-pointer">{preview}...</span>
          </Tooltip>
        );
      },
    },
    {
      title: "Device",
      key: "device",
      width: 140,
      render: (_, record) => {
        const device = record.metadata?.device;
        if (!device) return <span className="text-xs text-gray-400">-</span>;
        return (
          <div className="text-xs">
            <div className="font-medium">{device.browser}</div>
            <div className="text-gray-500">{device.os}</div>
            <Tag
              color={
                device.deviceType === "Mobile"
                  ? "blue"
                  : device.deviceType === "Tablet"
                    ? "purple"
                    : "green"
              }
              style={{ fontSize: "10px" }}
            >
              {device.deviceType}
            </Tag>
          </div>
        );
      },
    },
    {
      title: "IP",
      dataIndex: "ipAddress",
      key: "ipAddress",
      width: 120,
      render: (ip) => <span className="text-xs font-mono">{ip || "-"}</span>,
    },
    {
      title: "",
      key: "actions",
      width: 60,
      render: (_, record) => (
        <Button
          size="small"
          icon={<EyeOutlined />}
          onClick={() => setDetailModal(record)}
        />
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Nhật ký hệ thống</h1>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchData()}
            loading={loading}
          >
            Làm mới
          </Button>
        </div>

        {/* Statistics */}
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Tổng log"
                value={pagination.total}
                prefix={<HistoryOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Hành động phổ biến"
                value={stats.byAction[0]?.action || "-"}
                suffix={stats.byAction[0] ? `(${stats.byAction[0].count})` : ""}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Đối tượng phổ biến"
                value={stats.byEntity[0]?.entity || "-"}
                suffix={stats.byEntity[0] ? `(${stats.byEntity[0].count})` : ""}
                prefix={<FileTextOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Người dùng hoạt động"
                value={new Set(logs.map((l) => l.userId)).size}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card>
          <Space size="middle" wrap>
            <Select
              placeholder="Hành động"
              value={actionFilter}
              onChange={setActionFilter}
              style={{ width: 150 }}
              allowClear
              options={[
                { value: "CREATE", label: "Tạo mới" },
                { value: "UPDATE", label: "Cập nhật" },
                { value: "DELETE", label: "Xóa" },
                { value: "CONFIRM", label: "Xác nhận" },
                { value: "REJECT", label: "Từ chối" },
                { value: "PUBLISH", label: "Xuất bản" },
                { value: "LOGIN", label: "Đăng nhập" },
                { value: "RESEND_EMAIL", label: "Gửi lại email" },
              ]}
            />
            <Select
              placeholder="Đối tượng"
              value={entityFilter}
              onChange={setEntityFilter}
              style={{ width: 150 }}
              allowClear
              options={[
                { value: "EVENT", label: "Sự kiện" },
                { value: "PAYMENT", label: "Thanh toán" },
                { value: "ORDER", label: "Đơn hàng" },
                { value: "SEAT", label: "Ghế" },
                { value: "USER", label: "Người dùng" },
                { value: "EMAIL", label: "Email" },
                { value: "SPEAKER", label: "Diễn giả" },
              ]}
            />
            <Select
              placeholder="Vai trò"
              value={roleFilter}
              onChange={setRoleFilter}
              style={{ width: 150 }}
              allowClear
              options={[
                { value: "SUPER_ADMIN", label: "Super Admin" },
                { value: "ADMIN", label: "Admin" },
                { value: "STAFF", label: "Staff" },
                { value: "USER", label: "User" },
              ]}
            />
            <RangePicker
              value={dateRange}
              onChange={(dates) =>
                setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)
              }
              format="DD/MM/YYYY"
            />
            <Input.Search
              placeholder="Tìm kiếm..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 200 }}
              allowClear
            />
            <Button onClick={handleReset}>Đặt lại</Button>
          </Space>
        </Card>

        {/* Logs Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={logs}
            rowKey="id"
            loading={loading}
            pagination={{
              current: pagination.page,
              pageSize: pagination.limit,
              total: pagination.total,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} bản ghi`,
              onChange: (page) => fetchData(page),
            }}
            scroll={{ x: 1100 }}
          />
        </Card>

        {/* Detail Modal */}
        <Modal
          title="Chi tiết nhật ký"
          open={!!detailModal}
          onCancel={() => setDetailModal(null)}
          footer={null}
          width={800}
        >
          {detailModal && (
            <div className="space-y-4">
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Thời gian" span={2}>
                  {dayjs(detailModal.createdAt).format("DD/MM/YYYY HH:mm:ss")}
                </Descriptions.Item>
                <Descriptions.Item label="Người thực hiện">
                  {detailModal.userName}
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {detailModal.userEmail || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Vai trò">
                  <Tag
                    color={roleColors[detailModal.userRole || ""] || "default"}
                  >
                    {detailModal.userRole || "-"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Hành động">
                  <Tag color={actionColors[detailModal.action] || "default"}>
                    {detailModal.action}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Đối tượng">
                  <Tag color={entityColors[detailModal.entity] || "default"}>
                    {detailModal.entity}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="ID đối tượng">
                  <code className="text-xs">{detailModal.entityId || "-"}</code>
                </Descriptions.Item>
                <Descriptions.Item label="IP Address" span={2}>
                  <code className="text-xs">
                    {detailModal.ipAddress || "-"}
                  </code>
                </Descriptions.Item>
              </Descriptions>

              {detailModal.oldValue && (
                <div>
                  <h4 className="font-medium mb-2">Giá trị cũ:</h4>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(detailModal.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {detailModal.newValue && (
                <div>
                  <h4 className="font-medium mb-2">Giá trị mới:</h4>
                  <pre className="bg-green-50 p-3 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(detailModal.newValue, null, 2)}
                  </pre>
                </div>
              )}

              {/* Device Info */}
              {detailModal.metadata?.device && (
                <div>
                  <h4 className="font-medium mb-2">Thiết bị:</h4>
                  <div className="bg-purple-50 p-3 rounded space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">OS:</span>
                      <span className="font-medium">
                        {detailModal.metadata.device.os}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">Browser:</span>
                      <span className="font-medium">
                        {detailModal.metadata.device.browser}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm">Loại:</span>
                      <Tag
                        color={
                          detailModal.metadata.device.deviceType === "Mobile"
                            ? "blue"
                            : detailModal.metadata.device.deviceType ===
                                "Tablet"
                              ? "purple"
                              : "green"
                        }
                      >
                        {detailModal.metadata.device.deviceType}
                      </Tag>
                    </div>
                  </div>
                </div>
              )}

              {detailModal.metadata && (
                <div>
                  <h4 className="font-medium mb-2">Metadata:</h4>
                  <pre className="bg-blue-50 p-3 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(detailModal.metadata, null, 2)}
                  </pre>
                </div>
              )}

              {detailModal.userAgent && (
                <div>
                  <h4 className="font-medium mb-2">User Agent:</h4>
                  <p className="text-xs text-gray-500 break-all">
                    {detailModal.userAgent}
                  </p>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </AdminLayout>
  );
}
