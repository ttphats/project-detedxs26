/**
 * Lock a seat and DON'T unlock - for testing admin panel
 */

const API_URL = 'http://localhost:4000/api';
const EVENT_ID = 'evt-tedx-2026';
const SESSION_ID = 'admin-test-session-' + Date.now();

async function lockSeatForAdmin() {
  try {
    // Get available seats
    const seatsRes = await fetch(`${API_URL}/events/${EVENT_ID}/seats?sessionId=${SESSION_ID}`);
    const seatsData = await seatsRes.json();
    
    const availableSeats = seatsData.data.seatMap
      .flatMap(row => row.seats)
      .filter(seat => seat.status === 'available');

    if (availableSeats.length === 0) {
      console.log('❌ No available seats!');
      return;
    }

    // Lock first 3 seats
    const seatsToLock = availableSeats.slice(0, 3);
    
    console.log('🔒 Locking seats for admin panel test...');
    console.log(`📍 Event: ${EVENT_ID}`);
    console.log(`🪑 Seats: ${seatsToLock.map(s => s.seatNumber).join(', ')}`);
    console.log(`👤 Session: ${SESSION_ID}\n`);

    const lockRes = await fetch(`${API_URL}/seats/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: EVENT_ID,
        seatIds: seatsToLock.map(s => s.id),
        sessionId: SESSION_ID,
      }),
    });

    const lockData = await lockRes.json();
    
    if (lockData.success) {
      console.log('✅ Locked successfully!');
      console.log(`⏱️  Expires in: ${lockData.data.expiresIn}s (${Math.floor(lockData.data.expiresIn / 60)} minutes)`);
      console.log(`📍 Expires at: ${lockData.data.expiresAt}\n`);
      console.log('👉 Now open Admin Panel → Seat Locks to see these locks!\n');
      console.log('🌐 Admin URL: http://localhost:3002/admin/seat-locks\n');
    } else {
      console.log('❌ Failed:', lockData.error);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

lockSeatForAdmin();
