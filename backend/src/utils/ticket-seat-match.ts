/**
 * Ticket-type ↔ seat matching + exclusive inventory allocation.
 *
 * Prod: seats use LEVEL_2/3/4; ticket_type_id often NULL.
 * Early Bird (level 5, max_quantity=20) has no LEVEL_5 — carves from LEVEL_2.
 */

export function normalizeSeatKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
}

export function isEarlyBirdType(input: {
  name?: string | null
  level?: number | null
}): boolean {
  const n = normalizeSeatKey(input.name)
  return (
    n.includes('EARLY') ||
    n === 'EB' ||
    n.includes('EARLYBIRD') ||
    (Number(input.level) >= 5 && !n.includes('VIP'))
  )
}

export function seatTypeAliasesForTicketType(input: {
  name?: string | null
  level?: number | null
}): string[] {
  const level = Number(input.level) || 0
  const nameKey = normalizeSeatKey(input.name)
  const aliases = new Set<string>()

  if (level > 0) aliases.add(`LEVEL_${level}`)
  if (nameKey) {
    aliases.add(nameKey)
    aliases.add(nameKey.replace(/_/g, ''))
  }

  if (nameKey.includes('VIP') || nameKey.includes('PREMIUM') || level === 4) {
    aliases.add('VIP')
    aliases.add('LEVEL_4')
  }
  if (nameKey.includes('DONOR') || nameKey.includes('SPONSOR') || level === 3) {
    aliases.add('DONOR')
    aliases.add('LEVEL_3')
  }
  if (isEarlyBirdType(input)) {
    aliases.add('ECONOMY')
    aliases.add('EARLY_BIRD')
    aliases.add('EARLYBIRD')
    aliases.add('LEVEL_1')
    aliases.add('LEVEL_2')
    aliases.add('STANDARD')
  } else if (
    nameKey.includes('STANDARD') ||
    nameKey.includes('REGULAR') ||
    nameKey.includes('GENERAL') ||
    nameKey === 'GA' ||
    level === 2
  ) {
    aliases.add('STANDARD')
    aliases.add('REGULAR')
    aliases.add('LEVEL_2')
  }

  if (level === 1) {
    aliases.add('ECONOMY')
    aliases.add('LEVEL_1')
  }

  return Array.from(aliases).filter(Boolean)
}

export function seatMatchesTicketType(
  seat: {ticket_type_id?: string | null; seat_type?: string | null},
  ticketType: {id: string; name?: string | null; level?: number | null},
): boolean {
  if (seat.ticket_type_id && seat.ticket_type_id === ticketType.id) return true
  const aliases = seatTypeAliasesForTicketType(ticketType)
  const st = normalizeSeatKey(seat.seat_type)
  if (!st) return false
  return aliases.some((a) => normalizeSeatKey(a) === st)
}

export type SeatStatRow = {
  ticket_type_id: string | null
  seat_type: string
  status: string
  count: number
}

export type LockStatRow = {
  ticket_type_id: string | null
  seat_type: string
  count: number
}

export type TypeAvailability = {
  ticketTypeId: string
  totalSeats: number
  sold: number
  reserved: number
  locked: number
  available: number
}

type Bucket = {available: number; sold: number; reserved: number; locked: number}

function emptyBucket(): Bucket {
  return {available: 0, sold: 0, reserved: 0, locked: 0}
}

function addStatus(b: Bucket, status: string, n: number) {
  const st = String(status || '').toUpperCase()
  if (st === 'AVAILABLE') b.available += n
  else if (st === 'SOLD') b.sold += n
  else if (st === 'RESERVED') b.reserved += n
}

/**
 * Exclusive inventory across ticket types sharing seat pools.
 * Early Bird carves up to max_quantity from LEVEL_2 before Standard takes the rest.
 */
