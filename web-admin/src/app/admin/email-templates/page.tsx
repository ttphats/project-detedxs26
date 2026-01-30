"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin";
import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  Eye,
  X,
  Check,
  Send,
  Copy,
  Power,
  PowerOff,
  Filter,
  ChevronDown,
  Users,
  Shield,
  Info,
} from "lucide-react";
import Link from "next/link";

// Email purposes with full metadata - synced with backend types.ts
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
  },
  PAYMENT_RECEIVED: {
    key: "PAYMENT_RECEIVED",
    title: "Đã nhận thông tin thanh toán",
    description:
      "Thông báo cho admin rằng khách hàng đã gửi bằng chứng thanh toán và cần được xác nhận thủ công.",
    recipient: "admin",
    icon: "📥",
    color: "bg-blue-100 text-blue-800",
  },
  PAYMENT_CONFIRMED: {
    key: "PAYMENT_CONFIRMED",
    title: "Thanh toán thành công",
    description:
      "Gửi cho khách hàng khi admin xác nhận đã nhận tiền, vé bắt đầu có hiệu lực.",
    recipient: "customer",
    icon: "✅",
    color: "bg-green-100 text-green-800",
  },
  PAYMENT_REJECTED: {
    key: "PAYMENT_REJECTED",
    title: "Thanh toán bị từ chối",
    description:
      "Gửi cho khách hàng khi thanh toán không hợp lệ, yêu cầu thực hiện lại hoặc liên hệ hỗ trợ.",
    recipient: "customer",
    icon: "❌",
    color: "bg-red-100 text-red-800",
  },
  TICKET_CONFIRMED: {
    key: "TICKET_CONFIRMED",
    title: "Vé hợp lệ",
    description:
      "Gửi khi vé đã được kích hoạt, kèm thông tin ghế và QR check-in.",
    recipient: "customer",
    icon: "🎫",
    color: "bg-indigo-100 text-indigo-800",
  },
  TICKET_CANCELLED: {
    key: "TICKET_CANCELLED",
    title: "Vé bị hủy",
    description:
      "Thông báo vé không còn hiệu lực do quá hạn thanh toán hoặc admin huỷ.",
    recipient: "customer",
    icon: "🚫",
    color: "bg-gray-100 text-gray-800",
  },
  EVENT_REMINDER: {
    key: "EVENT_REMINDER",
    title: "Nhắc lịch sự kiện",
    description:
      "Gửi trước ngày diễn ra sự kiện để nhắc khách tham dự, kèm thông tin địa điểm, thời gian.",
    recipient: "customer",
    icon: "🔔",
    color: "bg-purple-100 text-purple-800",
  },
  CHECKIN_CONFIRMATION: {
    key: "CHECKIN_CONFIRMATION",
    title: "Check-in thành công",
    description:
      "Gửi sau khi khách đã check-in tại sự kiện, dùng làm xác nhận tham dự.",
    recipient: "customer",
    icon: "✓",
    color: "bg-teal-100 text-teal-800",
  },
  ADMIN_NOTIFICATION: {
    key: "ADMIN_NOTIFICATION",
    title: "Thông báo nội bộ cho admin",
    description:
      "Gửi cho admin khi có sự kiện quan trọng (đơn mới, thanh toán mới, lỗi hệ thống).",
    recipient: "admin",
    icon: "🔔",
    color: "bg-orange-100 text-orange-800",
  },
};

const PURPOSE_LABELS: Record<EmailPurpose, string> = Object.fromEntries(
  Object.entries(EMAIL_PURPOSE_INFO).map(([key, info]) => [key, info.title]),
) as Record<EmailPurpose, string>;

