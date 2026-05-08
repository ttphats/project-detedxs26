'use client'

import {useEffect, useState} from 'react'
import {AdminLayout} from '@/components/admin'
import {Table, Button, Tag, Tooltip, message, Modal, Select, Space, Input} from 'antd'
import type {ColumnsType} from 'antd/es/table'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  PoweroffOutlined,
  CheckCircleOutlined,
  SendOutlined,
  StarOutlined,
  StarFilled,
  UploadOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons'
import Dragger from 'antd/es/upload/Dragger'
import type {UploadFile} from 'antd/es/upload/interface'
import Link from 'next/link'

// Template categories - flexible system
const TEMPLATE_CATEGORIES = ['ORDER', 'EVENT', 'NOTIFICATION', 'GENERAL'] as const
type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number]

interface CategoryInfo {
  key: TemplateCategory
  title: string
  description: string
  icon: string
  color: string
}

const CATEGORY_INFO: Record<TemplateCategory, CategoryInfo> = {
  ORDER: {
    key: 'ORDER',
    title: 'Đơn hàng',
    description: 'Templates liên quan đến đơn hàng, thanh toán, vé',
    icon: '🛒',
    color: 'blue',
  },
  EVENT: {
    key: 'EVENT',
    title: 'Sự kiện',
    description: 'Templates về nhắc lịch, check-in, thông báo sự kiện',
    icon: '📅',
    color: 'purple',
  },
  NOTIFICATION: {
    key: 'NOTIFICATION',
    title: 'Thông báo',
    description: 'Templates thông báo cho admin hoặc hệ thống',
    icon: '🔔',
    color: 'orange',
  },
  GENERAL: {
    key: 'GENERAL',
    title: 'Chung',
    description: 'Templates dùng chung, linh hoạt',
    icon: '📧',
    color: 'default',
  },
}

const CATEGORY_OPTIONS = [
  {value: 'ALL', label: 'Tất cả'},
  ...Object.entries(CATEGORY_INFO).map(([key, info]) => ({
    value: key,
    label: `${info.icon} ${info.title}`,
  })),
]

