/**
 * Authentication API — maps to /auth/* backend endpoints.
 */
import { api, setTokens, clearTokens } from "./client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  session_id: string;
  token_type: string;
}

export interface RegisterResponse {
  id: string;
  email: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  permissions?: string[];
}

export interface SessionInfo {
  id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

// ── API Functions ────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await api.post<LoginResponse>("/auth/login", { email, password }, { noAuth: true });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function register(
  email: string,
  password: string,
  fullName: string,
): Promise<RegisterResponse> {
  return api.post<RegisterResponse>(
    "/auth/register",
    { email, password, full_name: fullName },
    { noAuth: true },
  );
}

export async function getMe(): Promise<UserProfile> {
  return api.get<UserProfile>("/auth/me");
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } finally {
    clearTokens();
  }
}

export async function requestOtp(
  email: string,
  purpose: "registration" | "login" | "password_reset",
) {
  return api.post<{ email: string; otp_sent: boolean; expires_in: number }>(
    "/auth/request-otp",
    { email, purpose },
    { noAuth: true },
  );
}

export async function verifyOtp(
  email: string,
  otp: string,
  purpose: "registration" | "login" | "password_reset",
) {
  const data = await api.post<LoginResponse>(
    "/auth/verify-otp",
    { email, otp, purpose },
    { noAuth: true },
  );
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function resendOtp(
  email: string,
  purpose: "registration" | "login" | "password_reset",
) {
  return requestOtp(email, purpose);
}

export async function forgotPassword(email: string) {
  return api.post<{ email: string; otp_sent: boolean; expires_in: number }>(
    "/auth/forgot-password",
    { email, purpose: "password_reset" },
    { noAuth: true },
  );
}

export async function resetPassword(
  token?: string,
  password?: string,
): Promise<{ reset: boolean }> {
  return api.post("/auth/reset-password", { token, password }, { noAuth: true });
}

export async function changePassword(newPassword: string): Promise<{ changed: boolean }> {
  return api.post("/auth/change-password", { new_password: newPassword });
}

export async function getSessions(): Promise<SessionInfo[]> {
  return api.get<SessionInfo[]>("/auth/sessions");
}

export async function revokeSession(sessionId: string): Promise<{ revoked: string }> {
  return api.post<{ revoked: string }>(`/auth/sessions/${sessionId}/revoke`);
}

export interface ApplicantProfileData {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  profile: {
    personal?: Record<string, string>;
    communication?: { emailNotifs?: boolean; smsNotifs?: boolean; whatsappNotifs?: boolean };
    st?: Record<string, string>;
    institution?: Record<string, string>;
    contact?: Record<string, string>;
    address?: Record<string, string>;
    family?: Record<string, string>;
    income?: { annual?: string; source?: string; certificateAvailable?: boolean };
    academic?: Array<{ level: string; board?: string; university?: string; year: string; marks: string }>;
    research?: Record<string, unknown>;
    bank?: Record<string, string>;
    [key: string]: unknown;
  };
}

export async function getApplicantProfile(): Promise<ApplicantProfileData> {
  return api.get<ApplicantProfileData>("/applicant/profile");
}

export async function updateApplicantProfile(data: {
  full_name?: string;
  profile: Record<string, unknown>;
}): Promise<ApplicantProfileData> {
  return api.put<ApplicantProfileData>("/applicant/profile", data);
}
