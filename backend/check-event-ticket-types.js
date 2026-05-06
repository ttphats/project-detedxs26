const res = await fetch('http://localhost:4000/api/events/evt-tedx-2026')
const data = await res.json()

console.log('📋 Event Data Structure:\n')
console.log('Has ticketTypes?', !!data.data.ticketTypes)
console.log('Has ticket_types?', !!data.data.ticket_types)

if (data.data.ticketTypes) {
  console.log('\n✅ Ticket Types:', data.data.ticketTypes)
} else if (data.data.ticket_types) {
  console.log('\n✅ ticket_types:', data.data.ticket_types)
} else {
  console.log('\n❌ NO TICKET TYPES FOUND')
  console.log('\nFull event data keys:', Object.keys(data.data))
}
