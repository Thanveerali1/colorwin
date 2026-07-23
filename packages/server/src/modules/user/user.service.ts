import { prisma } from '../../lib/prisma';
import type { UpdateProfileInput } from './user.schema';

const profileSelect = {
  id: true,
  name: true,
  surname: true,
  email: true,
  phone: true,
  dateOfBirth: true,
  gender: true,
  country: true,
  city: true,
  emailVerified: true,
  profileCompleted: true,
  createdAt: true,
} as const;

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: profileSelect });
  if (!user) throw new Error('USER_NOT_FOUND');
  return user;
}

export async function updateProfile(userId: string, data: UpdateProfileInput) {
  // The real lock lives here, not in the UI -- a user could otherwise hit the
  // API directly and bypass a client-side-only restriction.
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { profileCompleted: true },
  });
  if (!existing) throw new Error('USER_NOT_FOUND');
  if (existing.profileCompleted) throw new Error('PROFILE_LOCKED');

  const updateData: Record<string, unknown> = { profileCompleted: true };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.surname !== undefined) updateData.surname = data.surname || null;
  if (data.phone !== undefined) updateData.phone = data.phone || null;
  if (data.gender !== undefined) updateData.gender = data.gender || null;
  if (data.country !== undefined) updateData.country = data.country || null;
  if (data.city !== undefined) updateData.city = data.city || null;
  if (data.dateOfBirth !== undefined) {
    updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: profileSelect,
    });
    return user;
  } catch (err: any) {
    if (err.code === 'P2025') throw new Error('USER_NOT_FOUND');
    throw err;
  }
}