/**
 * Map ticket type (name + level) → seat_type aliases used in seats table.
 * Production seats often use VIP / STANDARD / ECONOMY, not LEVEL_N or ticket_type_id.
 */

export function normalizeSeatKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
}

/** Aliases to match seats.seat_type for a ticket type. */
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

  // Name-based legacy enums
  if (nameKey.includes('VIP') || nameKey.includes('PREMIUM') || level >= 4) {
    aliases.add('VIP')
  }
  if (nameKey.includes('DONOR') || nameKey.includes('SPONSOR')) {
    aliases.add('DONOR')
    aliases.add('VIP') // some layouts store donor as VIP zone
  }
  if (
    nameKey.includes('EARLY') ||
    nameKey.includes('ECONOMY') ||
    nameKey.includes('BUDGET') ||
    nameKey.includes('BASIC') ||
    nameKey === 'EB'
  ) {
    aliases.add('ECONOMY')
    aliases.add('EARLY_BIRD')
    aliases.add('EARLYBIRD')
    // Older layouts used LEVEL_1 for cheapest
    aliases.add('LEVEL_1')
  }
  if (
    nameKey.includes('STANDARD') ||
    nameKey.includes('REGULAR') ||
    nameKey.includes('GENERAL') ||
    nameKey === 'GA'
  ) {
    aliases.add('STANDARD')
    aliases.add('REGULAR')
    aliases.add('LEVEL_2')
  }

  // Level-only heuristic when name is free-form
  if (level === 1) {
    aliases.add('ECONOMY')
    aliases.add('LEVEL_1')
  }
  if (level === 2) {
    aliases.add('STANDARD')
    aliases.add('LEVEL_2')
  }
  if (level === 3) {
    aliases.add('DONOR')
    aliases.add('STANDARD')
    aliases.add('LEVEL_3')
  }
  if (level >= 4) {
    aliases.add('VIP')
    aliases.add(`LEVEL_${level}`)
  }

  return Array.from(aliases).filter(Boolean)
}

/** True if a seat row belongs to this ticket type. */
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
