import { vi, describe, it, expect, beforeEach } from 'vitest';
import { login, register } from '../services/auth.service.js';
import { prisma } from '../db/prisma.js';
import { comparePassword, hashPassword, signToken } from '../utils/auth.js';
import { UnauthorizedError, ConflictError } from '../utils/errors.js';

vi.mock('../db/prisma.js', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    role: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../utils/auth.js', () => ({
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
  signToken: vi.fn(),
}));

describe('Authentication Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const mockUser = {
        id: 'u1',
        username: 'testuser',
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: 'hashed_password',
        isActive: true,
        roleId: 'r1',
        role: { name: 'USER' },
      };

      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(comparePassword).mockResolvedValue(true as any);
      vi.mocked(prisma.user.update).mockResolvedValue({} as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(signToken).mockReturnValue('mocked_jwt_token');

      const result = await login(
        { username: 'testuser', password: 'password123' },
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: {
          OR: [{ username: 'testuser' }, { email: 'testuser' }],
        },
        include: { role: true },
      });
      expect(comparePassword).toHaveBeenCalledWith('password123', 'hashed_password');
      expect(result.token).toBe('mocked_jwt_token');
      expect(result.user.fullName).toBe('Test User');
      expect(result.user.roleName).toBe('USER');
    });

    it('should throw UnauthorizedError when user is not found', async () => {
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null);

      await expect(
        login({ username: 'nonexistent', password: 'password123' }, '127.0.0.1')
      ).rejects.toThrow(UnauthorizedError);
    });

    it('should throw UnauthorizedError when password is invalid', async () => {
      const mockUser = {
        id: 'u1',
        username: 'testuser',
        passwordHash: 'hashed_password',
        isActive: true,
        roleId: 'r1',
        role: { name: 'USER' },
      };

      vi.mocked(prisma.user.findFirst).mockResolvedValue(mockUser as any);
      vi.mocked(comparePassword).mockResolvedValue(false as any);

      await expect(
        login({ username: 'testuser', password: 'wrongpassword' }, '127.0.0.1')
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockRole = { id: 'r1', name: 'USER' };
      const mockCreatedUser = {
        id: 'u2',
        username: 'newuser',
        email: 'new@example.com',
        fullName: 'New User',
        roleId: 'r1',
        role: { name: 'USER' },
      };

      vi.mocked(prisma.user.findUnique)
        .mockResolvedValueOnce(null) // for email check
        .mockResolvedValueOnce(null); // for username collision check
      vi.mocked(prisma.role.findUnique).mockResolvedValue(mockRole as any);
      vi.mocked(hashPassword).mockResolvedValue('new_hashed_password' as any);
      vi.mocked(prisma.user.create).mockResolvedValue(mockCreatedUser as any);
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as any);
      vi.mocked(signToken).mockReturnValue('new_jwt_token');

      const result = await register(
        {
          email: 'new@example.com',
          password: 'password123',
          fullName: 'New User',
        },
        '127.0.0.1'
      );

      expect(prisma.user.create).toHaveBeenCalled();
      expect(result.token).toBe('new_jwt_token');
      expect(result.user.email).toBe('new@example.com');
      expect(result.user.roleName).toBe('USER');
    });

    it('should throw ConflictError if email is already taken', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as any);

      await expect(
        register(
          {
            email: 'existing@example.com',
            password: 'password123',
            fullName: 'Existing User',
          },
          '127.0.0.1'
        )
      ).rejects.toThrow(ConflictError);
    });
  });
});
