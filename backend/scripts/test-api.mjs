// Test /seats endpoint (polling)
const seatsResponse = await fetch('http://localhost:4000/api/events/evt-tedx-2026/seats?sessionId=test');
const seatsData = await seatsResponse.json();

console.log('=== /seats ENDPOINT (Polling) ===');
console.log('\n=== SAMPLE SEATS (first 5) ===');
const sampleSeats = seatsData.data.seatMap[0]?.seats.slice(0, 5) || [];
console.table(sampleSeats.map(s => ({
  id: s.id.substring(0, 15),
  seatNumber: s.seatNumber,
  seatType: s.seatType,
  level: s.level,
  price: s.price,
  status: s.status
})));

console.log('\n=== SEAT TYPE DISTRIBUTION ===');
const distribution = {};
seatsData.data.seatMap.forEach(row => {
  row.seats.forEach(seat => {
    const key = `${seat.seatType} (level ${seat.level})`;
    distribution[key] = (distribution[key] || 0) + 1;
  });
});
console.table(distribution);
