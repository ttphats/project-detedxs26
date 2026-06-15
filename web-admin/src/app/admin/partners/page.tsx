'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/admin'
import {
  Table,
  Button,
  Card,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Tag,
  Popconfirm,
  message,
  Avatar,
  Switch,
  Upload,
  Divider,
  Alert,
  Tooltip,
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  PictureOutlined,
  UploadOutlined,
  LoadingOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface Partner {
  id: string
  name: string
  tier: 'diamond' | 'gold' | 'silver'
  website: string | null
  logo_url: string | null
  banner_url: string | null
  sort_order: number
  is_active: boolean
  show_in_marquee: boolean
  created_at: string
  updated_at: string
}

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [initialFormValues, setInitialFormValues] = useState<any>({ sort_order: 0, is_active: true, show_in_marquee: false })
  const [form] = Form.useForm()
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string>('')
  const [bannerUrl, setBannerUrl] = useState<string>('')

  const fetchData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/partners', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success && data.data) {
        setPartners(data.data || [])
      } else {
        console.error('[PARTNERS] API error:', data.error)
      }
    } catch (error) {
      console.error('Failed to fetch:', error)
      message.error('Không thể tải danh sách nhà tài trợ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSubmit = async (values: any) => {
    try {
      const token = localStorage.getItem('token')
      const payload = { ...values }

      if (editingId) {
        const res = await fetch(`/api/admin/partners/${editingId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) {
          message.success('Cập nhật nhà tài trợ thành công')
        } else {
          message.error(data.error || 'Cập nhật thất bại')
          return
        }
      } else {
        const res = await fetch('/api/admin/partners', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) {
          message.success('Thêm nhà tài trợ thành công')
        } else {
          message.error(data.error || 'Thêm thất bại')
          return
        }
      }
      setIsModalOpen(false)
      setEditingId(null)
      fetchData()
    } catch (error) {
      message.error('Có lỗi xảy ra')
    }
  }

  const handleEdit = (record: Partner) => {
    setEditingId(record.id)
    setInitialFormValues(record)
    setLogoUrl(record.logo_url || '')
    setBannerUrl(record.banner_url || '')
    setIsModalOpen(true)
  }

  /** Upload logo (square, for Partners & Sponsors section) */
  const handleLogoUpload = async (file: File) => {
    setUploadingLogo(true)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('subfolder', 'partners')

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        setLogoUrl(data.data.url)
        form.setFieldsValue({ logo_url: data.data.url })
        message.success('Upload logo thành công')
      } else {
        message.error(data.error || 'Upload thất bại')
      }
    } catch (error) {
      message.error('Upload thất bại')
    } finally {
      setUploadingLogo(false)
    }
    return false
  }

  /** Upload banner (wide 400×160px, for conveyor belt marquee) */
  const handleBannerUpload = async (file: File) => {
    setUploadingBanner(true)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('subfolder', 'partners/banners')

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()

      if (data.success) {
        setBannerUrl(data.data.url)
        form.setFieldsValue({ banner_url: data.data.url })
        message.success('Upload banner thành công')
      } else {
        message.error(data.error || 'Upload thất bại')
      }
    } catch (error) {
      message.error('Upload thất bại')
    } finally {
      setUploadingBanner(false)
    }
    return false
  }

  const handleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/partners/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        message.success('Partner deleted')
        fetchData()
      } else {
        message.error(data.error || 'Cannot delete')
      }
    } catch (error) {
      message.error('An error occurred')
    }
  }

  const handleToggleActive = async (id: string, is_active: boolean) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/partners/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active }),
      })
      const data = await res.json()
      if (data.success) {
        fetchData()
      } else {
        message.error(data.error || 'Update failed')
      }
    } catch (error) {
      message.error('An error occurred')
    }
  }

  const handleToggleMarquee = async (id: string, show_in_marquee: boolean) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/partners/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ show_in_marquee }),
      })
      const data = await res.json()
      if (data.success) {
        fetchData()
      } else {
        message.error(data.error || 'Update failed')
      }
    } catch (error) {
      message.error('An error occurred')
    }
  }

  const getTierTag = (tier: string) => {
    switch (tier) {
      case 'diamond':
        return <Tag color="cyan">Diamond Sponsor</Tag>
      case 'gold':
        return <Tag color="gold">Gold Sponsor</Tag>
      case 'silver':
        return <Tag color="blue">Silver Sponsor</Tag>
      default:
        return <Tag color="gray">{tier}</Tag>
    }
  }

  const columns: ColumnsType<Partner> = [
    {
      title: 'Partner',
      key: 'partner',
      width: 300,
      render: (_, record) => (
        <Space align="center">
          <Avatar
            shape="square"
            size={64}
            src={record.logo_url}
            icon={<PictureOutlined />}
            style={{ backgroundColor: '#1f1f1f', border: '1px solid #303030', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            className="flex-shrink-0"
          />
          <div>
            <div className="font-bold text-base text-gray-900">{record.name}</div>
            {record.website && (
              <a
                href={record.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-red-500 hover:text-red-400 text-xs flex items-center gap-1 mt-1"
              >
                <GlobalOutlined /> {record.website}
              </a>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Tier',
      dataIndex: 'tier',
      key: 'tier',
      width: 150,
      render: (tier) => getTierTag(tier),
    },
    {
      title: 'Order',
      dataIndex: 'sort_order',
      key: 'sort_order',
      width: 100,
    },
    {
      title: 'Active on Website',
      dataIndex: 'is_active',
      key: 'is_active',
      width: 150,
      render: (active, record) => (
        <Switch checked={active} onChange={(checked) => handleToggleActive(record.id, checked)} checkedChildren="ON" unCheckedChildren="OFF" />
      ),
    },
    {
      title: 'Spotlight Slideshow',
      key: 'spotlight',
      width: 200,
      render: (_, record) => (
        <div className="flex flex-col gap-2">
          {/* Toggle switch */}
          <Tooltip title={record.show_in_marquee ? 'Currently visible in Spotlight Slideshow' : 'Not visible in Spotlight Slideshow'}>
            <Switch
              checked={record.show_in_marquee}
              onChange={(checked) => handleToggleMarquee(record.id, checked)}
              checkedChildren="ON"
              unCheckedChildren="OFF"
            />
          </Tooltip>
          {/* Banner preview */}
          {record.show_in_marquee && (
            record.banner_url ? (
              <Tooltip title="Spotlight Banner (400×160px)">
                <img
                  src={record.banner_url}
                  alt="Banner"
                  style={{
                    width: 120,
                    height: 48,
                    objectFit: 'contain',
                    borderRadius: 6,
                    border: '1px solid #e8e8e8',
                    background: '#fafafa',
                    padding: 4,
                  }}
                />
              </Tooltip>
            ) : (
              <span className="text-orange-400 text-xs flex items-center gap-1">
                <PictureOutlined /> No banner
              </span>
            )
          )}
        </div>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm
            title="Delete this partner?"
            description="This action cannot be undone."
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Partners & Sponsors</h1>
            <p className="text-gray-600 mt-1">Manage and display partners on the homepage</p>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData}>
              Refresh
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingId(null)
                setLogoUrl('')
                setBannerUrl('')
                setInitialFormValues({ sort_order: 0, is_active: true, show_in_marquee: false })
                setIsModalOpen(true)
              }}
              style={{ backgroundColor: '#e62b1e' }}
            >
              Add Partner
            </Button>
          </Space>
        </div>

        {/* Info Banner */}
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message="Image Upload Guide"
          description={
            <ul className="list-disc pl-4 mt-1 text-sm space-y-1">
              <li><strong>Partner Logo</strong>: Used for "Partners & Sponsors" section at the bottom. Recommended: transparent PNG/SVG, square or any comfortable ratio.</li>
              <li><strong>Spotlight Banner</strong>: Used for the <strong>Spotlight Slideshow</strong> section in the middle of the homepage — displays 1 partner every 5 seconds. Standard size: <strong>400×160px (2.5:1 ratio)</strong>, transparent PNG/WebP or brand style.</li>
            </ul>
          }
          style={{ marginBottom: 16 }}
        />

        {/* Table */}
        <Card>
          <Table
            columns={columns}
            dataSource={partners}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>

        {/* Modal Form */}
        <Modal
          title={editingId ? 'Edit Partner' : 'Add New Partner'}
          open={isModalOpen}
          onCancel={() => {
            setIsModalOpen(false)
            setEditingId(null)
            setLogoUrl('')
            setBannerUrl('')
          }}
          footer={null}
          width={680}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={initialFormValues}
            key={editingId || 'new'}
          >
            <Form.Item
              name="name"
              label="Partner Name"
              rules={[{ required: true, message: 'Please enter partner name' }]}
            >
              <Input placeholder="Ex: FPT Corporation, VinFast, Intel..." />
            </Form.Item>

            <Form.Item
              name="tier"
              label="Sponsorship Tier"
              rules={[{ required: true, message: 'Please select a tier' }]}
            >
              <Select placeholder="Select rank/tier">
                <Select.Option value="diamond">Diamond Sponsor</Select.Option>
                <Select.Option value="gold">Gold Sponsor</Select.Option>
                <Select.Option value="silver">Silver Sponsor</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item name="website" label="Website Link">
              <Input placeholder="VD: https://fpt.com.vn" />
            </Form.Item>

            <Divider orientation={"left" as any} style={{ marginTop: 8, marginBottom: 12 }}>
              <span className="text-sm font-semibold text-gray-700">
                🏷️ Partner Logo <span className="font-normal text-gray-400">(used in Partners & Sponsors section)</span>
              </span>
            </Divider>

            <Form.Item label={null}>
              <div className="flex items-start gap-4">
                <Upload
                  name="file"
                  listType="picture-card"
                  showUploadList={false}
                  beforeUpload={handleLogoUpload}
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Logo Partner"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        padding: 8,
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      {uploadingLogo ? <LoadingOutlined /> : <UploadOutlined />}
                      <div style={{ marginTop: 8 }}>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</div>
                    </div>
                  )}
                </Upload>
                <div className="flex-1">
                  <Form.Item name="logo_url" noStyle>
                    <Input
                      placeholder="Or enter logo URL directly..."
                      onChange={(e) => setLogoUrl(e.target.value)}
                    />
                  </Form.Item>
                  <p className="text-gray-400 text-xs mt-2">
                    Transparent PNG/SVG · JPEG, WebP, GIF · Max 5MB
                  </p>
                </div>
              </div>
            </Form.Item>

            {/* === BANNER UPLOAD (Spotlight Slideshow) === */}
            <Divider orientation={"left" as any} style={{ marginTop: 8, marginBottom: 12 }}>
              <span className="text-sm font-semibold text-gray-700">
                🎞️ Spotlight Banner <span className="font-normal text-gray-400">(displayed in Spotlight Slideshow on homepage)</span>
              </span>
            </Divider>

            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message={
                <span>
                  Standard size: <strong>400 × 160px</strong> (2.5:1 ratio) · Transparent PNG/WebP · If not uploaded, Slideshow will use logo instead
                </span>
              }
            />

            <Form.Item label={null}>
              <div className="flex items-start gap-4">
                {/* Banner preview area — wider aspect ratio */}
                <Upload
                  name="file"
                  showUploadList={false}
                  beforeUpload={handleBannerUpload}
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                >
                  <div
                    style={{
                      width: 200,
                      height: 80,
                      border: '1px dashed #d9d9d9',
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      background: '#fafafa',
                      flexShrink: 0,
                    }}
                    className="hover:border-blue-400 transition-colors"
                  >
                    {bannerUrl ? (
                      <img
                        src={bannerUrl}
                        alt="Banner"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8 }}
                      />
                    ) : (
                      <div className="flex flex-col items-center text-gray-400 text-xs gap-1">
                        {uploadingBanner ? <LoadingOutlined style={{ fontSize: 18 }} /> : <UploadOutlined style={{ fontSize: 18 }} />}
                        <span>{uploadingBanner ? 'Uploading...' : 'Upload Banner'}</span>
                        <span className="text-gray-300">400 × 160px</span>
                      </div>
                    )}
                  </div>
                </Upload>

                <div className="flex-1">
                  <Form.Item name="banner_url" noStyle>
                    <Input
                      placeholder="Or enter banner URL directly..."
                      onChange={(e) => setBannerUrl(e.target.value)}
                    />
                  </Form.Item>
                  <p className="text-gray-400 text-xs mt-2">
                    Recommended: transparent PNG/WebP · Optimal size: <strong>400x160px</strong> · Max 5MB
                  </p>
                  {bannerUrl && (
                    <button
                      type="button"
                      className="text-red-500 text-xs mt-1 hover:underline"
                      onClick={() => {
                        setBannerUrl('')
                        form.setFieldsValue({ banner_url: '' })
                      }}
                    >
                      × Remove banner
                    </button>
                  )}
                </div>
              </div>
            </Form.Item>

            <div className="mt-4">
              <Form.Item name="sort_order" label="Display Order">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </div>

            <Form.Item className="mb-0 mt-6">
              <Space className="w-full justify-end">
                <Button onClick={() => {
                  setIsModalOpen(false)
                  setEditingId(null)
                  setLogoUrl('')
                  setBannerUrl('')
                }}>
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" style={{ backgroundColor: '#e62b1e' }}>
                  {editingId ? 'Update' : 'Create'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </AdminLayout>
  )
}
