const response = await fetch('http://localhost:3000/api/events/evt-tedx-2026?sessionId=test123')
const data = await response.json()

console.log('🌐 Web Client API Response\n')

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
  
  // Show sample seats from different rows
  console.log('\n🎫 Sample seats:')
  const rowA = data.data.seatMap.find(r => r.row === 'A')
  const rowB = data.data.seatMap.find(r => r.row === 'B')
  
  if (rowA) {
    console.log(`\nRow A (first 5):`)
    rowA.seats.slice(0, 5).forEach(seat => {
      console.log(`  ${seat.seatNumber}: ${seat.status} (${seat.seatType}, $${seat.price})`)
    })
  }
  
  if (rowB) {
    console.log(`\nRow B (first 5):`)
    rowB.seats.slice(0, 5).forEach(seat => {
      console.log(`  ${seat.seatNumber}: ${seat.status} (${seat.seatType}, $${seat.price})`)
    })
  }
  
  // Check for any SOLD seats
  const soldSeats = allSeats.filter(s => s.status === 'sold')
  if (soldSeats.length > 0) {
    console.log(`\n⚠️  FOUND SOLD SEATS:`)
    soldSeats.forEach(seat => {
      console.log(`  - ${seat.seatNumber} (row ${seat.row})`)
    })
  }
} else {
  console.log('❌ Error:', data.error || 'Unknown error')
  console.log('Response:', JSON.stringify(data, null, 2))
}
