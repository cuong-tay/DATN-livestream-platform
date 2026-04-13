import { httpClient } from "./httpClient";
import { PaginatedResponse } from "./room.service";

export interface DonationItem {
  id: number;
  donorUsername: string;
  streamerUsername: string;
  amount: number;
  message: string;
  donatedAt: string;
}

export const donationService = {
  donate: (data: { streamerId: number; amount: number; message: string }) =>
    httpClient.post<DonationItem>("/donations", data),

  getSentDonations: (params?: { page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<DonationItem>>("/donations/sent", { params }),

  getReceivedDonations: (params?: { page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<DonationItem>>("/donations/received", { params }),

  getStreamerDonations: (streamerId: number, params?: { page?: number; size?: number }) =>
    httpClient.get<PaginatedResponse<DonationItem>>(`/donations/streamer/${streamerId}`, { params }),
};
