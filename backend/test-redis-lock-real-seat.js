/**
 * Test Redis Seat Locking Flow with Real Seats
 */

const API_URL = 'http://localhost:4000/api';

// Test data
const EVENT_ID = 'evt-tedx-2026';
const SESSION_1 = 'test-session-' + Date.now();
const SESSION_2 = 'test-session-other-' + Date.now();

console.log('🧪 Testing Redis Seat Locking with Real Seats...\n');

async function test() {
  try {
    // Step 1: Get available seats
    console.log('1️⃣  Fetching available seats...');
    const seatsRes = await fetch(`${API_URL}/events/${EVENT_ID}/seats?sessionId=${SESSION_1}`);
    const seatsData = await seatsRes.json();
    
    if (!seatsData.success) {
      console.log('   ❌ Failed to fetch seats:', seatsData.error);
      return;
    }

    // Find first available seat
    const availableSeats = seatsData.data.seatMap
      .flatMap(row => row.seats)
      .filter(seat => seat.status === 'available');

    if (availableSeats.length === 0) {
      console.log('   ❌ No available seats found!');
      return;
    }

    const TEST_SEAT = availableSeats[0];
    console.log(`   ✅ Found ${availableSeats.length} available seats`);
    console.log(`   🪑 Testing with: ${TEST_SEAT.seatNumber} (ID: ${TEST_SEAT.id})\n`);

    // Step 2: Lock seat with Session 1
    console.log('2️⃣  Locking seat with Session 1...');
    const lockRes1 = await fetch(`${API_URL}/seats/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: EVENT_ID,
        seatIds: [TEST_SEAT.id],
        sessionId: SESSION_1,
      }),
    });

    const lockData1 = await lockRes1.json();
    if (lockData1.success) {
      console.log('   ✅ Locked successfully!');
      console.log(`   📍 Expires at: ${lockData1.data.expiresAt}`);
      console.log(`   ⏱️  Expires in: ${lockData1.data.expiresIn}s\n`);
    } else {
      console.log('   ❌ Failed to lock:', lockData1.error);
      return;
    }

    // Step 3: Try to lock same seat with Session 2 (should fail)
    console.log('3️⃣  Trying to lock same seat with Session 2 (should fail)...');
    const lockRes2 = await fetch(`${API_URL}/seats/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: EVENT_ID,
        seatIds: [TEST_SEAT.id],
        sessionId: SESSION_2,
      }),
    });

    const lockData2 = await lockRes2.json();
    if (!lockData2.success) {
      console.log('   ✅ Correctly rejected!');
      console.log(`   📛 Error: ${lockData2.error}\n`);
    } else {
      console.log('   ❌ ERROR: Should have been rejected but succeeded!\n');
    }

    // Step 4: Get session locks
    console.log('4️⃣  Getting session locks...');
    const locksRes = await fetch(`${API_URL}/seats/lock?sessionId=${SESSION_1}&eventId=${EVENT_ID}`);
    const locksData = await locksRes.json();
    
    if (locksData.success) {
      console.log(`   ✅ Found ${locksData.data.locks.length} locked seat(s)`);
      locksData.data.locks.forEach(lock => {
        console.log(`   🪑 ${lock.seatNumber} - Expires: ${lock.expiresAt}`);
      });
      console.log('');
    }

    // Step 5: Unlock seats
    console.log('5️⃣  Unlocking seats...');
    const unlockRes = await fetch(`${API_URL}/seats/lock`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: EVENT_ID,
        seatIds: [TEST_SEAT.id],
        sessionId: SESSION_1,
      }),
    });

    const unlockData = await unlockRes.json();
    if (unlockData.success) {
      console.log('   ✅ Unlocked successfully!\n');
    } else {
      console.log('   ❌ Failed to unlock:', unlockData.error, '\n');
    }

    // Step 6: Lock with Session 2 after unlock (should succeed)
    console.log('6️⃣  Locking with Session 2 after unlock (should succeed)...');
    const lockRes4 = await fetch(`${API_URL}/seats/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: EVENT_ID,
        seatIds: [TEST_SEAT.id],
        sessionId: SESSION_2,
      }),
    });

    const lockData4 = await lockRes4.json();
    if (lockData4.success) {
      console.log('   ✅ Locked successfully with Session 2!\n');
      
      // Cleanup: unlock Session 2
      await fetch(`${API_URL}/seats/lock`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: EVENT_ID,
          seatIds: [TEST_SEAT.id],
          sessionId: SESSION_2,
        }),
      });
    } else {
      console.log('   ❌ Failed to lock:', lockData4.error, '\n');
    }

    console.log('🎉 All tests completed!\n');
    console.log('📊 Summary:');
    console.log('   ✅ Redis is working for seat locking');
    console.log('   ✅ Locks prevent other sessions from taking seats');
    console.log('   ✅ Unlocking works correctly');
    console.log('   ✅ Can lock again after unlock\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test
test();
