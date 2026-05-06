// Compare the two endpoints client is using

console.log('🔍 Testing INITIAL LOAD endpoint...\n')
const res1 = await fetch('http://localhost:4000/api/events/evt-tedx-2026?sessionId=test123')
const data1 = await res1.json()

console.log('🔍 Testing POLLING endpoint...\n')
const res2 = await fetch('http://localhost:4000/api/events/evt-tedx-2026/seats?sessionId=test123')
const data2 = await res2.json()

console.log('═══════════════════════════════════════════════════════════')
console.log('1️⃣  INITIAL LOAD: GET /api/events/:id')
console.log('═══════════════════════════════════════════════════════════')

if (data1.success && data1.data) {
  const seatMap1 = data1.data.seatMap || []
  const allSeats1 = seatMap1.flatMap(row => row.seats || [])
  
  const statusCount1 = allSeats1.reduce((acc, seat) => {
    acc[seat.status] = (acc[seat.status] || 0) + 1
    return acc
  }, {})
  
  console.log('\n📊 Seat Status Summary:')
  Object.entries(statusCount1).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count} seats`)
  })
  
  console.log(`\n📍 Total seats: ${allSeats1.length}`)
  console.log(`🗂️  Rows: ${seatMap1.map(r => r.row).join(', ')}`)
  
  // Sample seats
  console.log('\n🎫 Sample seats from Row A:')
  const rowA1 = seatMap1.find(r => r.row === 'A')
  if (rowA1 && rowA1.seats) {
    rowA1.seats.slice(0, 3).forEach(seat => {
      console.log(`  ${seat.seatNumber}: ${seat.status} (${seat.seatType}, $${seat.price})`)
    })
  }
}

console.log('\n═══════════════════════════════════════════════════════════')
console.log('2️⃣  POLLING: GET /api/events/:id/seats')
console.log('═══════════════════════════════════════════════════════════')

if (data2.success && data2.data) {
  const seatMap2 = data2.data.seatMap || []
  const allSeats2 = seatMap2.flatMap(row => row.seats || [])
  
  const statusCount2 = allSeats2.reduce((acc, seat) => {
    acc[seat.status] = (acc[seat.status] || 0) + 1
    return acc
  }, {})
  
  console.log('\n📊 Seat Status Summary:')
  Object.entries(statusCount2).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count} seats`)
  })
  
  console.log(`\n📍 Total seats: ${allSeats2.length}`)
  console.log(`🗂️  Rows: ${seatMap2.map(r => r.row).join(', ')}`)
  
  // Sample seats
  console.log('\n🎫 Sample seats from Row A:')
  const rowA2 = seatMap2.find(r => r.row === 'A')
  if (rowA2 && rowA2.seats) {
    rowA2.seats.slice(0, 3).forEach(seat => {
      console.log(`  ${seat.seatNumber}: ${seat.status} (${seat.seatType}, $${seat.price})`)
    })
  }
}

console.log('\n═══════════════════════════════════════════════════════════')
console.log('🔄 COMPARISON')
console.log('═══════════════════════════════════════════════════════════\n')

const seatMap1 = data1.data?.seatMap || []
const seatMap2 = data2.data?.seatMap || []

if (seatMap1.length !== seatMap2.length) {
  console.log(`⚠️  DIFFERENT ROW COUNT: ${seatMap1.length} vs ${seatMap2.length}`)
} else {
  console.log(`✅ Same row count: ${seatMap1.length}`)
}

const allSeats1 = seatMap1.flatMap(r => r.seats || [])
const allSeats2 = seatMap2.flatMap(r => r.seats || [])

if (allSeats1.length !== allSeats2.length) {
  console.log(`⚠️  DIFFERENT SEAT COUNT: ${allSeats1.length} vs ${allSeats2.length}`)
} else {
  console.log(`✅ Same seat count: ${allSeats1.length}`)
}

// Check for differences in status
const diff = []
allSeats1.forEach(seat1 => {
  const seat2 = allSeats2.find(s => s.id === seat1.id)
  if (!seat2) {
    diff.push(`Seat ${seat1.seatNumber} missing in polling endpoint`)
  } else if (seat1.status !== seat2.status) {
    diff.push(`Seat ${seat1.seatNumber}: ${seat1.status} → ${seat2.status}`)
  }
})

if (diff.length > 0) {
  console.log(`\n⚠️  FOUND ${diff.length} DIFFERENCES:`)
  diff.slice(0, 10).forEach(d => console.log(`  - ${d}`))
  if (diff.length > 10) {
    console.log(`  ... and ${diff.length - 10} more`)
  }
} else {
  console.log('\n✅ NO DIFFERENCES - Both endpoints return identical data!')
}
