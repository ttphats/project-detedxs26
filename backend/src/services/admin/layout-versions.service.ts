import {getPool} from '../../db/mysql.js'
import {RowDataPacket, ResultSetHeader} from 'mysql2'
import {randomUUID} from 'crypto'

interface LayoutVersion extends RowDataPacket {
  id: string
  event_id: string
  version_name: string
  description: string | null
  layout_config: string
  seats_data: string
  status: 'DRAFT' | 'PUBLISHED'
  is_active: boolean
  created_by: string | null
  created_at: Date
  updated_at: Date
  published_at: Date | null
}

interface Event extends RowDataPacket {
  id: string
  name: string
}

interface TicketType extends RowDataPacket {
  id: string
  name: string
  price: number
  color: string
}

/**
 * List layout versions for an event
 */
export async function listLayoutVersions(eventId: string) {
  const pool = getPool()

  const [versions] = await pool.query<LayoutVersion[]>(
    `SELECT * FROM seat_layout_versions
     WHERE event_id = ?
     ORDER BY created_at DESC`,
    [eventId]
  )

  // Parse JSON fields
  const parsedVersions = versions.map((v: LayoutVersion) => ({
    ...v,
    layout_config:
      typeof v.layout_config === 'string' ? JSON.parse(v.layout_config) : v.layout_config,
    seats_data: typeof v.seats_data === 'string' ? JSON.parse(v.seats_data) : v.seats_data,
  }))

  // Get events for dropdown
  const [events] = await pool.query<Event[]>('SELECT id, name FROM events ORDER BY created_at DESC')

  // Get ticket types for the event
  const [ticketTypes] = await pool.query<TicketType[]>(
    'SELECT id, name, price, color FROM ticket_types WHERE event_id = ? ORDER BY sort_order',
    [eventId]
  )

  return {
    versions: parsedVersions,
    events,
    ticketTypes,
  }
}

/**
 * Create new draft version
 */
export async function createLayoutVersion(data: {
  event_id: string
  version_name: string
  description?: string
  layout_config: any
  seats_data: any
}) {
  const pool = getPool()
  const id = randomUUID()

  await pool.query(
    `INSERT INTO seat_layout_versions
     (id, event_id, version_name, description, layout_config, seats_data, status, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', FALSE, NOW(), NOW())`,
    [
      id,
      data.event_id,
      data.version_name,
      data.description || null,
      JSON.stringify(data.layout_config),
      JSON.stringify(data.seats_data),
    ]
  )

  return {id}
}

/**
 * Update an existing draft version
 */
export async function updateLayoutVersion(
  id: string,
  data: {
    version_name?: string
    description?: string
    layout_config?: any
    seats_data?: any
  }
) {
  const pool = getPool()

  // Check if version exists and is still a draft
  const [versions] = await pool.query<LayoutVersion[]>(
    'SELECT * FROM seat_layout_versions WHERE id = ?',
    [id]
  )

  const version = versions[0]
  if (!version) {
    throw new Error('Version not found')
  }

  if (version.status !== 'DRAFT') {
    throw new Error('Cannot update published version')
  }

  // Build update query
  const updates: string[] = []
  const params: any[] = []

  if (data.version_name !== undefined) {
    updates.push('version_name = ?')
    params.push(data.version_name)
  }

  if (data.description !== undefined) {
    updates.push('description = ?')
    params.push(data.description || null)
  }

  if (data.layout_config !== undefined) {
    updates.push('layout_config = ?')
    params.push(JSON.stringify(data.layout_config))
  }

  if (data.seats_data !== undefined) {
    updates.push('seats_data = ?')
    params.push(JSON.stringify(data.seats_data))
  }

  if (updates.length === 0) {
    throw new Error('No fields to update')
  }

  updates.push('updated_at = NOW()')
  params.push(id)

  await pool.query(`UPDATE seat_layout_versions SET ${updates.join(', ')} WHERE id = ?`, params)

  return {success: true}
}

/**
 * Publish a draft version
 * - Sets the version status to PUBLISHED
 * - Deactivates all other versions for this event
 * - Sets this version as active
 * - Creates seats in the seats table based on seats_data
 */
export async function publishLayoutVersion(id: string, userId?: string) {
  const pool = getPool()

  // Get the version
  const [versions] = await pool.query<LayoutVersion[]>(
    'SELECT * FROM seat_layout_versions WHERE id = ?',
    [id]
  )

  const version = versions[0]
  if (!version) {
    throw new Error('Version not found')
  }

  if (version.status === 'PUBLISHED') {
    throw new Error('Version already published')
  }

  // Start transaction
  const connection = await pool.getConnection()
  await connection.beginTransaction()

  try {
    // 1. Deactivate all other versions for this event
    await connection.query('UPDATE seat_layout_versions SET is_active = FALSE WHERE event_id = ?', [
      version.event_id,
    ])

    // 2. Publish this version and set as active
    await connection.query(
      `UPDATE seat_layout_versions
       SET status = 'PUBLISHED', is_active = TRUE, published_at = NOW(), created_by = ?
       WHERE id = ?`,
      [userId || null, id]
    )

    // 3. Delete existing seats for this event
    await connection.query('DELETE FROM seats WHERE event_id = ?', [version.event_id])

    // 4. Get ticket types to map seat_type -> price
    const [ticketTypes] = await connection.query<TicketType[]>(
      'SELECT id, name, price FROM ticket_types WHERE event_id = ?',
      [version.event_id]
    )

    // Create a map: seat_type (name) -> price
    const priceMap = new Map<string, number>()
    for (const tt of ticketTypes) {
      priceMap.set(tt.name.toUpperCase(), Number(tt.price))
    }

    // 5. Create seats from seats_data
    const seatsData =
      typeof version.seats_data === 'string' ? JSON.parse(version.seats_data) : version.seats_data

    for (const seat of seatsData) {
      const seatId = randomUUID()
      const seatType = seat.seat_type || 'STANDARD'
      const price = seat.price || priceMap.get(seatType.toUpperCase()) || 0

      await connection.query(
        `INSERT INTO seats
         (id, event_id, seat_number, row, col, section, seat_type, price, status, position_x, position_y)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'AVAILABLE', ?, ?)`,
        [
          seatId,
          version.event_id,
          seat.seat_number || `${seat.row}${seat.col}`,
          seat.row,
          seat.col,
          seat.section || 'MAIN',
          seatType,
          price,
          seat.position_x || 0,
          seat.position_y || 0,
        ]
      )
    }

    // 6. Update event available_seats count
    await connection.query(
      `UPDATE events
       SET available_seats = (SELECT COUNT(*) FROM seats WHERE event_id = ? AND status = 'AVAILABLE')
       WHERE id = ?`,
      [version.event_id, version.event_id]
    )

    await connection.commit()
    connection.release()

    return {success: true, seatsCreated: seatsData.length}
  } catch (error) {
    await connection.rollback()
    connection.release()
    throw error
  }
}

/**
 * Delete a draft version
 */
export async function deleteLayoutVersion(id: string) {
  const pool = getPool()

  // Check if it's a draft
  const [versions] = await pool.query<LayoutVersion[]>(
    'SELECT * FROM seat_layout_versions WHERE id = ?',
    [id]
  )

  const version = versions[0]
  if (!version) {
    throw new Error('Version not found')
  }

  if (version.is_active) {
    throw new Error('Cannot delete active version')
  }

  await pool.query('DELETE FROM seat_layout_versions WHERE id = ?', [id])
  return {success: true}
}
