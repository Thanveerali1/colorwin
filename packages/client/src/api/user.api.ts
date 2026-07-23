import { api } from './axios';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';

export interface Profile {
  id: string;
  name: string;
  surname: string | null;
  email: string;
  phone: string | null;
  dateOfBirth: string | null; // ISO date string
  gender: Gender | null;
  country: string | null;
  city: string | null;
  emailVerified: boolean;
  profileCompleted: boolean;
  createdAt: string;
}

export interface UpdateProfileInput {
  name?: string;
  surname?: string;
  phone?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  gender?: Gender;
  country?: string;
  city?: string;
}

export async function getProfile() {
  const res = await api.get<Profile>('/user/me');
  return res.data;
}

export async function updateProfileRequest(data: UpdateProfileInput) {
  const res = await api.patch<Profile>('/user/me', data);
  return res.data;
}