/** Public (unauthenticated) API — maps to /public/* */
import { api } from "./client";

export interface EnquiryInput {
  name: string;
  email: string;
  phone?: string | undefined;
  topic?: string | undefined;
  message: string;
}

export interface EnquiryResult {
  id: string;
  reference: string;
  status: string | null;
}

export function submitEnquiry(data: EnquiryInput) {
  return api.post<EnquiryResult>("/public/enquiries", data, { noAuth: true });
}
