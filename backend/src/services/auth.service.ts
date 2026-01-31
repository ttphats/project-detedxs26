import { prisma } from '../db/prisma.js';
import { hashPassword, comparePassword, signToken, JWTPayload } from '../utils/auth.js';
import { UnauthorizedError, ConflictError, BadRequestError } from '../utils/errors.js';

interface LoginInput {
  username: string;
  password: string;
}

interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
}

interface LoginResult {
  user: {
    id: string;
    email: string | null;
    fullName: string;
    role: string;
  };
  token: string;
}

export async function login(input: LoginInput, ip: string, userAgent?: string): Promise<LoginResult> {
  // Find user by username
  const user = await prisma.user.findUnique({
    where: { username: input.username },
    include: { role: true },
  });

  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('Invalid username or password');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is inactive');
  }

  // Verify password
  const isPasswordValid = await comparePassword(input.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid username or password');
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent: userAgent,
    },
  });

  // Generate JWT token
  const token = signToken({
    userId: user.id,
    email: user.email || '',
    roleId: user.roleId,
    roleName: user.role.name,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
    },
    token,
  };
}

export async function register(input: RegisterInput, ip: string, userAgent?: string): Promise<LoginResult> {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (existingUser) {
    throw new ConflictError('Email already registered');
  }

  // Get USER role
  const userRole = await prisma.role.findUnique({
    where: { name: 'USER' },
  });

  if (!userRole) {
    throw new BadRequestError('User role not found. Please run database migration.');
  }

  // Hash password
  const passwordHash = await hashPassword(input.password);

  // Generate username from email
  const baseUsername = input.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  let username = baseUsername;
  let suffix = 1;

  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${baseUsername}${suffix}`;
    suffix++;
  }

  // Create user
  const user = await prisma.user.create({
    data: {
      username,
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      roleId: userRole.id,
    },
    include: { role: true },
  });

  // Create audit log
  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'REGISTER',
      entity: 'User',
      entityId: user.id,
      ipAddress: ip,
      userAgent: userAgent,
    },
  });

  // Generate JWT token
  const token = signToken({
    userId: user.id,
    email: user.email || '',
    roleId: user.roleId,
    roleName: user.role.name,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role.name,
    },
    token,
  };
}

export async function getUserById(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phoneNumber: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
      role: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
    },
  });
}

