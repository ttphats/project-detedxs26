// Test the exact URL you're using in browser
const response = await fetch('http://localhost:3000/api/events/evt-tedx-2026/seats?sessionId=session_1777980922080_29mthk8xs4r')
const data = await response.json()

console.log('🌐 Client Seats API Response\n')

if (data.success && data.data.seatMap) {
  const allSeats = data.data.seatMap.flatMap(row => row.seats)
  
  const statusCount = allSeats.reduce((acc, seat) => {
    acc[seat.status] = (acc[seat.status] || 0) + 1
    return acc
  }, {})
  
  console.log('📊 Seat Status Summary:')
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count} seats`)
  })
  
  console.log(`\n📍 Total seats returned: ${allSeats.length}`)
  
  // Show Row B seats
  console.log('\n🎫 Row B seats (ALL):')
  const rowB = data.data.seatMap.find(r => r.row === 'B')
  if (rowB) {
    rowB.seats.forEach(seat => {
      const status = seat.status === 'sold' ? '🔴 SOLD' : seat.status === 'available' ? '🟢 AVAILABLE' : seat.status
      console.log(`  ${seat.seatNumber}: ${status} (${seat.seatType}, $${seat.price})`)
    })
  }
  
  // Show any sold seats
  const soldSeats = allSeats.filter(s => s.status === 'sold')
  if (soldSeats.length > 0) {
    console.log(`\n⚠️  FOUND ${soldSeats.length} SOLD SEATS:`)
    soldSeats.forEach(seat => {
      console.log(`  - ${seat.seatNumber} (row ${seat.row})`)
    })
  } else {
    console.log('\n✅ NO SOLD SEATS - All available!')
  }
} else {
  console.log('❌ Error:', data.error || 'Unknown error')
  console.log('Response:', JSON.stringify(data, null, 2))
}
