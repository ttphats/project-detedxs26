import {FastifyRequest, FastifyReply} from 'fastify'
import {successResponse} from '../../utils/helpers.js'
import {BadRequestError} from '../../utils/errors.js'
import * as settingsService from '../../services/settings.service.js'

// GET /admin/settings
export async function getSettings(request: FastifyRequest, reply: FastifyReply) {
  const settings = await settingsService.getAllSettings()
  return reply.send(successResponse(settings))
}

// PUT /admin/settings
export async function updateSettings(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as Record<string, string>

  if (!body || typeof body !== 'object') {
    throw new BadRequestError('Invalid settings data')
  }

  // Only allow known setting keys
  const allowedKeys = ['notification_emails', 'on_duty_email']

  for (const [key, value] of Object.entries(body)) {
    if (!allowedKeys.includes(key)) {
      throw new BadRequestError(`Unknown setting key: ${key}`)
    }
    await settingsService.setSetting(key, String(value))
  }

  const settings = await settingsService.getAllSettings()
  return reply.send(successResponse(settings))
}

// GET /admin/settings/notification-emails
export async function getNotificationEmails(request: FastifyRequest, reply: FastifyReply) {
  const emails = await settingsService.getNotificationEmails()
  return reply.send(successResponse({emails}))
}

// PUT /admin/settings/notification-emails
export async function updateNotificationEmails(request: FastifyRequest, reply: FastifyReply) {
  const {emails} = request.body as {emails: string[]}

  if (!Array.isArray(emails)) {
    throw new BadRequestError('emails must be an array')
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  for (const email of emails) {
    if (!emailRegex.test(email.trim())) {
      throw new BadRequestError(`Invalid email format: ${email}`)
    }
  }

  await settingsService.setNotificationEmails(
    emails.map((e) => e.trim()).filter((e) => e.length > 0)
  )

  const updatedEmails = await settingsService.getNotificationEmails()
  return reply.send(successResponse({emails: updatedEmails}))
}

// GET /admin/settings/on-duty-email
export async function getOnDutyEmail(request: FastifyRequest, reply: FastifyReply) {
  const email = await settingsService.getOnDutyEmail()
  return reply.send(successResponse({email}))
}

// PUT /admin/settings/on-duty-email
export async function updateOnDutyEmail(request: FastifyRequest, reply: FastifyReply) {
  const {email} = request.body as {email: string}

  if (email === undefined || email === null) {
    throw new BadRequestError('email is required')
  }

  const trimmed = String(email).trim()

  // Allow clearing the email (empty string = no on-duty staff configured)
  if (trimmed.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      throw new BadRequestError(`Invalid email format: ${trimmed}`)
    }
  }

  await settingsService.setOnDutyEmail(trimmed)
  const updatedEmail = await settingsService.getOnDutyEmail()
  return reply.send(successResponse({email: updatedEmail}))
}

// GET /admin/settings/ticket-sales
export async function getTicketSales(request: FastifyRequest, reply: FastifyReply) {
  const config = await settingsService.getTicketSalesConfig()
  return reply.send(successResponse(config))
}

// PUT /admin/settings/ticket-sales
export async function updateTicketSales(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as {
    override?: settingsService.TicketSalesOverride
    salesOpen?: boolean
    opensAt?: string
  }

  if (!body || typeof body !== 'object') {
    throw new BadRequestError('Invalid ticket sales payload')
  }

  if (
    body.override !== undefined &&
    body.override !== 'auto' &&
    body.override !== 'open' &&
    body.override !== 'closed'
  ) {
    throw new BadRequestError('override must be auto, open, or closed')
  }

  if (body.salesOpen !== undefined && typeof body.salesOpen !== 'boolean') {
    throw new BadRequestError('salesOpen must be a boolean')
  }

  if (body.opensAt !== undefined) {
    const parsed = new Date(body.opensAt)
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestError('opensAt must be a valid ISO-8601 date-time')
    }
  }

  const config = await settingsService.setTicketSalesConfig({
    override: body.override,
    salesOpen: body.salesOpen,
    opensAt: body.opensAt,
  })
  return reply.send(successResponse(config))
}
