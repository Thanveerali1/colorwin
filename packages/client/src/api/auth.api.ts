import { api } from './axios';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export interface MeResponse {
  name: string;
  email: string;
  emailVerified: boolean;
}

export async function signupRequest(name: string, email: string, password: string) {
  const res = await api.post<AuthResponse>('/auth/signup', { name, email, password });
  return res.data;
}

export async function loginRequest(email: string, password: string) {
  const res = await api.post<AuthResponse>('/auth/login', { email, password });
  return res.data;
}

export async function googleLoginRequest(idToken: string) {
  const res = await api.post<AuthResponse & { name: string }>('/auth/google', { idToken });
  return res.data;
}

export async function requestResetRequest(email: string) {
  const res = await api.post<{ message: string }>('/auth/request-reset', { email });
  return res.data;
}

export async function resetPasswordRequest(email: string, otp: string, newPassword: string) {
  const res = await api.post<{ message: string }>('/auth/reset-password', {
    email,
    otp,
    newPassword,
  });
  return res.data;
}

export async function verifyEmailRequest(token: string) {
  const res = await api.post<{ message: string }>('/auth/verify-email', { token });
  return res.data;
}

export async function resendVerificationRequest() {
  const res = await api.post<{ message: string }>('/auth/resend-verification');
  return res.data;
}

export async function getMeRequest() {
  const res = await api.get<MeResponse>('/auth/me');
  return res.data;
}