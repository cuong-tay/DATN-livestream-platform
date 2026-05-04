import { httpClient } from "./httpClient";

export interface PublicUserProfile {
  userId: number;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number;
  email?: string | null;
  role?: string | null;
}

export const userService = {
  /** GET /users/{streamerId} — public profile */
  getPublicProfile: (streamerId: number) =>
    httpClient.get<PublicUserProfile>(`/users/${streamerId}`, {
      skipAuth: true,
    }),
};
