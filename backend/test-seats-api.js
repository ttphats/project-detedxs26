const response = await fetch('http://localhost:3000/api/events/evt-tedx-2026/seats?sessionId=test123')
const data = await response.json()

console.log('API Response:', JSON.stringify(data, null, 2))

if (data.success && data.data.seatMap) {
  const allSeats = data.data.seatMap.flatMap(row => row.seats)
  
  const statusCount = allSeats.reduce((acc, seat) => {
    acc[seat.status] = (acc[seat.status] || 0) + 1
    return acc
  }, {})
  
  console.log('\n📊 Seat Status Summary:')
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count} seats`)
  })
  
  // Show some sample seats
  console.log('\n🎫 Sample seats from row B:')
  const rowB = data.data.seatMap.find(r => r.row === 'B')
  if (rowB) {
    rowB.seats.slice(0, 5).forEach(seat => {
      console.log(`  - ${seat.seatNumber}: ${seat.status} (price: ${seat.price})`)
    })
  }
}