interface EmailTemplate {
  id: string
  name: string
  purpose: string | null
  category: TemplateCategory
  description: string | null
  subject: string
  htmlContent: string
  textContent: string | null
  variables: string[]
  isActive: boolean
  isDefault: boolean
  version: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState<TemplateCategory | 'ALL'>('ALL')
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Test email modal state
  const [testModalOpen, setTestModalOpen] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [testTemplateId, setTestTemplateId] = useState<string | null>(null)
  const [testTemplateName, setTestTemplateName] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [uploadedHtml, setUploadedHtml] = useState('')
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    name: '',
    subject: '',
    purpose: 'ORDER_CONFIRMATION',
    description: '',
  })

  const fetchTemplates = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      let url = '/api/admin/email-templates'
      if (filterCategory !== 'ALL') {
        url += `?category=${filterCategory}`
      }
      const res = await fetch(url, {
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (data.success) {
        setTemplates(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error)
      message.error('Không thể tải danh sách templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [filterCategory])

  const handlePreview = async (id: string) => {
    setActionLoading(id)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/email-templates/${id}/preview`, {
        headers: {Authorization: `Bearer ${token}`},
      })
      const json = await res.json()
      if (json.success && json.data?.html) {
        setPreviewHtml(json.data.html)
        setPreviewOpen(true)
      } else {
        message.error(json.error || 'Không thể xem trước template')
      }
    } catch (error) {
      console.error('Failed to preview:', error)
      message.error('Không thể xem trước template')
    } finally {
      setActionLoading(null)
    }
  }

  // Handle file upload
  const handleUpload = async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return false // Prevent auto upload
  }

  const handleUploadSubmit = async (fileList: UploadFile[]) => {
    if (fileList.length === 0) {
      message.error('Vui lòng chọn file HTML và images')
      return
    }

    setUploading(true)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()

      fileList.forEach((file) => {
        if (file.originFileObj) {
          formData.append('files', file.originFileObj)
        }
      })

      const res = await fetch('/api/admin/email-templates/upload', {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`},
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        setUploadedHtml(data.data.htmlContent)
        setUploadedImages(data.data.images || [])
        message.success('Upload thành công! Xem preview và lưu template.')
      } else {
        message.error(data.error || 'Upload thất bại')
      }
    } catch (error) {
      console.error('Upload failed:', error)
      message.error('Lỗi khi upload files')
    } finally {
      setUploading(false)
    }
  }

  const handleSaveUploadedTemplate = async () => {
    if (!uploadedHtml) {
      message.error('Chưa có HTML content')
      return
    }
    if (!uploadForm.name || !uploadForm.subject) {
      message.error('Vui lòng nhập tên và tiêu đề email')
      return
    }

    setUploading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/email-templates/upload/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...uploadForm,
          htmlContent: uploadedHtml,
        }),
      })
      const data = await res.json()

      if (data.success) {
        message.success('Đã lưu template thành công!')
        setUploadModalOpen(false)
        setUploadedHtml('')
        setUploadedImages([])
        setUploadForm({
          name: '',
          subject: '',
          purpose: 'ORDER_CONFIRMATION',
          description: '',
        })
        fetchTemplates()
      } else {
        message.error(data.error || 'Không thể lưu template')
      }
    } catch (error) {
      console.error('Save failed:', error)
      message.error('Lỗi khi lưu template')
    } finally {
      setUploading(false)
    }
  }

  const handleActivate = async (id: string) => {
    setActionLoading(id)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/email-templates/${id}/activate`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (data.success) {
        message.success('Đã kích hoạt template')
        fetchTemplates()
      } else {
        message.error(data.error || 'Không thể kích hoạt')
      }
    } catch (error) {
      console.error('Failed to activate:', error)
      message.error('Lỗi khi kích hoạt template')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeactivate = async (id: string) => {
    setActionLoading(id)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/email-templates/${id}/activate`, {
        method: 'DELETE',
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (data.success) {
        message.success('Đã hủy kích hoạt template')
        fetchTemplates()
      } else {
        message.error(data.error || 'Không thể hủy kích hoạt')
      }
    } catch (error) {
      console.error('Failed to deactivate:', error)
      message.error('Lỗi khi hủy kích hoạt')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: `Bạn có chắc muốn xóa template "${name}"?`,
      okText: 'Xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          const token = localStorage.getItem('token')
          const res = await fetch(`/api/admin/email-templates/${id}`, {
            method: 'DELETE',
            headers: {Authorization: `Bearer ${token}`},
          })
          const data = await res.json()
          if (data.success) {
            message.success('Đã xóa template')
            fetchTemplates()
          } else {
            message.error(data.error || 'Không thể xóa template')
          }
        } catch (error) {
          console.error('Failed to delete:', error)
          message.error('Lỗi khi xóa template')
        }
      },
    })
  }

  // Open test email modal
  const openTestModal = (id: string, name: string) => {
    setTestTemplateId(id)
    setTestTemplateName(name)
    setTestEmail('')
    setTestModalOpen(true)
  }

  // Send test email
  const handleSendTestEmail = async () => {
    if (!testTemplateId || !testEmail) {
      message.warning('Vui lòng nhập email')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(testEmail)) {
      message.error('Email không hợp lệ')
      return
    }

    setSendingTest(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/email-templates/${testTemplateId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({email: testEmail}),
      })
      const data = await res.json()
      if (data.success) {
        message.success(`Đã gửi test email đến ${testEmail}`)
        setTestModalOpen(false)
      } else {
        message.error(data.error || 'Không thể gửi test email')
      }
    } catch (error) {
      console.error('Failed to send test email:', error)
      message.error('Lỗi khi gửi test email')
    } finally {
      setSendingTest(false)
    }
  }

  // Set default template
  const handleSetDefault = async (id: string) => {
    setActionLoading(id)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/email-templates/${id}/set-default`, {
        method: 'POST',
        headers: {Authorization: `Bearer ${token}`},
      })
      const data = await res.json()
      if (data.success) {
        message.success(data.message || 'Đã đặt làm mặc định')
        fetchTemplates()
      } else {
        message.error(data.error || 'Không thể đặt mặc định')
      }
    } catch (error) {
      console.error('Failed to set default:', error)
      message.error('Lỗi khi đặt mặc định')
    } finally {
      setActionLoading(null)
    }
  }

  // Table columns
  const columns: ColumnsType<EmailTemplate> = [
    {
      title: 'Danh mục',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (category: TemplateCategory) => {
        const info = CATEGORY_INFO[category]
        return info ? (
          <Tooltip title={info.description}>
            <Tag color={info.color}>
              {info.icon} {info.title}
            </Tag>
          </Tooltip>
        ) : (
          <Tag>{category}</Tag>
        )
      },
      filters: Object.entries(CATEGORY_INFO).map(([key, info]) => ({
        text: `${info.icon} ${info.title}`,
        value: key,
      })),
      onFilter: (value, record) => record.category === value,
    },
    {
      title: 'Tên template',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name: string, record) => (
        <div>
          <div className='font-medium text-gray-900'>
            {name}
            {record.isDefault && (
              <Tag color='gold' className='ml-2' style={{fontSize: 10}}>
                <StarFilled /> Mặc định
              </Tag>
            )}
          </div>
          <div className='text-xs text-gray-500 truncate max-w-xs'>
            {record.description || record.subject}
          </div>
        </div>
      ),
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      key: 'purpose',
      width: 160,
      render: (purpose: string | null) =>
        purpose ? (
          <Tag color='cyan'>{purpose}</Tag>
        ) : (
          <span className='text-gray-400 text-xs'>Chưa đặt</span>
        ),
    },
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 80,
      align: 'center',
      render: (v: number) => <span className='text-gray-500'>v{v}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      align: 'center',
      render: (isActive: boolean) =>
        isActive ? <Tag color='success'>Active</Tag> : <Tag color='default'>Draft</Tag>,
      filters: [
        {text: 'Active', value: true},
        {text: 'Draft', value: false},
      ],
      onFilter: (value, record) => record.isActive === value,
    },
    {
      title: 'Cập nhật',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
      sorter: (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 280,
      align: 'center',
      render: (_, record) => (
        <Space size='small' wrap>
          <Tooltip title='Xem trước'>
            <Button
              size='small'
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record.id)}
              loading={actionLoading === record.id}
            />
          </Tooltip>
          <Tooltip title='Test gửi email'>
            <Button
              size='small'
              icon={<SendOutlined />}
              onClick={() => openTestModal(record.id, record.name)}
              style={{color: '#1890ff'}}
            />
          </Tooltip>
          <Tooltip title='Chỉnh sửa'>
            <Link href={`/admin/email-templates/${record.id}`}>
              <Button size='small' icon={<EditOutlined />} />
            </Link>
          </Tooltip>
          {/* Set Default button - only show if has purpose and not already default */}
          {record.purpose && !record.isDefault && (
            <Tooltip title={`Đặt làm mặc định cho ${record.purpose}`}>
              <Button
                size='small'
                icon={<StarOutlined />}
                onClick={() => handleSetDefault(record.id)}
                loading={actionLoading === record.id}
                style={{color: '#faad14'}}
              />
            </Tooltip>
          )}
          {record.isActive ? (
            <Tooltip title='Hủy kích hoạt'>
              <Button
                size='small'
                danger
                icon={<PoweroffOutlined />}
                onClick={() => handleDeactivate(record.id)}
                loading={actionLoading === record.id}
              />
            </Tooltip>
          ) : (
            <>
              <Tooltip title='Kích hoạt'>
                <Button
                  size='small'
                  type='primary'
                  ghost
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleActivate(record.id)}
                  loading={actionLoading === record.id}
                />
              </Tooltip>
              <Tooltip title='Xóa'>
                <Button
                  size='small'
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(record.id, record.name)}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <AdminLayout>
      <div className='space-y-6'>
        {/* Header */}
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>Email Templates</h1>
            <p className='text-gray-600 mt-1'>
              Tạo và quản lý email templates linh hoạt theo danh mục
            </p>
          </div>
          <Space>
            <Button icon={<UploadOutlined />} size='large' onClick={() => setUploadModalOpen(true)}>
              Upload từ Canva
            </Button>
            <Link href='/admin/email-templates/create'>
              <Button type='primary' icon={<PlusOutlined />} size='large'>
                Tạo Template
              </Button>
            </Link>
          </Space>
        </div>

        {/* Filter */}
        <div className='flex items-center gap-4'>
          <span className='text-sm text-gray-600'>Lọc theo danh mục:</span>
          <Select
            value={filterCategory}
            onChange={(value) => setFilterCategory(value as TemplateCategory | 'ALL')}
            options={CATEGORY_OPTIONS}
            style={{width: 200}}
          />
        </div>

        {/* Templates Table */}
        <div className='bg-white rounded-lg shadow'>
          <Table
            columns={columns}
            dataSource={templates}
            rowKey='id'
            loading={loading}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Tổng ${total} templates`,
            }}
            scroll={{x: 1000}}
            rowClassName={(record) => (record.isActive ? 'bg-green-50/50' : '')}
            locale={{
              emptyText: (
                <div className='py-8 text-center'>
                  <p className='text-gray-500 mb-2'>Chưa có email template nào</p>
                  <Link href='/admin/email-templates/create'>
                    <Button type='link'>Tạo template đầu tiên</Button>
                  </Link>
                </div>
              ),
            }}
          />
        </div>

        {/* Preview Modal */}
        <Modal
          title='Email Preview'
          open={previewOpen}
          onCancel={() => setPreviewOpen(false)}
          footer={null}
          width={900}
          centered
        >
          <iframe srcDoc={previewHtml} className='w-full h-125 border-0' title='Email Preview' />
        </Modal>

        {/* Test Email Modal */}
        <Modal
          title={
            <div className='flex items-center gap-2'>
              <SendOutlined className='text-blue-500' />
              <span>Test gửi email</span>
            </div>
          }
          open={testModalOpen}
          onCancel={() => setTestModalOpen(false)}
          onOk={handleSendTestEmail}
          okText='Gửi test'
          cancelText='Hủy'
          confirmLoading={sendingTest}
          okButtonProps={{icon: <SendOutlined />}}
        >
          <div className='py-4 space-y-4'>
            <div className='p-3 bg-blue-50 rounded-lg border border-blue-200'>
              <p className='text-sm text-blue-700'>
                <strong>Template:</strong> {testTemplateName}
              </p>
              <p className='text-xs text-blue-600 mt-1'>
                Email sẽ được gửi với dữ liệu mẫu để kiểm tra hiển thị
              </p>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-2'>
                Email nhận test <span className='text-red-500'>*</span>
              </label>
              <Input
                placeholder='Nhập email để nhận test...'
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                onPressEnter={handleSendTestEmail}
                size='large'
                prefix={<span className='text-gray-400'>📧</span>}
              />
            </div>
            <div className='p-3 bg-yellow-50 rounded-lg border border-yellow-200'>
              <p className='text-xs text-yellow-700'>
                ⚠️ Email test sẽ có tiêu đề kèm [TEST] để phân biệt với email thật
              </p>
            </div>
          </div>
        </Modal>

        {/* Upload Modal */}
        <Modal
          title={
            <div className='flex items-center gap-2'>
              <CloudUploadOutlined className='text-blue-500' />
              <span>Upload Email Template từ Canva</span>
            </div>
          }
          open={uploadModalOpen}
          onCancel={() => {
            setUploadModalOpen(false)
            setUploadedHtml('')
            setUploadedImages([])
          }}
          width={900}
          footer={null}
        >
          <div className='space-y-6 py-4'>
            {!uploadedHtml ? (
              <>
                <div className='p-4 bg-blue-50 rounded-lg border border-blue-200'>
                  <p className='text-sm text-blue-700 mb-2'>
                    <strong>Hướng dẫn upload từ Canva:</strong>
                  </p>
                  <ol className='text-sm text-blue-700 list-decimal list-inside space-y-1'>
                    <li>
                      Export template từ Canva → chọn <strong>HTML</strong>
                    </li>
                    <li>
                      Canva sẽ tải về: <code>email.html</code> + folder <code>images/</code>
                    </li>
                    <li>
                      <strong>Nén cả 2 thành file .zip</strong> rồi upload lên đây
                    </li>
                  </ol>
                </div>
                <Dragger
                  multiple
                  accept='.zip,.html,.htm,.png,.jpg,.jpeg,.gif,.webp,.svg'
                  beforeUpload={() => false}
                  onChange={(info) => {
                    if (info.fileList.length > 0) {
                      handleUploadSubmit(info.fileList)
                    }
                  }}
                  disabled={uploading}
                >
                  <p className='ant-upload-drag-icon'>
                    <CloudUploadOutlined style={{fontSize: 48, color: '#1890ff'}} />
                  </p>
                  <p className='ant-upload-text'>Kéo thả hoặc click để chọn file</p>
                  <p className='ant-upload-hint'>
                    <strong>Cách 1:</strong> Upload file <code>.zip</code> (nén cả folder HTML +
                    images từ Canva)
                    <br />
                    <strong>Cách 2:</strong> Chọn file .html và tất cả images riêng lẻ
                  </p>
                </Dragger>
              </>
            ) : (
              <>
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-sm font-medium mb-2'>
                      Tên Template <span className='text-red-500'>*</span>
                    </label>
                    <Input
                      placeholder='VD: Order Confirmation - TEDx 2026'
                      value={uploadForm.name}
                      onChange={(e) => setUploadForm({...uploadForm, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium mb-2'>
                      Tiêu đề Email <span className='text-red-500'>*</span>
                    </label>
                    <Input
                      placeholder='VD: 🎫 Xác nhận đơn hàng {{orderNumber}}'
                      value={uploadForm.subject}
                      onChange={(e) =>
                        setUploadForm({
                          ...uploadForm,
                          subject: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium mb-2'>Mục đích</label>
                    <Select
                      value={uploadForm.purpose}
                      onChange={(value) => setUploadForm({...uploadForm, purpose: value})}
                      options={[
                        {
                          value: 'ORDER_CONFIRMATION',
                          label: 'Xác nhận đơn hàng',
                        },
                        {value: 'PAYMENT_PENDING', label: 'Chờ thanh toán'},
                        {value: 'TICKET_SENT', label: 'Gửi vé'},
                        {value: 'EVENT_REMINDER', label: 'Nhắc nhở sự kiện'},
                        {value: 'GENERAL', label: 'Chung'},
                      ]}
                      style={{width: '100%'}}
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-medium mb-2'>Mô tả</label>
                    <Input
                      placeholder='Mô tả ngắn về template...'
                      value={uploadForm.description}
                      onChange={(e) =>
                        setUploadForm({
                          ...uploadForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                {uploadedImages.length > 0 && (
                  <div className='p-3 bg-green-50 rounded-lg'>
                    <p className='text-sm text-green-700'>
                      ✓ Đã upload {uploadedImages.length} images
                    </p>
                  </div>
                )}

                <div>
                  <label className='block text-sm font-medium mb-2'>Preview</label>
                  <div
                    className='border rounded-lg overflow-hidden bg-gray-100'
                    style={{height: 400}}
                  >
                    <iframe
                      srcDoc={uploadedHtml}
                      style={{width: '100%', height: '100%', border: 'none'}}
                      title='Email Preview'
                    />
                  </div>
                </div>

                <div className='flex justify-end gap-3'>
                  <Button onClick={() => setUploadedHtml('')}>Upload lại</Button>
                  <Button type='primary' onClick={handleSaveUploadedTemplate} loading={uploading}>
                    Lưu Template
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      </div>
    </AdminLayout>
  )
}
