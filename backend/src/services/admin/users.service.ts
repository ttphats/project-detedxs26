import { prisma } from '../../db/prisma.js';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';

export interface ListUsersInput {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
}

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
  role: string;
}

export interface UpdateUserInput {
  email?: string;
  fullName?: string;
  phone?: string;
  role?: string;
  isActive?: boolean;
}

/**
 * List users with pagination and filters
 */
export async function listUsers(input: ListUsersInput) {
  const page = input.page || 1;
  const limit = input.limit || 20;
  const skip = (page - 1) * limit;

  const where: any = {};

  if (input.search) {
    where.OR = [
      { username: { contains: input.search } },
      { email: { contains: input.search } },
      { fullName: { contains: input.search } },
    ];
  }

  if (input.role) {
    where.role = { name: input.role };
  }

  if (input.status === 'active') {
    where.isActive = true;
  } else if (input.status === 'inactive') {
    where.isActive = false;
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        roleId: true,
        role: { select: { name: true } },
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Get user by ID
 */
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      roleId: true,
      role: { select: { name: true } },
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Create new user
 */
export async function createUser(input: CreateUserInput) {
  const id = randomUUID();
  const hashedPassword = await bcrypt.hash(input.password, 10);

  // Find role by name
  const role = await prisma.role.findFirst({ where: { name: input.role } });
  if (!role) {
    throw new Error(`Role '${input.role}' not found`);
  }

  return prisma.user.create({
    data: {
      id,
      username: input.username,
      email: input.email,
      passwordHash: hashedPassword,
      fullName: input.fullName || input.username,
      phoneNumber: input.phone,
      roleId: role.id,
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      roleId: true,
      role: { select: { name: true } },
      isActive: true,
      createdAt: true,
    },
  });
}

/**
 * Update user
 */
export async function updateUser(id: string, input: UpdateUserInput) {
  const data: any = {};

  if (input.email !== undefined) data.email = input.email;
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.phone !== undefined) data.phoneNumber = input.phone;
  if (input.isActive !== undefined) data.isActive = input.isActive;

  // Handle role change
  if (input.role !== undefined) {
    const role = await prisma.role.findFirst({ where: { name: input.role } });
    if (role) {
      data.roleId = role.id;
    }
  }

  return prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      roleId: true,
      role: { select: { name: true } },
      isActive: true,
      updatedAt: true,
    },
  });
}

/**
 * Delete user
 */
export async function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

/**
 * Check if user can manage role
 */
export function canManageRole(actorRole: string, targetRole: string): boolean {
  // Only SUPER_ADMIN can manage ADMIN users
  if (targetRole === 'ADMIN' && actorRole !== 'SUPER_ADMIN') {
    return false;
  }
  return true;
}

