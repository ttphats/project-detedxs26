"use client";

import React, { useEffect, useState } from "react";
import {
  Table,
  Input,
  Select,
  Space,
  Tag,
  Card,
  Statistic,
  Row,
  Col,
  message,
} from "antd";
import {
  UserOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { AdminLayout } from "@/components/admin";

const { Search } = Input;
const { Option } = Select;

interface Customer {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  event_id: string;
  event_name: string;
  total_amount: number;
  seat_count: number;
  seat_numbers: string;
  status: string;
  checked_in: boolean;
  checked_in_at: string | null;
  checked_in_by: string | null;
  checked_in_by_name: string | null;
  created_at: string;
  paid_at: string;
}

interface Event {
  id: string;
  name: string;
}

interface Stats {
  total: number;
  checkedIn: number;
  pending: number;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    checkedIn: 0,
    pending: 0,
  });
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [searchText, setSearchText] = useState("");

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (selectedEvent) params.append("eventId", selectedEvent);
      if (searchText) params.append("search", searchText);

      const response = await fetch(
        `/api/admin/customers?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const result = await response.json();

      if (result.success) {
        setCustomers(result.data.customers);
        setEvents(result.data.events);
        setStats(result.data.stats);

        // Auto-select first event if none selected
        if (!selectedEvent && result.data.events.length > 0) {
          setSelectedEvent(result.data.events[0].id);
        }
      } else {
        message.error(result.error || "Failed to fetch customers");
      }
    } catch (error) {
      console.error("Fetch customers error:", error);
      message.error("Có lỗi xảy ra khi tải danh sách khách hàng");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [selectedEvent]);

  const handleSearch = async (value: string) => {
    setSearchText(value);
    // Fetch immediately with new search text
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      if (selectedEvent) params.append("eventId", selectedEvent);
      if (value) params.append("search", value);

      const response = await fetch(
        `/api/admin/customers?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const result = await response.json();

      if (result.success) {
        setCustomers(result.data.customers);
        setEvents(result.data.events);
        setStats(result.data.stats);
      } else {
        message.error(result.error || "Không thể tải danh sách khách hàng");
      }
    } catch (error) {
      console.error("Fetch customers error:", error);
      message.error("Có lỗi xảy ra khi tải danh sách khách hàng");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: "Mã đơn",
      dataIndex: "order_number",
      key: "order_number",
      width: 110,
      fixed: "left" as const,
      render: (text: string) => (
        <span style={{ fontFamily: "monospace", fontWeight: 500 }}>{text}</span>
      ),
    },
    {
      title: "Khách hàng",
      key: "customer",
      width: 200,
      render: (_: any, record: Customer) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.customer_name}</div>
          <div style={{ fontSize: "12px", color: "#888" }}>
            {record.customer_email}
          </div>
          <div style={{ fontSize: "12px", color: "#888" }}>
            {record.customer_phone}
          </div>
        </div>
      ),
    },
    {
      title: "Ghế",
      key: "seats",
      width: 160,
      render: (_: any, record: Customer) => (
        <div>
          <div style={{ fontWeight: 500 }}>{record.seat_count} ghế</div>
          <div style={{ fontSize: "12px", color: "#666" }}>
            {record.seat_numbers}
          </div>
        </div>
      ),
    },
    {
      title: "Tổng tiền",
      dataIndex: "total_amount",
      key: "total_amount",
      width: 130,
      render: (amount: number) => (
        <span style={{ fontWeight: 500 }}>
          {new Intl.NumberFormat("vi-VN", {
            style: "currency",
            currency: "VND",
          }).format(amount)}
        </span>
      ),
    },
    {
      title: "Trạng thái",
      key: "checked_in",
      width: 120,
      render: (_: any, record: Customer) =>
        record.checked_in ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            Đã check-in
          </Tag>
        ) : (
          <Tag icon={<ClockCircleOutlined />} color="default">
            Chưa check-in
          </Tag>
        ),
    },
    {
      title: "Người check-in",
      key: "checked_in_by",
      width: 130,
      render: (_: any, record: Customer) =>
        record.checked_in_by_name ? (
          <span>{record.checked_in_by_name}</span>
        ) : (
          <span style={{ color: "#999" }}>-</span>
        ),
    },
    {
      title: "Thời gian check-in",
      dataIndex: "checked_in_at",
      key: "checked_in_at",
      width: 150,
      render: (date: string | null) =>
        date ? (
          dayjs(date).format("DD/MM/YYYY HH:mm")
        ) : (
          <span style={{ color: "#999" }}>-</span>
        ),
    },
    {
      title: "Ngày mua",
      dataIndex: "paid_at",
      key: "paid_at",
      width: 150,
      render: (date: string) => dayjs(date).format("DD/MM/YYYY HH:mm"),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">
            <UserOutlined /> Quản lý khách hàng
          </h1>
        </div>

        {/* Stats */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Tổng khách hàng"
                value={stats.total}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Đã check-in"
                value={stats.checkedIn}
                prefix={<CheckCircleOutlined />}
                style={{ color: "#52c41a" }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={8}>
            <Card>
              <Statistic
                title="Chưa check-in"
                value={stats.pending}
                prefix={<ClockCircleOutlined />}
                style={{ color: "#faad14" }}
              />
            </Card>
          </Col>
        </Row>

        {/* Filters */}
        <Card>
          <Space size="middle" style={{ width: "100%" }}>
            <Select
              style={{ width: 250 }}
              placeholder="Chọn sự kiện"
              allowClear
              value={selectedEvent || undefined}
              onChange={(value) => setSelectedEvent(value || "")}
            >
              {events.map((event) => (
                <Option key={event.id} value={event.id}>
                  {event.name}
                </Option>
              ))}
            </Select>

            <Search
              placeholder="Tìm theo tên, email, SĐT, mã đơn..."
              allowClear
              enterButton="Tìm kiếm"
              style={{ width: 400 }}
              onSearch={handleSearch}
            />
          </Space>
        </Card>

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={customers}
            rowKey="id"
            loading={loading}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} khách hàng`,
            }}
            scroll={{ x: "max-content" }}
          />
        </Card>
      </div>
    </AdminLayout>
  );
}
