"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin";
import { ArrowLeft, Save, Eye, X, AlertCircle, Info } from "lucide-react";
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
  suggestedVars: string[];
}

const CATEGORY_INFO: Record<TemplateCategory, CategoryInfo> = {
  ORDER: {
    key: "ORDER",
    title: "Đơn hàng",
    description:
      "Templates liên quan đến đơn hàng, thanh toán, xác nhận vé, từ chối thanh toán.",
    icon: "🛒",
    color: "bg-blue-100 text-blue-800",
    suggestedVars: [
      "customerName",
      "orderNumber",
      "totalAmount",
      "eventName",
      "ticketUrl",
      "qrCodeUrl",
    ],
  },
  EVENT: {
    key: "EVENT",
    title: "Sự kiện",
    description:
      "Templates về nhắc lịch sự kiện, check-in, thông báo trước/sau sự kiện.",
    icon: "📅",
    color: "bg-purple-100 text-purple-800",
    suggestedVars: [
      "customerName",
      "eventName",
      "eventDate",
      "eventTime",
      "eventVenue",
    ],
  },
  NOTIFICATION: {
    key: "NOTIFICATION",
    title: "Thông báo",
    description:
      "Templates thông báo cho admin hoặc hệ thống (đơn mới, thanh toán, lỗi).",
    icon: "🔔",
    color: "bg-orange-100 text-orange-800",
    suggestedVars: ["subject", "message", "orderNumber", "timestamp"],
  },
  GENERAL: {
    key: "GENERAL",
    title: "Chung",
    description:
      "Templates dùng chung, linh hoạt cho nhiều mục đích khác nhau.",
    icon: "📧",
    color: "bg-gray-100 text-gray-800",
    suggestedVars: ["recipientName", "content"],
  },
};

export default function CreateEmailTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    category: "GENERAL" as TemplateCategory,
    name: "",
    description: "",
    subject: "",
    htmlContent: "",
  });

  const [previewHtml, setPreviewHtml] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name || !formData.subject || !formData.htmlContent) {
      setError(
        "Vui lòng điền đầy đủ thông tin bắt buộc (tên, tiêu đề, nội dung)",
      );
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
        setError(data.error || "Lỗi khi tạo template");
        return;
      }

      router.push("/admin/email-templates");
    } catch {
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
              Tạo template tự do - không bắt buộc mục đích cố định
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-red-800">{error}</p>
            </div>
          )}

          <div className="bg-white rounded-lg shadow p-6 space-y-4">
            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Danh mục
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value as TemplateCategory,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e62b1e]"
              >
                {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon} {info.title}
                  </option>
                ))}
              </select>

              {/* Category Info Box */}
              {formData.category && (
                <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                  {/* Header with icon and title */}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {CATEGORY_INFO[formData.category]?.icon}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-sm font-medium ${CATEGORY_INFO[formData.category]?.color}`}
                    >
                      {CATEGORY_INFO[formData.category]?.title}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-sm text-blue-700">
                      {CATEGORY_INFO[formData.category]?.description}
                    </p>
                  </div>

                  {/* Suggested variables */}
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      Biến gợi ý (không bắt buộc):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {CATEGORY_INFO[formData.category]?.suggestedVars.map(
                        (v) => (
                          <span
                            key={v}
                            className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-mono cursor-pointer hover:bg-gray-300"
                            onClick={() => {
                              const varText = `{{${v}}}`;
                              setFormData({
                                ...formData,
                                htmlContent: formData.htmlContent + varText,
                              });
                            }}
                            title="Click để thêm vào nội dung"
                          >
                            {`{{${v}}}`}
                          </span>
                        ),
                      )}
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

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mô tả
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e62b1e]"
                placeholder="Mô tả ngắn về template này (không bắt buộc)"
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
