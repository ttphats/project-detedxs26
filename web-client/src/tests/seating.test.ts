import { describe, it, expect } from 'vitest';
import { getEventById, events } from '../lib/mock-data';

describe('Web Client Seating & Data Helpers', () => {
  describe('getEventById', () => {
    it('should retrieve correct event details by ID', () => {
      const event = getEventById('evt-tedx-2026');
      expect(event).toBeDefined();
      expect(event?.id).toBe('evt-tedx-2026');
      expect(event?.name).toContain('TEDxFPTUniversityHCMC 2026');
    });

    it('should return undefined for non-existent event ID', () => {
      const event = getEventById('nonexistent-id');
      expect(event).toBeUndefined();
    });
  });

  describe('Seat Map Layout', () => {
    it('should generate valid seat structure for TEDx event', () => {
      const event = getEventById('evt-tedx-2026');
      expect(event?.seatMap).toBeDefined();
      expect(event?.seatMap.length).toBeGreaterThan(0);

      // Verify row structure
      const rowA = event?.seatMap.find((r) => r.row === 'A');
      expect(rowA).toBeDefined();
      expect(rowA?.seats).toHaveLength(12);

      // Verify VIP seating details
      const vipSeat = rowA?.seats[0];
      expect(vipSeat?.ticketTypeId).toBe('vip');
      expect(vipSeat?.price).toBe(150);

      // Verify Standard seating details
      const rowC = event?.seatMap.find((r) => r.row === 'C');
      const standardSeat = rowC?.seats[0];
      expect(standardSeat?.ticketTypeId).toBe('standard');
      expect(standardSeat?.price).toBe(80);
    });

    it('should record specific sold seats as unavailable', () => {
      const event = getEventById('evt-tedx-2026');
      const rowA = event?.seatMap.find((r) => r.row === 'A');
      
      // A3 is predefined as sold in mock-data.ts
      const seatA3 = rowA?.seats.find((s) => s.number === 3);
      expect(seatA3?.status).toBe('sold');

      // A1 is predefined as available
      const seatA1 = rowA?.seats.find((s) => s.number === 1);
      expect(seatA1?.status).toBe('available');
    });
  });
});
