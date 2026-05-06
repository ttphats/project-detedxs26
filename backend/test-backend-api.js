const response = await fetch('http://localhost:4000/api/events/evt-tedx-2026?sessionId=test123')
const data = await response.json()

console.log('🌐 Backend API Response\n')

if (data.success && data.data) {
  const seatMap = data.data.seatMap || []
  const allSeats = seatMap.flatMap(row => row.seats || [])
  
  const statusCount = allSeats.reduce((acc, seat) => {
    acc[seat.status] = (acc[seat.status] || 0) + 1
    return acc
  }, {})
  
  console.log('📊 Seat Status Summary:')
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count} seats`)
  })
  
  console.log(`\n📍 Total seats returned: ${allSeats.length}`)
  
  // Show sample seats from Row B
  console.log('\n🎫 Row B seats:')
  const rowB = seatMap.find(r => r.row === 'B')
  if (rowB && rowB.seats) {
    rowB.seats.forEach(seat => {
      console.log(`  ${seat.seatNumber || seat.number}: ${seat.status} (${seat.seatType}, $${seat.price})`)
    })
  }
  
  // Check for any SOLD seats
  const soldSeats = allSeats.filter(s => s.status === 'sold')
  if (soldSeats.length > 0) {
    console.log(`\n⚠️  FOUND SOLD SEATS:`)
    soldSeats.forEach(seat => {
      console.log(`  - ${seat.seatNumber || seat.number} (status: ${seat.status})`)
    })
  }
} else {
  console.log('❌ Error:', data.error || 'Unknown error')
  console.log('Response:', JSON.stringify(data, null, 2))
}