export function allocateTicketInventory(
  ticketTypes: Array<{
    id: string
    name: string
    level: number
    max_quantity?: number | null
  }>,
  seatStats: SeatStatRow[],
  lockedRows: LockStatRow[],
): TypeAvailability[] {
  const result = new Map<string, Bucket>()
  for (const tt of ticketTypes) result.set(tt.id, emptyBucket())

  const pools = new Map<string, Bucket>()
  const ensurePool = (key: string) => {
    const k = normalizeSeatKey(key)
    if (!pools.has(k)) pools.set(k, emptyBucket())
    return pools.get(k)!
  }

  for (const row of seatStats) {
    const n = Number(row.count) || 0
    if (row.ticket_type_id && result.has(row.ticket_type_id)) {
      addStatus(result.get(row.ticket_type_id)!, row.status, n)
      continue
    }
    addStatus(ensurePool(row.seat_type), row.status, n)
  }

  for (const row of lockedRows) {
    const n = Number(row.count) || 0
    if (row.ticket_type_id && result.has(row.ticket_type_id)) {
      result.get(row.ticket_type_id)!.locked += n
      continue
    }
    ensurePool(row.seat_type).locked += n
  }

  const claimFromPools = (ttId: string, aliases: string[], cap?: number | null) => {
    const dest = result.get(ttId)!
    let remainingCap =
      cap == null || !Number.isFinite(Number(cap))
        ? Number.POSITIVE_INFINITY
        : Number(cap)

    // Capacity is on SOLD+RESERVED+AVAILABLE only (locked sits inside available)
    const already = dest.available + dest.sold + dest.reserved
    remainingCap = Math.max(0, remainingCap - already)
    if (remainingCap <= 0) return

    for (const alias of aliases) {
      const pool = pools.get(normalizeSeatKey(alias))
      if (!pool) continue

      // Prefer sellable stock first so Early Bird doesn't eat all SOLD rows.
      let left = remainingCap
      if (left <= 0) break

      const takeAv = Math.min(left, pool.available)
      pool.available -= takeAv
      dest.available += takeAv
      left -= takeAv

      const takeLock = Math.min(left, pool.locked)
      pool.locked -= takeLock
      dest.locked += takeLock
      // locks are subset of "held" inventory; count against cap as available-held
      dest.available += takeLock
      left -= takeLock

      const takeRes = Math.min(left, pool.reserved)
      pool.reserved -= takeRes
      dest.reserved += takeRes
      left -= takeRes

      const takeSold = Math.min(left, pool.sold)
      pool.sold -= takeSold
      dest.sold += takeSold
      left -= takeSold

      const took = remainingCap - left
      remainingCap -= took
      if (remainingCap <= 0) break
    }
  }

  const earlyBirds = ticketTypes.filter((t) => isEarlyBirdType(t))
  const others = ticketTypes
    .filter((t) => !isEarlyBirdType(t))
    .sort((a, b) => Number(b.level) - Number(a.level))

  // 1) Exclusive tiers first (VIP/Donor) — do not touch LEVEL_2 yet for Standard
  for (const tt of others) {
    const aliases = seatTypeAliasesForTicketType(tt).filter(
      (a) => !['LEVEL_2', 'STANDARD', 'REGULAR'].includes(normalizeSeatKey(a)),
    )
    claimFromPools(tt.id, aliases, tt.max_quantity)
  }

  // 2) Early Bird carves unassigned shared general pool up to max_quantity
  for (const tt of earlyBirds) {
    claimFromPools(tt.id, seatTypeAliasesForTicketType(tt), tt.max_quantity)
  }

  // 3) Standard / remaining claim leftover LEVEL_2
  for (const tt of others) {
    claimFromPools(tt.id, seatTypeAliasesForTicketType(tt), tt.max_quantity)
  }

  // 4) If Early Bird still empty but Standard holds LEVEL_2 inventory
  //    (common when seats.ticket_type_id is pre-tagged Standard), carve available.
  const standardLike = others.filter((t) => {
    const n = normalizeSeatKey(t.name)
    return (
      n.includes('STANDARD') ||
      n.includes('REGULAR') ||
      n.includes('GENERAL') ||
      Number(t.level) === 2
    )
  })

  for (const eb of earlyBirds) {
    const dest = result.get(eb.id)!
    const maxQ =
      eb.max_quantity == null || !Number.isFinite(Number(eb.max_quantity))
        ? 20
        : Number(eb.max_quantity)
    let need = Math.max(
      0,
      maxQ - (dest.available + dest.sold + dest.reserved),
    )
    if (need <= 0) continue

    for (const std of standardLike) {
      if (need <= 0) break
      const src = result.get(std.id)!
      // Only take free available seats (not sold/reserved)
      const take = Math.min(need, Math.max(0, src.available - src.locked))
      if (take <= 0) continue
      src.available -= take
      dest.available += take
      need -= take
    }
  }

  return ticketTypes.map((tt) => {
    const b = result.get(tt.id) || emptyBucket()
    const free = Math.max(0, b.available - b.locked)
    return {
      ticketTypeId: tt.id,
      totalSeats: b.available + b.sold + b.reserved,
      sold: b.sold,
      reserved: b.reserved,
      locked: b.locked,
      available: free,
    }
  })
}
