/**
 * Clear all seat locks from Redis
 */
import Redis from 'ioredis';

const redis = new Redis('redis://:ttphats1504@222.255.180.85:6379');

async function clearLocks() {
  try {
    console.log('🔍 Searching for seat locks in Redis...');
    const keys = await redis.keys('seat:*');
    console.log(`📊 Found ${keys.length} seat locks`);

    if (keys.length > 0) {
      console.log('🗑️  Deleting all seat locks...');
      await redis.del(...keys);
      console.log('✅ Deleted all seat locks from Redis');
    } else {
      console.log('✅ No locks to delete');
    }

    redis.quit();
  } catch (error) {
    console.error('❌ Error:', error);
    redis.quit();
  }
}

clearLocks();
