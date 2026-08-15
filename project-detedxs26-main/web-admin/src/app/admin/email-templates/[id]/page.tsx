'use client'

import {useEffect, useState} from 'react'
import {useParams, useRouter} from 'next/navigation'
import {AdminLayout} from '@/components/admin'
import {ArrowLeft, Save, Eye, X, AlertCircle, Info, Power, PowerOff, Loader2} from 'lucide-react'
import Link from 'next/link'
import {message} from 'antd'

// Template categories - flexible system
const TEMPLATE_CATEGORIES = ['ORDER', 'EVENT', 'NOTIFICATION', 'GENERAL'] as const
type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

interface CategoryInfo {
  key: TemplateCategory
  title: string
  description: string
  icon: string
  color: string
  suggestedVars: string[]
}

const CATEGORY_INFO: Record<TemplateCategory, CategoryInfo> = {
  ORDER: {
    key: 'ORDER',
    title: 'Đơn hàng',
    description: 'Templates liên quan đến đơn hàng, thanh toán, xác nhận vé.',
    icon: '🛒',
    color: 'bg-blue-100 text-blue-800',
    suggestedVars: [
      'customerName',
      'orderNumber',
      'totalAmount',
      'eventName',
      'ticketUrl',
      'qrCodeUrl',
    ],
  },
  EVENT: {
    key: 'EVENT',
    title: 'Sự kiện',
    description: 'Templates về nhắc lịch sự kiện, check-in, thông báo.',
    icon: '📅',
    color: 'bg-purple-100 text-purple-800',
    suggestedVars: ['customerName', 'eventName', 'eventDate', 'eventTime', 'eventVenue'],
  },
  NOTIFICATION: {
    key: 'NOTIFICATION',
    title: 'Thông báo',
    description: 'Templates thông báo cho admin hoặc hệ thống.',
    icon: '🔔',
    color: 'bg-orange-100 text-orange-800',
    suggestedVars: ['subject', 'message', 'orderNumber', 'timestamp'],
  },
  GENERAL: {
    key: 'GENERAL',
    title: 'Chung',
    description: 'Templates dùng chung, linh hoạt.',
    icon: '📧',
    color: 'bg-gray-100 text-gray-800',
    suggestedVars: ['recipientName', 'content'],
  },
}

