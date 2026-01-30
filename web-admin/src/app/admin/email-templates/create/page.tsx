"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin";
import {
  ArrowLeft,
  Save,
  Eye,
  X,
  AlertCircle,
  Info,
  Users,
  Shield,
} from "lucide-react";
import Link from "next/link";

const EMAIL_PURPOSE = {
  PAYMENT_PENDING: "PAYMENT_PENDING",
  PAYMENT_RECEIVED: "PAYMENT_RECEIVED",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  PAYMENT_REJECTED: "PAYMENT_REJECTED",
  TICKET_CONFIRMED: "TICKET_CONFIRMED",
  TICKET_CANCELLED: "TICKET_CANCELLED",
  EVENT_REMINDER: "EVENT_REMINDER",
  CHECKIN_CONFIRMATION: "CHECKIN_CONFIRMATION",
  ADMIN_NOTIFICATION: "ADMIN_NOTIFICATION",
} as const;

type EmailPurpose = (typeof EMAIL_PURPOSE)[keyof typeof EMAIL_PURPOSE];

interface PurposeInfo {
  key: EmailPurpose;
  title: string;
  description: string;
  recipient: "customer" | "admin" | "both";
  icon: string;
  color: string;
  requiredVars: string[];
}

const EMAIL_PURPOSE_INFO: Record<EmailPurpose, PurposeInfo> = {
  PAYMENT_PENDING: {
    key: "PAYMENT_PENDING",
    title: "Chờ thanh toán",
    description:
      "Gửi cho khách hàng ngay sau khi đặt vé, hướng dẫn chuyển khoản và cung cấp thông tin thanh toán.",
    recipient: "customer",
    icon: "⏳",
    color: "bg-yellow-100 text-yellow-800",
    requiredVars: [
      "customerName",
      "orderNumber",
      "totalAmount",
      "paymentDeadline",
      "bankName",
      "accountNumber",
      "accountName",
      "transferContent",
    ],
  },
  PAYMENT_RECEIVED: {
    key: "PAYMENT_RECEIVED",
    title: "Đã nhận thông tin thanh toán",
    description:
      "Thông báo cho admin rằng khách hàng đã gửi bằng chứng thanh toán và cần được xác nhận thủ công.",
    recipient: "admin",
    icon: "📥",
    color: "bg-blue-100 text-blue-800",
    requiredVars: [
      "orderNumber",
      "customerName",
      "customerEmail",
      "totalAmount",
      "submittedAt",
    ],
  },
  PAYMENT_CONFIRMED: {
    key: "PAYMENT_CONFIRMED",
    title: "Thanh toán thành công",
    description:
      "Gửi cho khách hàng khi admin xác nhận đã nhận tiền, vé bắt đầu có hiệu lực.",
    recipient: "customer",
    icon: "✅",
    color: "bg-green-100 text-green-800",
    requiredVars: ["customerName", "orderNumber", "totalAmount", "eventName"],
  },
  PAYMENT_REJECTED: {
    key: "PAYMENT_REJECTED",
    title: "Thanh toán bị từ chối",
    description:
      "Gửi cho khách hàng khi thanh toán không hợp lệ, yêu cầu thực hiện lại hoặc liên hệ hỗ trợ.",
    recipient: "customer",
    icon: "❌",
    color: "bg-red-100 text-red-800",
    requiredVars: ["customerName", "orderNumber", "reason"],
  },
  TICKET_CONFIRMED: {
    key: "TICKET_CONFIRMED",
    title: "Vé hợp lệ",
    description:
      "Gửi khi vé đã được kích hoạt, kèm thông tin ghế và QR check-in.",
    recipient: "customer",
    icon: "🎫",
    color: "bg-indigo-100 text-indigo-800",
    requiredVars: [
      "customerName",
      "eventName",
      "eventDate",
      "eventTime",
      "eventVenue",
      "orderNumber",
      "ticketUrl",
      "qrCodeUrl",
    ],
  },
  TICKET_CANCELLED: {
    key: "TICKET_CANCELLED",
    title: "Vé bị hủy",
    description:
      "Thông báo vé không còn hiệu lực do quá hạn thanh toán hoặc admin huỷ.",
    recipient: "customer",
    icon: "🚫",
    color: "bg-gray-100 text-gray-800",
    requiredVars: ["customerName", "orderNumber", "reason"],
  },
  EVENT_REMINDER: {
    key: "EVENT_REMINDER",
    title: "Nhắc lịch sự kiện",
    description:
      "Gửi trước ngày diễn ra sự kiện để nhắc khách tham dự, kèm thông tin địa điểm, thời gian.",
    recipient: "customer",
    icon: "🔔",
    color: "bg-purple-100 text-purple-800",
    requiredVars: [
      "customerName",
      "eventName",
      "eventDate",
      "eventTime",
      "eventVenue",
      "ticketUrl",
    ],
  },
  CHECKIN_CONFIRMATION: {
    key: "CHECKIN_CONFIRMATION",
    title: "Check-in thành công",
    description:
      "Gửi sau khi khách đã check-in tại sự kiện, dùng làm xác nhận tham dự.",
    recipient: "customer",
    icon: "✓",
    color: "bg-teal-100 text-teal-800",
    requiredVars: ["customerName", "eventName", "checkinTime", "seatNumber"],
  },
  ADMIN_NOTIFICATION: {
    key: "ADMIN_NOTIFICATION",
    title: "Thông báo nội bộ cho admin",
    description:
      "Gửi cho admin khi có sự kiện quan trọng (đơn mới, thanh toán mới, lỗi hệ thống).",
    recipient: "admin",
    icon: "🔔",
    color: "bg-orange-100 text-orange-800",
    requiredVars: ["subject", "message"],
  },
};

