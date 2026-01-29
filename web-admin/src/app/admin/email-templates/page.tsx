"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin";
import { Mail, Plus, Pencil, Trash2, Eye, X, Check, Send } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  text_content: string | null;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(
    null,
  );
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(
    null,
  );
  const [testTemplate, setTestTemplate] = useState<EmailTemplate | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Sample data for preview
  const sampleData: Record<string, string> = {
    orderCode: "TDX-2026-ABC123",
    customerName: "Nguyễn Văn A",
    customerEmail: "nguyenvana@email.com",
    eventName: "TEDxFPTUniversityHCMC 2026",
    eventDate: "15/03/2026",
    eventTime: "18:00",
    eventLocation: "Nhà hát Thành phố Hồ Chí Minh",
    seats: "A1, A2, A3",
    totalAmount: "7,500,000 ₫",
    paymentDeadline: "20/02/2026 23:59",
    bankName: "Vietcombank",
    bankAccount: "1234567890",
    bankAccountName: "TEDX FPT UNIVERSITY HCMC",
    transferContent: "TDX-2026-ABC123",
    qrCodeUrl:
      "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TDX-2026-ABC123",
    ticketUrl: "https://tedxfptuhcm.com/ticket/TDX-2026-ABC123",
  };

  // Replace variables in content with sample data
  const replaceVariables = (content: string): string => {
    let result = content;
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      result = result.replace(regex, value);
    });
    return result;
  };

  // Send test email
  const handleSendTest = async () => {
    if (!testTemplate || !testEmail) return;

    setSendingTest(true);
    setTestResult(null);

    try {
      const res = await fetch(
        `/api/admin/email-templates/${testTemplate.id}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: testEmail }),
        },
      );
      const data = await res.json();

      if (data.success) {
        setTestResult({
          success: true,
          message: `Email đã gửi đến ${testEmail}!`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || "Gửi email thất bại",
        });
      }
    } catch (error) {
      setTestResult({ success: false, message: "Lỗi khi gửi email test" });
    } finally {
      setSendingTest(false);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    subject: "",
    html_content: "",
    text_content: "",
    variables: "",
    is_active: true,
  });

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/email-templates");
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
  }, []);

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({
      name: "",
      subject: "",
      html_content: "",
      text_content: "",
      variables: "",
      is_active: true,
    });
    setShowModal(true);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      html_content: template.html_content,
      text_content: template.text_content || "",
      variables: template.variables.join(", "),
      is_active: template.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    try {
      const res = await fetch(`/api/admin/email-templates/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchTemplates();
      }
    } catch (error) {
      console.error("Failed to delete template:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const body = {
      ...formData,
      variables: formData.variables
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    };

    try {
      const url = editingTemplate
        ? `/api/admin/email-templates/${editingTemplate.id}`
        : "/api/admin/email-templates";

      const res = await fetch(url, {
        method: editingTemplate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShowModal(false);
        fetchTemplates();
      }
    } catch (error) {
      console.error("Failed to save template:", error);
    }
  };

  const handleToggleActive = async (template: EmailTemplate) => {
    try {
      await fetch(`/api/admin/email-templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !template.is_active }),
      });
      fetchTemplates();
    } catch (error) {
      console.error("Failed to toggle template:", error);
    }
  };

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
              Manage email templates for notifications
            </p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 px-4 py-2 bg-[#e62b1e] text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              Loading...
            </div>
          ) : templates.length === 0 ? (
            <div className="col-span-full text-center py-8 text-gray-500">
              No templates found
            </div>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                <div className="p-4 border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#e62b1e]/10 rounded-lg flex items-center justify-center">
                        <Mail className="w-5 h-5 text-[#e62b1e]" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {template.name}
                        </h3>
                        <p className="text-sm text-gray-500 truncate max-w-[200px]">
                          {template.subject}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleActive(template)}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        template.is_active
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {template.is_active ? "Active" : "Inactive"}
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-xs text-gray-500 mb-3">
                    Variables:{" "}
                    {template.variables.length > 0
                      ? template.variables.join(", ")
                      : "None"}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPreviewTemplate(template)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      <Eye className="w-4 h-4" /> Preview
                    </button>
                    <button
                      onClick={() => {
                        setTestTemplate(template);
                        setTestEmail("");
                        setTestResult(null);
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors"
                    >
                      <Send className="w-4 h-4" /> Test
                    </button>
                    <button
                      onClick={() => handleEdit(template)}
                      className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded transition-colors"
                    >
                      <Pencil className="w-4 h-4" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="px-3 py-2 text-sm bg-red-100 text-red-700 hover:bg-red-200 rounded transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {editingTemplate ? "Edit Template" : "New Template"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#e62b1e] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#e62b1e] focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  HTML Content
                </label>
                <textarea
                  value={formData.html_content}
                  onChange={(e) =>
                    setFormData({ ...formData, html_content: e.target.value })
                  }
                  rows={8}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#e62b1e] focus:outline-none font-mono text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Variables (comma-separated)
                </label>
                <input
                  type="text"
                  value={formData.variables}
                  onChange={(e) =>
                    setFormData({ ...formData, variables: e.target.value })
                  }
                  placeholder="customer_name, order_number, event_name"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#e62b1e] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData({ ...formData, is_active: e.target.checked })
                  }
                  className="rounded"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Active
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-[#e62b1e] text-white rounded-lg hover:bg-red-700"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Preview: {previewTemplate.name}
              </h2>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Subject:</strong> {previewTemplate.subject}
              </p>
              <div
                className="border rounded-lg p-4 bg-gray-50"
                dangerouslySetInnerHTML={{
                  __html: replaceVariables(previewTemplate.html_content),
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Test Email Modal */}
      {testTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Test Email: {testTemplate.name}
              </h2>
              <button
                onClick={() => setTestTemplate(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Gửi email test với dữ liệu mẫu đến địa chỉ email của bạn.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email nhận test
                </label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e62b1e]"
                />
              </div>

              {testResult && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    testResult.success
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {testResult.message}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setTestTemplate(null)}
                  className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSendTest}
                  disabled={!testEmail || sendingTest}
                  className="flex-1 px-4 py-2 bg-[#e62b1e] text-white rounded-lg hover:bg-[#c42419] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sendingTest ? (
                    <>
                      <span className="animate-spin">⏳</span> Đang gửi...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Gửi Test
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