interface EmailTemplate {
  id: string
  category: TemplateCategory
  name: string
  description: string | null
  subject: string
  htmlContent: string
  textContent: string | null
  variables: string[]
  isActive: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export default function EditEmailTemplatePage() {
  const params = useParams()
  const router = useRouter()
  const templateId = params.id as string

  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    category: 'GENERAL' as TemplateCategory,
    name: '',
    description: '',
    subject: '',
    htmlContent: '',
  })

  const [previewHtml, setPreviewHtml] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)

  useEffect(() => {
    fetchTemplate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId])

  const fetchTemplate = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/email-templates/${templateId}`, {
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (data.success) {
        setTemplate(data.data)
        setFormData({
          category: data.data.category || 'GENERAL',
          name: data.data.name,
          description: data.data.description || '',
          subject: data.data.subject,
          htmlContent: data.data.htmlContent,
        })
      } else {
        setError(data.error || 'Không tìm thấy template')
      }
    } catch {
      setError('Lỗi kết nối server')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/email-templates/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!data.success) {
        setError(data.error || 'Lỗi khi cập nhật template')
        return
      }

      if (data.cloned) {
        message.success('Template active đã được clone thành phiên bản mới!')
        router.push(`/admin/email-templates/${data.data.id}`)
      } else {
        message.success('Đã lưu template thành công!')
        fetchTemplate()
      }
    } catch {
      setError('Lỗi kết nối server')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/email-templates/${templateId}/activate`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (data.success) {
        message.success('Đã kích hoạt template')
        fetchTemplate()
      } else {
        message.error(data.error || 'Không thể kích hoạt')
      }
    } catch {
      message.error('Lỗi khi kích hoạt template')
    }
  }

  const handleDeactivate = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/email-templates/${templateId}/activate`, {
        method: 'DELETE',
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (data.success) {
        message.success('Đã hủy kích hoạt template')
        fetchTemplate()
      } else {
        message.error(data.error || 'Không thể hủy kích hoạt')
      }
    } catch {
      message.error('Lỗi khi hủy kích hoạt')
    }
  }

  const handlePreview = () => {
    // Show HTML content directly without modification for accurate preview
    setPreviewHtml(formData.htmlContent)
    setPreviewOpen(true)
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className='flex items-center justify-center h-64'>
          <Loader2 className='w-8 h-8 animate-spin text-gray-400' />
        </div>
      </AdminLayout>
    )
  }

  if (!template) {
    return (
      <AdminLayout>
        <div className='text-center py-12'>
          <AlertCircle className='w-12 h-12 text-red-400 mx-auto mb-4' />
          <p className='text-gray-500'>{error || 'Template không tồn tại'}</p>
          <Link
            href='/admin/email-templates'
            className='text-[#e62b1e] hover:underline mt-2 inline-block'
          >
            Quay lại danh sách
          </Link>
        </div>
      </AdminLayout>
    )
  }

  const categoryInfo = CATEGORY_INFO[template.category] || CATEGORY_INFO.GENERAL

  return (
    <AdminLayout>
      <div className='max-w-4xl mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <div className='flex items-center gap-4'>
            <Link
              href='/admin/email-templates'
              className='flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors'
              title='Quay về danh sách'
            >
              <ArrowLeft className='w-5 h-5' />
              <span className='text-sm font-medium'>Quay về</span>
            </Link>
            <div>
              <h1 className='text-2xl font-bold text-gray-900'>Sửa Email Template</h1>
              <p className='text-gray-600 mt-1'>
                {template.name} - v{template.version}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {template.isActive ? (
              <button
                onClick={handleDeactivate}
                className='flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200'
              >
                <PowerOff className='w-4 h-4' />
                Hủy kích hoạt
              </button>
            ) : (
              <button
                onClick={handleActivate}
                className='flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700'
              >
                <Power className='w-4 h-4' />
                Kích hoạt
              </button>
            )}
          </div>
        </div>

        {/* Status badge */}
        <div className='mb-4 flex items-center gap-2'>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${template.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
          >
            {template.isActive ? '✓ Đang hoạt động' : 'Chưa kích hoạt'}
          </span>
          <span className={`px-2 py-1 rounded text-sm font-medium ${categoryInfo.color}`}>
            {categoryInfo.icon} {categoryInfo.title}
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className='space-y-6'>
          {error && (
            <div className='bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3'>
              <AlertCircle className='w-5 h-5 text-red-600 shrink-0 mt-0.5' />
              <p className='text-red-800'>{error}</p>
            </div>
          )}

          <div className='bg-white rounded-lg shadow p-6 space-y-4'>
            {/* Category */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Danh mục</label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    category: e.target.value as TemplateCategory,
                  })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e62b1e]"
              >
                {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.icon} {info.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Info Box */}
            <div className='p-3 bg-blue-50 border border-blue-200 rounded-lg'>
              <div className='flex items-start gap-2'>
                <Info className='w-4 h-4 text-blue-600 shrink-0 mt-0.5' />
                <p className='text-sm text-blue-700'>
                  {CATEGORY_INFO[formData.category]?.description}
                </p>
              </div>
              <div className='mt-2'>
                <p className='text-xs font-medium text-gray-600 mb-1'>Biến gợi ý:</p>
                <div className='flex flex-wrap gap-1'>
                  {CATEGORY_INFO[formData.category]?.suggestedVars.map((v) => (
                    <span
                      key={v}
                      className='px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-mono cursor-pointer hover:bg-gray-300'
                      onClick={() =>
                        setFormData({
                          ...formData,
                          htmlContent: formData.htmlContent + `{{${v}}}`,
                        })
                      }
                      title='Click để thêm vào nội dung'
                    >{`{{${v}}}`}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Tên template <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e62b1e]"
                placeholder="VD: Xác nhận thanh toán - TEDx 2026"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Mô tả</label>
              <input
                type='text'
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e62b1e]"
                placeholder="Mô tả ngắn về template này (không bắt buộc)"
              />
            </div>

            {/* Subject */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Tiêu đề email <span className='text-red-500'>*</span>
              </label>
              <input
                type='text'
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e62b1e]"
                placeholder="VD: [TEDx] Xác nhận thanh toán đơn hàng {{orderNumber}}"
                required
              />
            </div>

            {/* HTML Content */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Nội dung HTML <span className='text-red-500'>*</span>
              </label>
              <textarea
                value={formData.htmlContent}
                onChange={(e) =>
                  setFormData({ ...formData, htmlContent: e.target.value })
                }
                className="w-full px-3 py-2 border rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#e62b1e] font-mono text-sm"
                rows={15}
                placeholder='Nhập HTML template...'
                required
              />
              <p className='text-xs text-gray-500 mt-1'>
                Sử dụng {'{{variableName}}'} để chèn biến động
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className='flex items-center justify-between'>
            <button
              type='button'
              onClick={handlePreview}
              disabled={!formData.htmlContent}
              className='flex items-center gap-2 px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'
            >
              <Eye className='w-4 h-4' />
              Xem trước
            </button>
            <button
              type='submit'
              disabled={saving}
              className='flex items-center gap-2 px-6 py-2 bg-[#e62b1e] text-white rounded-lg hover:bg-[#c9251a] disabled:opacity-50'
            >
              {saving ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
              {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>

      {/* Preview Modal */}
      {previewOpen && (
        <div className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'>
          <div className='bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col'>
            <div className='flex items-center justify-between p-4 border-b'>
              <h3 className='font-semibold text-lg'>Xem trước Email</h3>
              <button
                onClick={() => setPreviewOpen(false)}
                className='p-1 hover:bg-gray-100 rounded'
              >
                <X className='w-5 h-5' />
              </button>
            </div>
            <div className='flex-1 overflow-auto'>
              <iframe
                srcDoc={previewHtml}
                className='w-full h-full min-h-125 border-0'
                title='Email Preview'
              />
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
