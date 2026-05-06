"use client";

import { useState } from "react";
import { AdminLayout } from "@/components/admin";
import { Card, Button, Modal, message, Alert, Space, Divider } from "antd";
import {
  ExclamationCircleOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  WarningOutlined,
} from "@ant-design/icons";

export default function SettingsPage() {
  const [resetLoading, setResetLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);

  const handleResetData = async () => {
    setResetLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/admin/settings/reset-data", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Reset data failed");
      }

      message.success(
        "Reset data thành công! Database đã về trạng thái mặc định.",
      );
      setConfirmModal(false);

      // Reload page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      message.error(error.message || "Có lỗi xảy ra khi reset data");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Cài đặt hệ thống</h1>

        {/* Database Management */}
        <Card title="Quản lý Database" className="mb-6">
          <Alert
            title="Cảnh báo"
            description="Reset data sẽ xóa tất cả đơn hàng, seat locks và khôi phục về trạng thái mặc định. Thao tác này không thể hoàn tác!"
            type="warning"
            icon={<WarningOutlined />}
            showIcon
            className="mb-4"
          />

          <div className="mb-4">
            <h3 className="font-semibold mb-2">Reset Data sẽ:</h3>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>✅ Giữ nguyên: Events, Ticket Types, Email Templates</li>
              <li>✅ Giữ nguyên: Tài khoản admin và users</li>
              <li>🗑️ Xóa tất cả: Orders (đơn hàng)</li>
              <li>🗑️ Xóa tất cả: Seat Locks (ghế đang giữ)</li>
              <li>🗑️ Xóa tất cả: Email Logs</li>
              <li>🗑️ Xóa tất cả: Layout Versions (phiên bản layout)</li>
              <li>
                🔄 Reset: Tạo lại 100 ghế mới (10 rows x 10 seats với LEFT/RIGHT
                sections) - Tất cả ghế có vé Level 1 (rẻ nhất)
              </li>
            </ul>
          </div>

          <Button
            type="primary"
            danger
            size="large"
            icon={<ReloadOutlined />}
            onClick={() => setConfirmModal(true)}
          >
            Reset Data về V1
          </Button>
        </Card>

        {/* Database Info */}
        <Card title="Thông tin Database" icon={<DatabaseOutlined />}>
          <Space orientation="vertical" size="small">
            <div>
              <strong>Môi trường:</strong>{" "}
              {process.env.NODE_ENV || "development"}
            </div>
            <div>
              <strong>Database:</strong> MySQL
            </div>
          </Space>
        </Card>

        {/* Confirmation Modal */}
        <Modal
          title={
            <Space>
              <ExclamationCircleOutlined
                style={{ color: "#ff4d4f", fontSize: 24 }}
              />
              <span>Xác nhận Reset Data</span>
            </Space>
          }
          open={confirmModal}
          onCancel={() => setConfirmModal(false)}
          footer={[
            <Button key="cancel" onClick={() => setConfirmModal(false)}>
              Hủy
            </Button>,
            <Button
              key="confirm"
              type="primary"
              danger
              loading={resetLoading}
              onClick={handleResetData}
            >
              Xác nhận Reset
            </Button>,
          ]}
        >
          <Alert
            title="Cảnh báo nghiêm trọng"
            description="Bạn có chắc chắn muốn reset tất cả data về trạng thái mặc định? Thao tác này sẽ XÓA TẤT CẢ đơn hàng và không thể hoàn tác!"
            type="error"
            showIcon
            className="mb-4"
          />
          <p className="text-gray-600">
            Vui lòng gõ <strong className="text-red-500">RESET</strong> để xác
            nhận (tính năng này sẽ được thêm vào sau)
          </p>
        </Modal>
      </div>
    </AdminLayout>
  );
}
