import { vi, describe, it, expect, beforeEach } from 'vitest';
import { calculateBestDiscount } from '../services/promotions.service.js';
import { query } from '../db/mysql.js';

vi.mock('../db/mysql.js', () => ({
  query: vi.fn(),
  execute: vi.fn(),
  queryOne: vi.fn(),
}));

describe('Promotions Service - calculateBestDiscount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null if no tickets are passed', async () => {
    const result = await calculateBestDiscount({ eventId: 'e1', tickets: [] });
    expect(result).toBeNull();
  });

  it('should apply combo multiplication for fixed discounts', async () => {
    const mockPromotions = [
      {
        id: 'promo-1',
        event_id: 'e1',
        name: 'Group Combo 3',
        type: 'COMBO',
        discount_type: 'FIXED_AMOUNT',
        discount_value: 100000,
        code: null,
        min_tickets: 3,
        max_tickets: null,
        ticket_type_ids: null,
        is_active: 1,
        start_date: new Date(Date.now() - 100000),
        end_date: new Date(Date.now() + 100000),
        max_usage: null,
        used_count: 0,
      },
    ];

    vi.mocked(query).mockResolvedValue(mockPromotions as any);

    // Case 1: 5 tickets -> floor(5 / 3) = 1 combo = 100,000 VND discount
    const result1 = await calculateBestDiscount({
      eventId: 'e1',
      tickets: [
        { id: '1', price: 200000 },
        { id: '2', price: 200000 },
        { id: '3', price: 200000 },
        { id: '4', price: 200000 },
        { id: '5', price: 200000 },
      ],
    });
    expect(result1?.discountAmount).toBe(100000);

    // Case 2: 6 tickets -> floor(6 / 3) = 2 combos = 200,000 VND discount
    const result2 = await calculateBestDiscount({
      eventId: 'e1',
      tickets: [
        { id: '1', price: 200000 },
        { id: '2', price: 200000 },
        { id: '3', price: 200000 },
        { id: '4', price: 200000 },
        { id: '5', price: 200000 },
        { id: '6', price: 200000 },
      ],
    });
    expect(result2?.discountAmount).toBe(200000);
  });

  it('should apply combo multiplication for percentage discounts, selecting most expensive tickets first', async () => {
    const mockPromotions = [
      {
        id: 'promo-2',
        event_id: 'e1',
        name: 'Group Combo 3 - 10%',
        type: 'COMBO',
        discount_type: 'PERCENTAGE',
        discount_value: 10,
        code: null,
        min_tickets: 3,
        max_tickets: null,
        ticket_type_ids: null,
        is_active: 1,
        start_date: new Date(Date.now() - 100000),
        end_date: new Date(Date.now() + 100000),
        max_usage: null,
        used_count: 0,
      },
    ];

    vi.mocked(query).mockResolvedValue(mockPromotions as any);

    // 4 tickets with prices: 300, 300, 100, 100.
    // min_tickets = 3 -> multiplier = 1.
    // Most expensive 3 tickets: 300, 300, 100. Total = 700.
    // Discount = 10% of 700 = 70.
    const result = await calculateBestDiscount({
      eventId: 'e1',
      tickets: [
        { id: '1', price: 100 },
        { id: '2', price: 300 },
        { id: '3', price: 100 },
        { id: '4', price: 300 },
      ],
    });
    expect(result?.discountAmount).toBe(70);
  });

  it('should pick the best promotion yielding the highest discount', async () => {
    const mockPromotions = [
      {
        id: 'promo-1', // Combo 3 giving 100,000 VND off
        event_id: 'e1',
        name: 'Combo 3',
        type: 'COMBO',
        discount_type: 'FIXED_AMOUNT',
        discount_value: 100000,
        code: null,
        min_tickets: 3,
        max_tickets: null,
        ticket_type_ids: null,
        is_active: 1,
        start_date: new Date(Date.now() - 100000),
        end_date: new Date(Date.now() + 100000),
        max_usage: null,
        used_count: 0,
      },
      {
        id: 'promo-2', // Early bird 20% off
        event_id: 'e1',
        name: 'Early Bird',
        type: 'EARLY_BIRD',
        discount_type: 'PERCENTAGE',
        discount_value: 20,
        code: null,
        min_tickets: null,
        max_tickets: null,
        ticket_type_ids: null,
        is_active: 1,
        start_date: new Date(Date.now() - 100000),
        end_date: new Date(Date.now() + 100000),
        max_usage: null,
        used_count: 0,
      },
    ];

    vi.mocked(query).mockResolvedValue(mockPromotions as any);

    // 3 tickets of 200,000 VND each. Total = 600,000 VND.
    // Combo 3 discount = 100,000 VND.
    // Early Bird (20%) discount = 120,000 VND.
    // Should choose Early Bird (120,000 VND).
    const result = await calculateBestDiscount({
      eventId: 'e1',
      tickets: [
        { id: '1', price: 200000 },
        { id: '2', price: 200000 },
        { id: '3', price: 200000 },
      ],
    });
    expect(result?.promotionId).toBe('promo-2');
    expect(result?.discountAmount).toBe(120000);
  });
});
