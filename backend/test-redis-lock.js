/**
 * Test Redis Seat Locking Flow
 * 
 * This script tests:
 * 1. Lock seats with Redis
 * 2. Check lock in Redis
 * 3. Try to lock same seat with different session (should fail)
 * 4. Unlock seats
 * 5. Lock again (should succeed)
 */

const API_URL = 'http://localhost:4000/api';

// Test data
const EVENT_ID = 'evt-tedx-2026';
const SESSION_1 = 'test-session-' + Date.now();
const SESSION_2 = 'test-session-other-' + Date.now();
const TEST_SEAT_ID = 'seat-test-redis-' + Date.now();

console.log('🧪 Testing Redis Seat Locking...\n');
console.log('📊 Test Configuration:');
console.log(`   Event ID: ${EVENT_ID}`);
console.log(`   Session 1: ${SESSION_1}`);
console.log(`   Session 2: ${SESSION_2}`);
console.log(`   Test Seat: ${TEST_SEAT_ID}\n`);

async function test() {
  try {
    // Step 1: Lock seat with Session 1
    console.log('1️⃣  Locking seat with Session 1...');
    const lockRes1 = await fetch(`${API_URL}/seats/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: EVENT_ID,
        seatIds: [TEST_SEAT_ID],
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

    // Step 2: Try to lock same seat with Session 2 (should fail)
    console.log('2️⃣  Trying to lock same seat with Session 2 (should fail)...');
    const lockRes2 = await fetch(`${API_URL}/seats/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: EVENT_ID,
        seatIds: [TEST_SEAT_ID],
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

    // Step 3: Re-lock with Session 1 (should succeed - same session)
    console.log('3️⃣  Re-locking with Session 1 (should succeed)...');
    const lockRes3 = await fetch(`${API_URL}/seats/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: EVENT_ID,
        seatIds: [TEST_SEAT_ID],
        sessionId: SESSION_1,
      }),
    });

    const lockData3 = await lockRes3.json();
    if (lockData3.success) {
      console.log('   ✅ Re-locked successfully!\n');
    } else {
      console.log('   ❌ Failed to re-lock:', lockData3.error, '\n');
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
        seatIds: [TEST_SEAT_ID],
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
        seatIds: [TEST_SEAT_ID],
        sessionId: SESSION_2,
      }),
    });

    const lockData4 = await lockRes4.json();
    if (lockData4.success) {
      console.log('   ✅ Locked successfully!\n');
    } else {
      console.log('   ❌ Failed to lock:', lockData4.error, '\n');
    }

    console.log('🎉 All tests completed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run test
test();