interface EmailTemplate {
  id: string;
  purpose: EmailPurpose;
  name: string;
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
  const [filterPurpose, setFilterPurpose] = useState<EmailPurpose | "ALL">(
    "ALL",
  );
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      let url = "/api/admin/email-templates";
      if (filterPurpose !== "ALL") {
        url += `?purpose=${filterPurpose}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch templates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, [filterPurpose]);

  const handlePreview = async (id: string) => {
    setLoadingPreview(id);
    try {
      const res = await fetch(`/api/admin/email-templates/${id}/preview`);
      const html = await res.text();
      setPreviewHtml(html);
      setPreviewOpen(true);
    } catch (error) {
      console.error("Failed to preview:", error);
    } finally {
      setLoadingPreview(null);
    }
  };

  const handleActivate = async (id: string) => {
    try {
      await fetch(`/api/admin/email-templates/${id}/activate`, {
        method: "POST",
      });
      fetchTemplates();
    } catch (error) {
      console.error("Failed to activate:", error);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await fetch(`/api/admin/email-templates/${id}/activate`, {
        method: "DELETE",
      });
      fetchTemplates();
    } catch (error) {
      console.error("Failed to deactivate:", error);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Xóa template "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/email-templates/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error);
        return;
      }
      fetchTemplates();
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  // Group templates by purpose
  const groupedTemplates = templates.reduce(
    (acc, t) => {
      if (!acc[t.purpose]) acc[t.purpose] = [];
      acc[t.purpose].push(t);
      return acc;
    },
    {} as Record<EmailPurpose, EmailTemplate[]>,
  );

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
              Quản lý email templates theo mục đích sử dụng
            </p>
          </div>
          <Link
            href="/admin/email-templates/create"
            className="flex items-center gap-2 px-4 py-2 bg-[#e62b1e] text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Tạo Template
          </Link>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-600">Lọc theo mục đích:</span>
          </div>
          <select
            value={filterPurpose}
            onChange={(e) =>
              setFilterPurpose(e.target.value as EmailPurpose | "ALL")
            }
            className="px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#e62b1e]"
          >
            <option value="ALL">Tất cả</option>
            {Object.entries(PURPOSE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {/* Templates List */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">Đang tải...</div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Chưa có email template nào</p>
            <Link
              href="/admin/email-templates/create"
              className="text-[#e62b1e] hover:underline mt-2 inline-block"
            >
              Tạo template đầu tiên
            </Link>
          </div>
        ) : filterPurpose === "ALL" ? (
          // Grouped view
          <div className="space-y-8">
            {Object.entries(EMAIL_PURPOSE_INFO).map(([purpose, info]) => {
              const purposeTemplates =
                groupedTemplates[purpose as EmailPurpose] || [];
              if (purposeTemplates.length === 0) return null;

              return (
                <div key={purpose}>
                  {/* Purpose Header with Description */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-2xl">{info.icon}</span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${info.color}`}
                          >
                            {info.title}
                          </span>
                          <span className="px-2 py-1 rounded text-xs font-mono bg-gray-200 text-gray-600">
                            {purpose}
                          </span>
                          <span className="text-sm text-gray-500">
                            {purposeTemplates.length} template
                            {purposeTemplates.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 flex items-start gap-2">
                          <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                          <span>{info.description}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {info.recipient === "customer" ? (
                          <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">
                            <Users className="w-3 h-3" />
                            Khách hàng
                          </span>
                        ) : info.recipient === "admin" ? (
                          <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-orange-50 text-orange-700">
                            <Shield className="w-3 h-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-50 text-purple-700">
                            <Users className="w-3 h-3" />
                            Tất cả
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Tên
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Subject
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                            Version
                          </th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                            Trạng thái
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Cập nhật
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Thao tác
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {purposeTemplates.map((t) => (
                          <tr
                            key={t.id}
                            className={t.isActive ? "bg-green-50/50" : ""}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">
                                {t.name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                              {t.subject}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="text-sm text-gray-500">
                                v{t.version}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {t.isActive ? (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                                  Draft
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {new Date(t.updatedAt).toLocaleDateString(
                                "vi-VN",
                              )}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handlePreview(t.id)}
                                  className="p-1.5 hover:bg-gray-100 rounded"
                                  title="Preview"
                                >
                                  {loadingPreview === t.id ? (
                                    <span className="animate-spin text-xs">
                                      ⏳
                                    </span>
                                  ) : (
                                    <Eye className="w-4 h-4 text-gray-600" />
                                  )}
                                </button>
                                <Link
                                  href={`/admin/email-templates/${t.id}`}
                                  className="p-1.5 hover:bg-gray-100 rounded"
                                  title="Edit"
                                >
                                  <Pencil className="w-4 h-4 text-gray-600" />
                                </Link>
                                {t.isActive ? (
                                  <button
                                    onClick={() => handleDeactivate(t.id)}
                                    className="p-1.5 hover:bg-red-50 rounded"
                                    title="Deactivate"
                                  >
                                    <PowerOff className="w-4 h-4 text-red-600" />
                                  </button>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleActivate(t.id)}
                                      className="p-1.5 hover:bg-green-50 rounded"
                                      title="Activate"
                                    >
                                      <Power className="w-4 h-4 text-green-600" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(t.id, t.name)}
                                      className="p-1.5 hover:bg-red-50 rounded"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // Flat list for filtered view
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tên
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Subject
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Version
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cập nhật
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {templates.map((t) => (
                  <tr key={t.id} className={t.isActive ? "bg-green-50/50" : ""}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{t.name}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                      {t.subject}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm text-gray-500">
                        v{t.version}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.isActive ? (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(t.updatedAt).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handlePreview(t.id)}
                          className="p-1.5 hover:bg-gray-100 rounded"
                          title="Preview"
                        >
                          {loadingPreview === t.id ? (
                            <span className="animate-spin text-xs">⏳</span>
                          ) : (
                            <Eye className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                        <Link
                          href={`/admin/email-templates/${t.id}`}
                          className="p-1.5 hover:bg-gray-100 rounded"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4 text-gray-600" />
                        </Link>
                        {t.isActive ? (
                          <button
                            onClick={() => handleDeactivate(t.id)}
                            className="p-1.5 hover:bg-red-50 rounded"
                            title="Deactivate"
                          >
                            <PowerOff className="w-4 h-4 text-red-600" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleActivate(t.id)}
                              className="p-1.5 hover:bg-green-50 rounded"
                              title="Activate"
                            >
                              <Power className="w-4 h-4 text-green-600" />
                            </button>
                            <button
                              onClick={() => handleDelete(t.id, t.name)}
                              className="p-1.5 hover:bg-red-50 rounded"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
