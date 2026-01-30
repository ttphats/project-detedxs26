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

interface EmailTemplate {
  id: string;
  name: string;
  purpose: string;
  subject: string;
  isActive: boolean;
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
  const [rejectTemplateId, setRejectTemplateId] = useState<
    string | undefined
  >();

  // Confirm modal states (thay thế Popconfirm)
  const [confirmModal, setConfirmModal] = useState<Order | null>(null);
  const [confirmTemplateId, setConfirmTemplateId] = useState<
    string | undefined
  >();

  // Email modal states
  const [emailModal, setEmailModal] = useState<Order | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<
    string | undefined
  >();
  const [emailLoading, setEmailLoading] = useState(false);

  // Batch selection states
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchEmailModal, setBatchEmailModal] = useState(false);
  const [batchAction, setBatchAction] = useState<
    "confirm" | "reject" | "email" | null
  >(null);

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

  // Fetch email templates when email modal opens
  const fetchEmailTemplates = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/email-templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        // Only show active templates
        setEmailTemplates(data.data.filter((t: EmailTemplate) => t.isActive));
      }
    } catch (error) {
      console.error("Failed to fetch email templates:", error);
    }
  };

  const openEmailModal = (order: Order) => {
    setEmailModal(order);
    setSelectedTemplateId(undefined);
    fetchEmailTemplates();
  };

  const handleSendEmail = async () => {
    if (!emailModal || !selectedTemplateId) {
      message.warning("Vui lòng chọn template email");
      return;
    }
    setEmailLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/admin/orders/${emailModal.id}/send-email`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ templateId: selectedTemplateId }),
      });
      const data = await res.json();
      if (data.success) {
        message.success("Đã gửi email thành công!");
        setEmailModal(null);
        setSelectedTemplateId(undefined);
        fetchData();
      } else if (data.skipped) {
        message.warning(data.error || "Email đã được gửi trước đó (anti-spam)");
      } else {
        message.error(data.error || "Không thể gửi email");
      }
    } catch (error) {
      message.error("Lỗi khi gửi email");
    } finally {
      setEmailLoading(false);
    }
  };

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
    if (!rejectTemplateId) {
      message.warning("Vui lòng chọn template email");
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
        body: JSON.stringify({
          reason: rejectReason,
          templateId: rejectTemplateId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        message.success(
          `Đã từ chối đơn hàng. ${data.data.releasedSeats} ghế đã được mở lại.`,
        );
        setRejectModal(null);
        setRejectReason("");
        setRejectTemplateId(undefined);
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

  // Get selected orders
  const selectedOrders = orders.filter((o) => selectedRowKeys.includes(o.id));
  const pendingSelectedOrders = selectedOrders.filter(
    (o) => o.status === "PENDING",
  );

  // Open batch email modal
  const openBatchEmailModal = (action: "confirm" | "reject" | "email") => {
    setBatchAction(action);
    setBatchEmailModal(true);
    setSelectedTemplateId(undefined);
    fetchEmailTemplates();
  };

  // Handle batch confirm
  const handleBatchConfirm = async () => {
    if (!selectedTemplateId) {
      message.warning("Vui lòng chọn template email");
      return;
    }
    setBatchLoading(true);
    const token = localStorage.getItem("token");
    let successCount = 0;
    let failCount = 0;

    for (const order of pendingSelectedOrders) {
      try {
        const res = await fetch(`/api/admin/orders/${order.id}/confirm`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transactionId: `MANUAL-${Date.now()}`,
            notes: "Xác nhận hàng loạt bởi admin",
            templateId: selectedTemplateId,
          }),
        });
        const data = await res.json();
        if (data.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setBatchLoading(false);
    setBatchEmailModal(false);
    setSelectedRowKeys([]);
    message.success(
      `Đã xác nhận ${successCount} đơn hàng${failCount > 0 ? `, ${failCount} thất bại` : ""}`,
    );
    fetchData();
  };

  // Handle batch reject
  const handleBatchReject = async () => {
    if (!selectedTemplateId) {
      message.warning("Vui lòng chọn template email");
      return;
    }
    setBatchLoading(true);
    const token = localStorage.getItem("token");
    let successCount = 0;
    let failCount = 0;

    for (const order of pendingSelectedOrders) {
      try {
        const res = await fetch(`/api/admin/orders/${order.id}/reject`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            reason: "Từ chối hàng loạt bởi admin",
            templateId: selectedTemplateId,
          }),
        });
        const data = await res.json();
        if (data.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setBatchLoading(false);
    setBatchEmailModal(false);
    setSelectedRowKeys([]);
    message.success(
      `Đã từ chối ${successCount} đơn hàng${failCount > 0 ? `, ${failCount} thất bại` : ""}`,
    );
    fetchData();
  };

  // Handle batch send email
  const handleBatchSendEmail = async () => {
    if (!selectedTemplateId) {
      message.warning("Vui lòng chọn template email");
      return;
    }
    setBatchLoading(true);
    const token = localStorage.getItem("token");
    let successCount = 0;
    let failCount = 0;

    for (const order of selectedOrders) {
      try {
        const res = await fetch(`/api/admin/orders/${order.id}/send-email`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ templateId: selectedTemplateId }),
        });
        const data = await res.json();
        if (data.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    setBatchLoading(false);
    setBatchEmailModal(false);
    setSelectedRowKeys([]);
    message.success(
      `Đã gửi email cho ${successCount} đơn hàng${failCount > 0 ? `, ${failCount} thất bại` : ""}`,
    );
    fetchData();
  };

  // Row selection config
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
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
                onClick={() => {
                  setRejectModal(record);
                  setRejectTemplateId(undefined);
                  fetchEmailTemplates();
                }}
                loading={actionLoading === record.id}
              >
                Từ chối
              </Button>
              <Tooltip title="Gửi email (chọn template)">
                <Button
                  size="small"
                  icon={<MailOutlined />}
                  onClick={() => openEmailModal(record)}
                />
              </Tooltip>
            </>
          )}
          {record.status === "PAID" && (
            <Tooltip title="Gửi email (chọn template)">
              <Button
                size="small"
                icon={<MailOutlined />}
                onClick={() => openEmailModal(record)}
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

        {/* Batch Actions Bar */}
        {selectedRowKeys.length > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <span className="font-medium">
                Đã chọn {selectedRowKeys.length} đơn hàng
                {pendingSelectedOrders.length > 0 && (
                  <span className="text-orange-600 ml-2">
                    ({pendingSelectedOrders.length} chờ thanh toán)
                  </span>
                )}
              </span>
              <Space>
                {pendingSelectedOrders.length > 0 && (
                  <>
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={() => openBatchEmailModal("confirm")}
                      style={{
                        backgroundColor: "#52c41a",
                        borderColor: "#52c41a",
                      }}
                    >
                      Xác nhận ({pendingSelectedOrders.length})
                    </Button>
                    <Button
                      danger
                      icon={<CloseCircleOutlined />}
                      onClick={() => openBatchEmailModal("reject")}
                    >
                      Từ chối ({pendingSelectedOrders.length})
                    </Button>
                  </>
                )}
                <Button
                  icon={<MailOutlined />}
                  onClick={() => openBatchEmailModal("email")}
                >
                  Gửi email ({selectedRowKeys.length})
                </Button>
                <Button onClick={() => setSelectedRowKeys([])}>Bỏ chọn</Button>
              </Space>
            </div>
          </Card>
        )}

        {/* Orders Table */}
        <Card>
          <Table
            rowSelection={rowSelection}
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
            setRejectTemplateId(undefined);
          }}
          onOk={handleReject}
          okText="Từ chối"
          okButtonProps={{
            danger: true,
            loading: actionLoading === rejectModal?.id,
            disabled: !rejectTemplateId || !rejectReason.trim(),
          }}
          cancelText="Hủy"
        >
          <div className="space-y-4">
            <p>
              Bạn có chắc muốn từ chối đơn hàng{" "}
              <strong>{rejectModal?.orderNumber}</strong>?
            </p>
            <p className="text-gray-500 text-sm">
              Ghế sẽ được mở lại và email từ chối sẽ được gửi cho khách hàng.
            </p>
            <Input.TextArea
              placeholder="Nhập lý do từ chối (bắt buộc)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            <div>
              <label className="block mb-2 font-medium">
                Chọn template email:
              </label>
              <Select
                placeholder="Chọn template..."
                value={rejectTemplateId}
                onChange={setRejectTemplateId}
                style={{ width: "100%" }}
                options={emailTemplates.map((t) => ({
                  value: t.id,
                  label: (
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-gray-500">
                        {t.purpose} - {t.subject}
                      </div>
                    </div>
                  ),
                }))}
              />
            </div>
          </div>
        </Modal>

        {/* Email Template Modal */}
        <Modal
          title={`Gửi email - Đơn hàng ${emailModal?.orderNumber}`}
          open={!!emailModal}
          onCancel={() => {
            setEmailModal(null);
            setSelectedTemplateId(undefined);
          }}
          onOk={handleSendEmail}
          okText="Gửi email"
          okButtonProps={{
            loading: emailLoading,
            disabled: !selectedTemplateId,
          }}
          cancelText="Hủy"
        >
          <div className="space-y-4">
            <div>
              <p className="mb-2">
                <strong>Khách hàng:</strong> {emailModal?.customerName}
              </p>
              <p className="mb-2">
                <strong>Email:</strong> {emailModal?.customerEmail}
              </p>
              <p className="mb-4">
                <strong>Trạng thái:</strong>{" "}
                <Tag color={statusColors[emailModal?.status || ""]}>
                  {statusLabels[emailModal?.status || ""]}
                </Tag>
              </p>
            </div>
            <div>
              <label className="block mb-2 font-medium">
                Chọn template email:
              </label>
              <Select
                placeholder="Chọn template..."
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
                style={{ width: "100%" }}
                options={emailTemplates.map((t) => ({
                  value: t.id,
                  label: (
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-gray-500">
                        {t.purpose} - {t.subject}
                      </div>
                    </div>
                  ),
                }))}
              />
            </div>
            {emailTemplates.length === 0 && (
              <p className="text-gray-500 text-sm">
                Không có template email nào được kích hoạt.
              </p>
            )}
          </div>
        </Modal>

        {/* Batch Action Modal */}
        <Modal
          title={
            batchAction === "confirm"
              ? `Xác nhận ${pendingSelectedOrders.length} đơn hàng`
              : batchAction === "reject"
                ? `Từ chối ${pendingSelectedOrders.length} đơn hàng`
                : `Gửi email cho ${selectedOrders.length} đơn hàng`
          }
          open={batchEmailModal}
          onCancel={() => {
            setBatchEmailModal(false);
            setSelectedTemplateId(undefined);
            setBatchAction(null);
          }}
          onOk={
            batchAction === "confirm"
              ? handleBatchConfirm
              : batchAction === "reject"
                ? handleBatchReject
                : handleBatchSendEmail
          }
          okText={
            batchAction === "confirm"
              ? "Xác nhận tất cả"
              : batchAction === "reject"
                ? "Từ chối tất cả"
                : "Gửi email tất cả"
          }
          okButtonProps={{
            loading: batchLoading,
            disabled: !selectedTemplateId,
            danger: batchAction === "reject",
          }}
          cancelText="Hủy"
        >
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Số đơn hàng được chọn:</strong>{" "}
                {batchAction === "email"
                  ? selectedOrders.length
                  : pendingSelectedOrders.length}
              </p>
              <div className="text-xs text-gray-500 max-h-24 overflow-y-auto">
                {(batchAction === "email"
                  ? selectedOrders
                  : pendingSelectedOrders
                ).map((o) => (
                  <span
                    key={o.id}
                    className="inline-block bg-white border rounded px-2 py-1 mr-1 mb-1"
                  >
                    {o.orderNumber}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <label className="block mb-2 font-medium">
                Chọn template email:
              </label>
              <Select
                placeholder="Chọn template..."
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
                style={{ width: "100%" }}
                options={emailTemplates.map((t) => ({
                  value: t.id,
                  label: (
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-gray-500">
                        {t.purpose} - {t.subject}
                      </div>
                    </div>
                  ),
                }))}
              />
            </div>
            {emailTemplates.length === 0 && (
              <p className="text-gray-500 text-sm">
                Không có template email nào được kích hoạt.
              </p>
            )}
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
