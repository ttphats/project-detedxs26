"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin";
import {
  Table,
  Button,
  Card,
  Modal,
  Space,
  Tag,
  Popconfirm,
  message,
  Input,
  Select,
  Statistic,
  Row,
  Col,
  Tooltip,
  Descriptions,
} from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  MailOutlined,
  EyeOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  ClockCircleOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  event: {
    id: string;
    name: string;
    eventDate: string;
    venue: string;
  };
  seats: Array<{
    seatNumber: string;
    seatType: string;
    section: string;
    row: string;
    price: number;
  }>;
  payment: {
    id: string;
    paymentMethod: string;
    status: string;
    transactionId: string | null;
    paidAt: string | null;
  } | null;
  createdAt: string;
  paidAt: string | null;
  expiresAt: string | null;
  emailSentAt?: string | null;
}

interface Summary {
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  cancelledOrders: number;
}

const statusColors: Record<string, string> = {
  PENDING: "warning",
  PAID: "success",
  CANCELLED: "error",
  EXPIRED: "default",
  FAILED: "error",
};

const statusLabels: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
  FAILED: "Thất bại",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(
    undefined,
  );
  const [searchText, setSearchText] = useState("");
  const [summary, setSummary] = useState<Summary>({
    totalOrders: 0,
    pendingOrders: 0,
    paidOrders: 0,
    cancelledOrders: 0,
  });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [detailModal, setDetailModal] = useState<Order | null>(null);
  const [rejectModal, setRejectModal] = useState<Order | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (searchText) params.set("search", searchText);

      const res = await fetch(`/api/admin/orders?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setOrders(data.data.orders);
        setSummary(data.data.summary);
      }
    } catch (error) {
      message.error("Không thể tải danh sách đơn hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const handleSearch = () => {
    fetchData();
  };

  const handleConfirm = async (order: Order) => {
    setActionLoading(order.id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/orders/${order.id}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transactionId: `MANUAL-${Date.now()}`,
          notes: "Xác nhận bởi admin",
        }),
      });
      const data = await res.json();
      if (data.success) {
        message.success("Đã xác nhận thanh toán! Email vé đã được gửi.");
        fetchData();
      } else {
        message.error(data.error || "Không thể xác nhận thanh toán");
      }
    } catch (error) {
      message.error("Lỗi khi xác nhận thanh toán");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!rejectModal || !rejectReason.trim()) {
      message.warning("Vui lòng nhập lý do từ chối");
      return;
    }
    setActionLoading(rejectModal.id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/orders/${rejectModal.id}/reject`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(
          `Đã từ chối đơn hàng. ${data.data.releasedSeats} ghế đã được mở lại.`,
        );
        setRejectModal(null);
        setRejectReason("");
        fetchData();
      } else {
        message.error(data.error || "Không thể từ chối đơn hàng");
      }
    } catch (error) {
      message.error("Lỗi khi từ chối đơn hàng");
    } finally {
      setActionLoading(null);
    }
  };

  const handleResendEmail = async (order: Order) => {
    setActionLoading(order.id);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/orders/${order.id}/resend-email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        message.success("Đã gửi lại email xác nhận vé!");
        fetchData();
      } else {
        message.error(data.error || "Không thể gửi email");
      }
    } catch (error) {
      message.error("Lỗi khi gửi email");
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate revenue from PAID orders only
  const totalRevenue = orders
    .filter((o) => o.status === "PAID")
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const columns: ColumnsType<Order> = [
    {
      title: "Mã đơn",
      dataIndex: "orderNumber",
      key: "orderNumber",
      width: 180,
      render: (text, record) => (
        <div>
          <div className="font-medium text-blue-600">{text}</div>
          <div className="text-xs text-gray-500">
            {new Date(record.createdAt).toLocaleString("vi-VN")}
          </div>
        </div>
      ),
    },
    {
      title: "Khách hàng",
      key: "customer",
      width: 200,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.customerName}</div>
          <div className="text-xs text-gray-500">{record.customerEmail}</div>
          {record.customerPhone && (
            <div className="text-xs text-gray-500">{record.customerPhone}</div>
          )}
        </div>
      ),
    },
    {
      title: "Sự kiện",
      key: "event",
      width: 200,
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.event.name}</div>
          <div className="text-xs text-gray-500">
            {new Date(record.event.eventDate).toLocaleDateString("vi-VN")}
          </div>
        </div>
      ),
    },
    {
      title: "Ghế",
      key: "seats",
      width: 150,
      render: (_, record) => (
        <div>
          {record.seats.slice(0, 3).map((s, i) => (
            <Tag
              key={i}
              color={
                s.seatType === "VIP"
                  ? "red"
                  : s.seatType === "STANDARD"
                    ? "blue"
                    : "default"
              }
            >
              {s.seatNumber}
            </Tag>
          ))}
          {record.seats.length > 3 && <Tag>+{record.seats.length - 3}</Tag>}
        </div>
      ),
    },
    {
      title: "Tổng tiền",
      dataIndex: "totalAmount",
      key: "totalAmount",
      width: 140,
      align: "right",
      render: (amount) => (
        <span className="font-medium text-green-600">
          {amount.toLocaleString("vi-VN")} ₫
        </span>
      ),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (status) => (
        <Tag color={statusColors[status] || "default"}>
          {statusLabels[status] || status}
        </Tag>
      ),
    },
    {
      title: "Hành động",
      key: "actions",
      width: 220,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setDetailModal(record)}
            />
          </Tooltip>
          {record.status === "PENDING" && (
            <>
              <Popconfirm
                title="Xác nhận thanh toán"
                description="Bạn đã nhận được chuyển khoản?"
                onConfirm={() => handleConfirm(record)}
                okText="Xác nhận"
                cancelText="Hủy"
              >
                <Button
                  size="small"
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={actionLoading === record.id}
                  style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
                >
                  Xác nhận
                </Button>
              </Popconfirm>
              <Button
                size="small"
                danger
                icon={<CloseCircleOutlined />}
                onClick={() => setRejectModal(record)}
                loading={actionLoading === record.id}
              >
                Từ chối
              </Button>
            </>
          )}
          {record.status === "PAID" && (
            <Tooltip title="Gửi lại email">
              <Button
                size="small"
                icon={<MailOutlined />}
                onClick={() => handleResendEmail(record)}
                loading={actionLoading === record.id}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Quản lý Đơn hàng</h1>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchData}
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
                title="Tổng đơn hàng"
                value={summary.totalOrders}
                prefix={<ShoppingCartOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Chờ thanh toán"
                value={summary.pendingOrders}
                prefix={<ClockCircleOutlined />}
                styles={{ content: { color: "#faad14" } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Đã thanh toán"
                value={summary.paidOrders}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: "#52c41a" } }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Doanh thu"
                value={totalRevenue}
                prefix={<DollarOutlined />}
                suffix="₫"
                styles={{ content: { color: "#1890ff" } }}
                formatter={(value) =>
                  `${Number(value).toLocaleString("vi-VN")}`
                }
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card>
          <Space size="middle" wrap>
            <Input.Search
              placeholder="Tìm mã đơn, email, tên..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              onSearch={handleSearch}
              style={{ width: 300 }}
              allowClear
            />
            <Select
              placeholder="Trạng thái"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: 180 }}
              allowClear
              options={[
                { value: "PENDING", label: "Chờ thanh toán" },
                { value: "PAID", label: "Đã thanh toán" },
                { value: "CANCELLED", label: "Đã hủy" },
                { value: "EXPIRED", label: "Hết hạn" },
              ]}
            />
          </Space>
        </Card>

        {/* Orders Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={orders}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} đơn hàng`,
            }}
            scroll={{ x: 1200 }}
          />
        </Card>

        {/* Detail Modal */}
        <Modal
          title={`Chi tiết đơn hàng: ${detailModal?.orderNumber}`}
          open={!!detailModal}
          onCancel={() => setDetailModal(null)}
          footer={null}
          width={700}
        >
          {detailModal && (
            <div className="space-y-4">
              <Descriptions bordered column={2} size="small">
                <Descriptions.Item label="Mã đơn" span={2}>
                  <strong>{detailModal.orderNumber}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Khách hàng">
                  {detailModal.customerName}
                </Descriptions.Item>
                <Descriptions.Item label="Email">
                  {detailModal.customerEmail}
                </Descriptions.Item>
                <Descriptions.Item label="Điện thoại">
                  {detailModal.customerPhone || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Trạng thái">
                  <Tag color={statusColors[detailModal.status]}>
                    {statusLabels[detailModal.status]}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Sự kiện" span={2}>
                  {detailModal.event.name}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày tạo">
                  {new Date(detailModal.createdAt).toLocaleString("vi-VN")}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày thanh toán">
                  {detailModal.paidAt
                    ? new Date(detailModal.paidAt).toLocaleString("vi-VN")
                    : "-"}
                </Descriptions.Item>
                <Descriptions.Item label="Tổng tiền" span={2}>
                  <strong className="text-lg text-green-600">
                    {detailModal.totalAmount.toLocaleString("vi-VN")} ₫
                  </strong>
                </Descriptions.Item>
              </Descriptions>
              <div>
                <h4 className="font-medium mb-2">Ghế đã đặt:</h4>
                <Table
                  size="small"
                  dataSource={detailModal.seats}
                  rowKey="seatNumber"
                  pagination={false}
                  columns={[
                    {
                      title: "Ghế",
                      dataIndex: "seatNumber",
                      key: "seatNumber",
                    },
                    { title: "Khu vực", dataIndex: "section", key: "section" },
                    { title: "Hàng", dataIndex: "row", key: "row" },
                    {
                      title: "Loại",
                      dataIndex: "seatType",
                      key: "seatType",
                      render: (type: string) => (
                        <Tag
                          color={
                            type === "VIP"
                              ? "red"
                              : type === "STANDARD"
                                ? "blue"
                                : "default"
                          }
                        >
                          {type}
                        </Tag>
                      ),
                    },
                    {
                      title: "Giá",
                      dataIndex: "price",
                      key: "price",
                      align: "right" as const,
                      render: (price: number) =>
                        `${price.toLocaleString("vi-VN")} ₫`,
                    },
                  ]}
                />
              </div>
            </div>
          )}
        </Modal>

        {/* Reject Modal */}
        <Modal
          title="Từ chối đơn hàng"
          open={!!rejectModal}
          onCancel={() => {
            setRejectModal(null);
            setRejectReason("");
          }}
          onOk={handleReject}
          okText="Từ chối"
          okButtonProps={{
            danger: true,
            loading: actionLoading === rejectModal?.id,
          }}
          cancelText="Hủy"
        >
          <div className="space-y-4">
            <p>
              Bạn có chắc muốn từ chối đơn hàng{" "}
              <strong>{rejectModal?.orderNumber}</strong>?
            </p>
            <p className="text-gray-500 text-sm">
              Ghế sẽ được mở lại và khách hàng sẽ KHÔNG nhận được email.
            </p>
            <Input.TextArea
              placeholder="Nhập lý do từ chối (bắt buộc)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
