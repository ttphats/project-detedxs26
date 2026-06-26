'use client'

import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/admin'
import {
  Card,
  Table,
  Button,
  Tag,
  Space,
  Drawer,
  Descriptions,
  Popconfirm,
  message,
  Select,
} from 'antd'
import {
  ReloadOutlined,
  EyeOutlined,
  CheckOutlined,
  CloseOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

interface SpeakerSubmission {
  id: string
  answers: Record<string, any>
  status: 'PENDING' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED'
  created_at: string
  updated_at: string
}

interface SpeakerFormField {
  id: string
  name: string
  label: string
}

export default function SpeakerSubmissionsPage() {
  const [submissions, setSubmissions] = useState<SpeakerSubmission[]>([])
  const [fields, setFields] = useState<SpeakerFormField[]>([])
  const [loading, setLoading] = useState(true)
  
  // Drawer states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<SpeakerSubmission | null>(null)

  const fetchFields = async () => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/speakers/register/fields', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success && data.data) {
        setFields(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch fields:', error)
    }
  }

  const fetchSubmissions = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('token')
      const res = await fetch('/api/admin/speakers/submissions', {
        headers: { Authorization: `Bearer ${token}` }
      })
      const data = await res.json()
      if (data.success && data.data) {
        setSubmissions(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch submissions:', error)
      message.error('Không thể tải danh sách đơn ứng tuyển')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFields()
    fetchSubmissions()
  }, [])

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`/api/admin/speakers/submissions/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (data.success) {
        message.success(`Status updated successfully`)
        fetchSubmissions()
        
        // If drawer is open, update its selection
        if (selectedSubmission && selectedSubmission.id === id) {
          setSelectedSubmission({
            ...selectedSubmission,
            status: status as any
          })
        }
      } else {
        message.error(data.error || 'Update failed')
      }
    } catch (error) {
      message.error('An error occurred while updating status')
    }
  }

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Tag color="gold">Pending</Tag>
      case 'REVIEWED':
        return <Tag color="blue">Under Review</Tag>
      case 'ACCEPTED':
        return <Tag color="green">Accepted</Tag>
      case 'REJECTED':
        return <Tag color="red">Rejected</Tag>
      default:
        return <Tag>{status}</Tag>
    }
  }

  const handleViewDetails = (record: SpeakerSubmission) => {
    setSelectedSubmission(record)
    setIsDrawerOpen(true)
  }

  const columns: ColumnsType<SpeakerSubmission> = [
    {
      title: 'Applicant Name',
      key: 'fullName',
      width: 180,
      render: (_, record) => {
        const name = record.answers.fullName || record.answers.name || 'Unknown';
        return <span className="font-semibold text-gray-900">{name}</span>
      }
    },
    {
      title: 'Email',
      key: 'email',
      width: 180,
      render: (_, record) => record.answers.email || 'N/A'
    },
    {
      title: 'Phone Number',
      key: 'phone',
      width: 130,
      render: (_, record) => record.answers.phone || 'N/A'
    },
    {
      title: 'Topic',
      key: 'topic',
      width: 250,
      render: (_, record) => (
        <span className="text-gray-700 block truncate max-w-[240px]" title={record.answers.topic}>
          {record.answers.topic || 'N/A'}
        </span>
      )
    },
    {
      title: 'Submitted At',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (date) => new Date(date).toLocaleString('en-US')
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status) => getStatusTag(status)
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button size="small" type="primary" icon={<EyeOutlined />} onClick={() => handleViewDetails(record)}>
            View Details
          </Button>
          {record.status === 'PENDING' && (
            <Button
              size="small"
              onClick={() => handleUpdateStatus(record.id, 'REVIEWED')}
              style={{ color: '#0958d9', borderColor: '#91caff' }}
            >
              Mark Under Review
            </Button>
          )}
        </Space>
      )
    }
  ]

  // Map answers to fields to show Label instead of Raw key
  const renderDetails = () => {
    if (!selectedSubmission) return null

    return (
      <div className="space-y-6">
        <Descriptions title="Application Details" layout="vertical" bordered column={1}>
          {fields.map((f) => {
            const val = selectedSubmission.answers[f.name];
            return (
              <Descriptions.Item key={f.id} label={<span className="font-bold text-gray-700">{f.label}</span>}>
                {val ? (
                  f.name === 'videoUrl' && String(val).startsWith('http') ? (
                    <a href={val} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline break-all">
                      {val}
                    </a>
                  ) : (
                    <span className="whitespace-pre-wrap text-gray-900 leading-relaxed">{val}</span>
                  )
                ) : (
                  <span className="text-gray-400 italic">Not provided</span>
                )}
              </Descriptions.Item>
            )
          })}
        </Descriptions>

        <div className="border-t pt-6">
          <h4 className="font-semibold text-gray-700 mb-4">Application Status: {getStatusTag(selectedSubmission.status)}</h4>
          <Space size="middle">
            <Popconfirm
              title="Approve this application?"
              description="The applicant will be accepted for the speaker interview round."
              onConfirm={() => handleUpdateStatus(selectedSubmission.id, 'ACCEPTED')}
              okText="Approve"
              cancelText="Cancel"
            >
              <Button type="primary" icon={<CheckOutlined />} style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }}>
                Accept Applicant
              </Button>
            </Popconfirm>

            <Popconfirm
              title="Reject this application?"
              description="This action will mark the applicant as rejected."
              onConfirm={() => handleUpdateStatus(selectedSubmission.id, 'REJECTED')}
              okText="Reject"
              cancelText="Cancel"
            >
              <Button danger icon={<CloseOutlined />}>
                Reject Applicant
              </Button>
            </Popconfirm>

            {selectedSubmission.status !== 'REVIEWED' && selectedSubmission.status !== 'ACCEPTED' && (
              <Button onClick={() => handleUpdateStatus(selectedSubmission.id, 'REVIEWED')}>
                Mark Under Review
              </Button>
            )}
          </Space>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Manage Speaker Applications</h1>
            <p className="text-gray-600 mt-1">Review and manage speaker applications submitted from the website</p>
          </div>
          <Space>
            <Button
              type="dashed"
              icon={<span role="img" aria-label="gear">⚙️</span>}
              onClick={() => window.location.href = '/admin/speaker-config'}
            >
              Form Configuration
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchSubmissions}>
              Refresh
            </Button>
          </Space>
        </div>

        {/* Table list */}
        <Card>
          <Table
            columns={columns}
            dataSource={submissions}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
          />
        </Card>

        {/* Details Drawer */}
        <Drawer
          title="Speaker Application Details"
          placement="right"
          size="large"
          onClose={() => {
            setIsDrawerOpen(false)
            setSelectedSubmission(null)
          }}
          open={isDrawerOpen}
        >
          {renderDetails()}
        </Drawer>
      </div>
    </AdminLayout>
  )
}