export default function CreateEmailTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingVars, setMissingVars] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    purpose: "" as EmailPurpose | "",
    name: "",
    subject: "",
    htmlContent: "",
  });

  const [previewHtml, setPreviewHtml] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMissingVars([]);

    if (
      !formData.purpose ||
      !formData.name ||
      !formData.subject ||
      !formData.htmlContent
    ) {
      setError("Vui lòng điền đầy đủ thông tin");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!data.success) {
        if (data.missingVariables) {
          setMissingVars(data.missingVariables);
        }
        setError(data.error || "Lỗi khi tạo template");
        return;
      }

      router.push("/admin/email-templates");
    } catch (err) {
      setError("Lỗi kết nối server");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    // Simple preview - replace variables with placeholders
    let html = formData.htmlContent;
    const vars = html.match(/\{\{(\w+)\}\}/g) || [];
    vars.forEach((v) => {
      const name = v.replace(/\{\{|\}\}/g, "");
      html = html.replace(
        new RegExp(v, "g"),
        `<span style="background:#fef3c7;padding:2px 4px;border-radius:2px;">[${name}]</span>`,
      );
    });
    setPreviewHtml(html);
    setPreviewOpen(true);
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/admin/email-templates"
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Tạo Email Template
            </h1>
            <p className="text-gray-600 mt-1">
              Tạo template mới cho hệ thống email
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-800">{error}</p>
                {missingVars.length > 0 && (
                  <p className="text-red-600 text-sm mt-1">
                    Variables còn thiếu:{" "}
                    {missingVars.map((v) => `{{${v}}}`).join(", ")}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            {/* Purpose */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mục đích <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.purpose}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    purpose: e.target.value as EmailPurpose,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e62b1e]"
                required
              >
                <option value="">Chọn mục đích...</option>
                {Object.entries(EMAIL_PURPOSE_INFO).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon} {info.title}
                  </option>
                ))}
              </select>

              {/* Purpose Info Box - readonly */}
              {formData.purpose && (
                <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                  {/* Header with icon and title */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">
                        {
                          EMAIL_PURPOSE_INFO[formData.purpose as EmailPurpose]
                            ?.icon
                        }
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-sm font-medium ${EMAIL_PURPOSE_INFO[formData.purpose as EmailPurpose]?.color}`}
                      >
                        {
                          EMAIL_PURPOSE_INFO[formData.purpose as EmailPurpose]
                            ?.title
                        }
                      </span>
                    </div>
                    {/* Recipient badge */}
                    {EMAIL_PURPOSE_INFO[formData.purpose as EmailPurpose]
                      ?.recipient === "customer" ? (
                      <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">
                        <Users className="w-3 h-3" />
                        Gửi cho: Khách hàng
                      </span>
                    ) : EMAIL_PURPOSE_INFO[formData.purpose as EmailPurpose]
                        ?.recipient === "admin" ? (
                      <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-orange-50 text-orange-700 border border-orange-200">
                        <Shield className="w-3 h-3" />
                        Gửi cho: Admin
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-50 text-purple-700 border border-purple-200">
                        <Users className="w-3 h-3" />
                        Gửi cho: Cả hai
                      </span>
                    )}
                  </div>

                  {/* Description - readonly */}
                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-800">
                        Khi nào email này được gửi?
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        {
                          EMAIL_PURPOSE_INFO[formData.purpose as EmailPurpose]
                            ?.description
                        }
                      </p>
                    </div>
                  </div>

                  {/* Required variables */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      Variables bắt buộc:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {EMAIL_PURPOSE_INFO[
                        formData.purpose as EmailPurpose
                      ]?.requiredVars.map((v) => (
                        <span
                          key={v}
                          className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-mono"
                        >
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên template <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e62b1e]"
                placeholder="VD: Xác nhận thanh toán - TEDx 2026"
                required
              />
            </div>

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tiêu đề email <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e62b1e]"
                placeholder="VD: [TEDx] Xác nhận thanh toán đơn hàng {{orderNumber}}"
                required
              />
            </div>

            {/* HTML Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nội dung HTML <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.htmlContent}
                onChange={(e) =>
                  setFormData({ ...formData, htmlContent: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e62b1e] font-mono text-sm"
                rows={15}
                placeholder="Nhập HTML template..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Sử dụng {"{{variableName}}"} để chèn biến động
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handlePreview}
              disabled={!formData.htmlContent}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-[#e62b1e] text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? "Đang lưu..." : "Lưu Template"}
            </button>
          </div>
        </form>

        {/* Preview Modal */}
        {previewOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold">Email Preview</h2>
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto">
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-full min-h-[500px] border-0"
                  title="Email Preview"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
