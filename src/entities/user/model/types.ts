export interface UserProfile {
  /** Numeric ID from the backend API */
  userId: number;
  /** Legacy string ID – kept for backward compatibility */
  id: string;
  username: string;
  email: string;
  role: "USER" | "ADMIN";
  avatar?: string;
  balance?: number;
}
