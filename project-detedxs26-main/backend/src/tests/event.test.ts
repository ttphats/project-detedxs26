import { vi, describe, it, expect, beforeEach } from 'vitest';
import { getPublishedEvents, getEventById } from '../services/event.service.js';
import { query, queryOne } from '../db/mysql.js';
import { NotFoundError } from '../utils/errors.js';

vi.mock('../db/mysql.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

describe('Event Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPublishedEvents', () => {
    it('should fetch and format published events correctly', async () => {
      const mockEvents = [
        {
          id: 'e1',
          name: 'TEDxEvent: Finding Flow',
          slug: 'tedxevent-finding-flow',
          description: 'A great event',
          event_date: new Date('2026-03-15'),
          doors_open_time: new Date('2026-03-15T08:30:00Z'),
          end_time: new Date('2026-03-15T18:00:00Z'),
          venue: 'FPT University',
          banner_image_url: 'banner.jpg',
          thumbnail_url: 'thumb.jpg',
          speaker_count: 5,
        },
      ];

      vi.mocked(query).mockResolvedValue(mockEvents);

      const result = await getPublishedEvents('PUBLISHED');

      expect(query).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      const event = (result as any[])[0];
      expect(event.id).toBe('e1');
      expect(event.tagline).toBe('Finding Flow');
      expect(event.speakerCount).toBe(5);
      expect(event.highlights[0].text).toBe('5+ Speakers');
    });
  });

  describe('getEventById', () => {
    it('should return full event details including ticket types and seat map', async () => {
      const mockEvent = {
        id: 'e1',
        name: 'TEDxEvent: Finding Flow',
        slug: 'tedxevent-finding-flow',
        description: 'A great event',
        event_date: new Date('2026-03-15'),
        doors_open_time: new Date('2026-03-15T08:30:00Z'),
        end_time: new Date('2026-03-15T18:00:00Z'),
        venue: 'FPT University',
        banner_image_url: 'banner.jpg',
        thumbnail_url: 'thumb.jpg',
        status: 'PUBLISHED',
        max_capacity: 500,
        available_seats: 450,
        speaker_count: 5,
      };

      const mockTicketTypes = [
        {
          id: 'tt1',
          name: 'VIP',
          subtitle: 'Subtitle',
          description: 'VIP description',
          price: 150,
          benefits: '["Exclusive Dinner", "Front Row"]',
          level: 1,
          color: 'red',
        },
      ];

      const mockSeats = [
        {
          id: 'seat-1',
          seat_number: 1,
          row: 'A',
          section: 'VIP',
          seat_type: 'LEVEL_1',
          price: 150,
          status: 'AVAILABLE',
          locked_by: null,
          lock_expires_at: null,
        },
      ];

      vi.mocked(queryOne).mockResolvedValue(mockEvent as any);
      vi.mocked(query)
        .mockResolvedValueOnce(mockTicketTypes) // first call in getEventById for ticket_types
        .mockResolvedValueOnce(mockSeats);       // second call in getEventById for seats

      const result = await getEventById('e1', 'session-client-1');

      expect(queryOne).toHaveBeenCalled();
      expect(result.id).toBe('e1');
      expect(result.ticketTypes).toHaveLength(1);
      expect(result.ticketTypes[0].name).toBe('VIP');
      expect(result.ticketTypes[0].benefits).toEqual(['Exclusive Dinner', 'Front Row']);
      expect(result.seatMap).toHaveLength(1);
      expect(result.seatMap[0].row).toBe('A');
      expect(result.seatMap[0].seats).toHaveLength(1);
      expect(result.seatMap[0].seats[0].id).toBe('seat-1');
    });

    it('should throw NotFoundError if event does not exist', async () => {
      vi.mocked(queryOne).mockResolvedValue(null);

      await expect(getEventById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });
});
