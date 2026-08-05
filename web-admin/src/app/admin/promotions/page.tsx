"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Tag } from "lucide-react";
import { Modal, Form, Input, InputNumber, Select, DatePicker, message, Switch } from "antd";
import { AdminLayout } from "@/components/admin";
import dayjs from "dayjs";

interface Promotion {
  id: string;
  event_id: string;
  name: string;
  type: string;
  discount_type: string;
  discount_value: number;
  code: string | null;
  min_tickets: number | null;
  max_tickets: number | null;
  start_date: string;
  end_date: string;
  max_usage: number | null;
  used_count: number;
  max_per_customer: number;
  ticket_type_ids: string | null;
  is_active: boolean;
}

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [events, setEvents] = useState<any[]>([]);
  const [ticketTypes, setTicketTypes] = useState<any[]>([]);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  
  const type = Form.useWatch("type", form);
  const isBulk = Form.useWatch("isBulk", form);

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (selectedEventId) {
      fetchPromotions(selectedEventId);
      fetchTicketTypes(selectedEventId);
    }
  }, [selectedEventId]);

  const fetchTicketTypes = async (eventId: string) => {
    try {
      const res = await fetch(`/api/admin/ticket-types?eventId=${eventId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await res.json();
      if (data.success) {
        setTicketTypes(data.data.ticketTypes || []);
      }
    } catch (error) {
      console.error("Failed to fetch ticket types:", error);
    }
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/admin/events", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch events");
      const data = await res.json();
      setEvents(data.data);
      if (data.data.length > 0) {
        setSelectedEventId(data.data[0].id);
      }
    } catch (error) {
      message.error("Failed to load events");
    }
  };

  const fetchPromotions = async (eventId: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/admin/promotions?eventId=${eventId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch promotions");
      const data = await res.json();
      setPromotions(data.data.promotions);
    } catch (error) {
      message.error("Failed to load promotions");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/promotions/${id}/toggle`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to toggle status");
      message.success("Promotion status updated");
      fetchPromotions(selectedEventId);
    } catch (error) {
      message.error("Failed to update status");
    }
  };

  const deletePromotion = async (id: string) => {
    if (!confirm("Are you sure you want to delete this promotion?")) return;
    try {
      const res = await fetch(`/api/admin/promotions/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!res.ok) throw new Error("Failed to delete");
      message.success("Promotion deleted");
      fetchPromotions(selectedEventId);
    } catch (error) {
      message.error("Failed to delete promotion");
    }
  };

  const handleEdit = (promo: Promotion) => {
    setEditingId(promo.id);
    form.setFieldsValue({
      name: promo.name,
      type: promo.type,
      discount_type: promo.discount_type,
      discount_value: promo.discount_value,
      code: promo.code,
      min_tickets: promo.min_tickets,
      max_tickets: promo.max_tickets,
      dateRange: [dayjs(promo.start_date), dayjs(promo.end_date)],
      max_usage: promo.max_usage,
      max_per_customer: promo.max_per_customer,
      ticket_type_ids: promo.ticket_type_ids ? JSON.parse(promo.ticket_type_ids) : [],
    });
    setIsModalVisible(true);
  };

  const handleCreate = async (values: any) => {
    try {
      setIsSubmitting(true);

      let codes: string[] | undefined = undefined;
      if (values.isBulk && values.codes_text) {
        codes = values.codes_text
          .split(/,|\n/)
          .map((c: string) => c.trim().toUpperCase())
          .filter(Boolean);
      }

      const payload: any = {
        eventId: selectedEventId,
        name: values.name,
        type: values.type,
        discountType: values.discount_type,
        discountValue: values.discount_value,
        minTickets: values.min_tickets || undefined,
        maxTickets: values.max_tickets || undefined,
        startDate: values.dateRange[0].toISOString(),
        endDate: values.dateRange[1].toISOString(),
        maxUsage: values.max_usage || undefined,
        maxPerCustomer: values.max_per_customer || 1,
        ticketTypeIds: values.ticket_type_ids?.length ? values.ticket_type_ids : undefined,
      };

      if (codes) {
        payload.codes = codes;
      } else {
        payload.code = values.code || undefined;
      }

      const url = editingId ? `/api/admin/promotions/${editingId}` : "/api/admin/promotions";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save promotion");
      
      message.success(editingId ? "Promotion updated successfully" : "Promotion created successfully");
      setIsModalVisible(false);
      setEditingId(null);
      form.resetFields();
      fetchPromotions(selectedEventId);
    } catch (error: any) {
      message.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Tag className="w-6 h-6 text-red-600" />
              Promotions & Discounts
            </h1>
            <p className="text-gray-600 mt-1">
              Manage discount codes, combo offers, and early bird pricing
            </p>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors shadow-sm"
            onClick={() => {
              setEditingId(null);
              form.resetFields();
              setIsModalVisible(true);
            }}
          >
            <Plus className="w-5 h-5" />
            Create Promotion
          </button>
        </div>

        <div className="bg-white rounded-xl shadow p-6 border border-gray-200">
          <div className="flex gap-4 items-center mb-6">
            <label className="text-sm font-medium text-gray-700">
              Select Event:
            </label>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-white border border-gray-300 text-gray-900 px-3 py-2 rounded-lg outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-colors"
            >
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>

          {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : promotions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No promotions found for this event.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 rounded-tl-lg">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Discount</th>
                    <th className="px-4 py-3">Validity</th>
                    <th className="px-4 py-3">Usage</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right rounded-tr-lg">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {promotions.map((promo) => (
                    <tr key={promo.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="font-medium text-gray-900">{promo.name}</div>
                        {promo.code && (
                          <div className="text-xs text-red-600 mt-1 font-mono bg-red-50 inline-block px-1.5 py-0.5 rounded">
                            Code: {promo.code}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium">
                          {promo.type.replace('_', ' ')}
                        </span>
                      </td>
                    <td className="px-4 py-4">
                      {promo.discount_type === 'PERCENTAGE' 
                        ? `${promo.discount_value}%` 
                        : `${new Intl.NumberFormat('vi-VN').format(promo.discount_value)}đ`}
                    </td>
                    <td className="px-4 py-4 text-xs">
                      <div>From: {new Date(promo.start_date).toLocaleDateString()}</div>
                      <div>To: {new Date(promo.end_date).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-4">
                      {promo.used_count} / {promo.max_usage || '∞'}
                    </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => toggleStatus(promo.id)}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            promo.is_active
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-red-100 text-red-700 hover:bg-red-200"
                          }`}
                        >
                          {promo.is_active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(promo)}
                            className="p-2 text-gray-400 hover:text-blue-600 transition-colors bg-white border border-gray-200 rounded-lg shadow-sm hover:border-blue-600"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deletePromotion(promo.id)}
                            className="p-2 text-gray-400 hover:text-red-600 transition-colors bg-white border border-gray-200 rounded-lg shadow-sm hover:border-red-600"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        title={editingId ? "Edit Promotion" : "Create Promotion"}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingId(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        confirmLoading={isSubmitting}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{
            discount_type: "PERCENTAGE",
            max_per_customer: 1,
            isBulk: false,
          }}
        >
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="name"
              label="Promotion Name"
              rules={[{ required: true, message: "Please enter name" }]}
              className="col-span-2"
            >
              <Input placeholder="e.g. Early Bird 2026" />
            </Form.Item>

            <Form.Item
              name="type"
              label="Type"
              rules={[{ required: true, message: "Please select type" }]}
            >
              <Select placeholder="Select type">
                <Select.Option value="PROMO_CODE">Promo Code</Select.Option>
                <Select.Option value="COMBO">Combo Tickets</Select.Option>
                <Select.Option value="EARLY_BIRD">Early Bird</Select.Option>
              </Select>
            </Form.Item>

            {type === "PROMO_CODE" && !editingId && (
              <Form.Item
                name="isBulk"
                label="Tạo hàng loạt mã cho Affiliate?"
                valuePropName="checked"
                className="col-span-2"
              >
                <Switch checkedChildren="Bật" unCheckedChildren="Tắt" />
              </Form.Item>
            )}

            {type === "PROMO_CODE" && (
              isBulk && !editingId ? (
                <Form.Item
                  name="codes_text"
                  label="Danh sách mã giảm giá"
                  rules={[{ required: true, message: "Vui lòng nhập danh sách mã" }]}
                  className="col-span-2"
                  help="Nhập các mã phân cách bằng dấu phẩy hoặc dòng mới. Ví dụ: AFF_KHOI, AFF_PHU, AFF_TUAN"
                >
                  <Input.TextArea placeholder="Nhập các mã giảm giá..." rows={4} />
                </Form.Item>
              ) : (
                <Form.Item
                  name="code"
                  label="Promo Code"
                  rules={[{ required: type === "PROMO_CODE", message: "Please enter code" }]}
                >
                  <Input placeholder="e.g. SUMMER26" />
                </Form.Item>
              )
            )}

            <Form.Item
              name="discount_type"
              label="Discount Type"
              rules={[{ required: true }]}
            >
              <Select>
                <Select.Option value="PERCENTAGE">Percentage (%)</Select.Option>
                <Select.Option value="FIXED_AMOUNT">Fixed Amount (VND)</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              name="discount_value"
              label="Discount Value"
              rules={[{ required: true, message: "Please enter value" }]}
            >
              <InputNumber className="w-full" min={0} />
            </Form.Item>

            <Form.Item name="min_tickets" label="Min Tickets (for Combo)">
              <InputNumber className="w-full" min={1} disabled={type !== "COMBO"} />
            </Form.Item>
            <Form.Item name="max_tickets" label="Max Tickets (for Combo)">
              <InputNumber className="w-full" min={1} disabled={type !== "COMBO"} />
            </Form.Item>

            <Form.Item
              name="dateRange"
              label="Validity Period"
              rules={[{ required: true, message: "Please select dates" }]}
              className="col-span-2"
            >
              <DatePicker.RangePicker className="w-full" showTime />
            </Form.Item>

            <Form.Item name="max_usage" label="Total Max Usage (Optional)">
              <InputNumber className="w-full" min={1} placeholder="Unlimited" />
            </Form.Item>

            <Form.Item name="max_per_customer" label="Max Uses Per Customer">
              <InputNumber className="w-full" min={1} />
            </Form.Item>

            <Form.Item
              name="ticket_type_ids"
              label="Áp dụng cho loại vé (để trống nếu áp dụng tất cả)"
              className="col-span-2"
            >
              <Select
                mode="multiple"
                placeholder="Chọn loại vé áp dụng..."
                options={ticketTypes.map((t) => ({ value: t.id, label: t.name }))}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </AdminLayout>
  );
}
