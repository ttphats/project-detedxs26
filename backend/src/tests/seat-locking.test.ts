import { vi, describe, it, expect, beforeEach } from 'vitest';
import { extendSeatLock, clearExpiredLocks } from '../services/seat-lock.service.js';
import { getPool } from '../db/mysql.js';

vi.mock('../db/mysql.js', () => ({
  getPool: vi.fn(),
}));

describe('Seat Lock Service', () => {
  let mockPool: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = {
      query: vi.fn(),
    };
    vi.mocked(getPool).mockReturnValue(mockPool);
  });

  describe('extendSeatLock', () => {
    it('should extend lock if the session owns all locks', async () => {
      const mockLocks = [
        { seat_id: 's1', session_id: 'session-1', expires_at: new Date() },
      ];
      
      mockPool.query
        .mockResolvedValueOnce([mockLocks]) // verification query
        .mockResolvedValueOnce([[{ now: new Date().toISOString() }]]) // SELECT NOW() as now query
        .mockResolvedValueOnce([{ affectedRows: 1 }]) // update query
        .mockResolvedValueOnce([[{ expires_at: new Date(), expires_in: 900 }]]); // expiry select

      const result = await extendSeatLock('e1', ['s1'], 'session-1');

      expect(result.affectedRows).toBe(1);
      expect(result.durationMinutes).toBe(15);
      expect(result.expiresIn).toBe(900);
    });

    it('should throw error if some seats are not locked', async () => {
      mockPool.query.mockResolvedValueOnce([[]]); // empty return means seats not locked

      await expect(
        extendSeatLock('e1', ['s1', 's2'], 'session-1')
      ).rejects.toThrow('Some seats are not locked');
    });

    it('should throw error if locked by another session', async () => {
      const mockLocks = [
        { seat_id: 's1', session_id: 'session-2', expires_at: new Date() },
      ];
      mockPool.query.mockResolvedValueOnce([mockLocks]);

      await expect(
        extendSeatLock('e1', ['s1'], 'session-1')
      ).rejects.toThrow('Some seats are locked by another session');
    });
  });

  describe('clearExpiredLocks', () => {
    it('should delete expired locks and return affected rows', async () => {
      mockPool.query.mockResolvedValueOnce([{ affectedRows: 3 }]);

      const result = await clearExpiredLocks();

      expect(result.affectedRows).toBe(3);
    });
  });
});
