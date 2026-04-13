import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import type { UserProfile } from "@/entities/user";
import {
  authService,
  type LoginRequest,
  type RegisterRequest,
  type AuthResponse,
  type ApiError,
} from "@/shared/api/auth.service";
import type { AxiosError } from "axios";

// ── Types ────────────────────────────────────────────────────────────────────

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
}

// ── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helper: extract error message from API ───────────────────────────────────

function extractErrorMessage(error: unknown): string {
  const axiosErr = error as AxiosError<ApiError>;
  if (axiosErr.response?.data?.message) {
    return axiosErr.response.data.message;
  }
  if (axiosErr.message) {
    return axiosErr.message;
  }
  return "Đã xảy ra lỗi không rõ. Vui lòng thử lại.";
}

// ── Helper: map AuthResponse → persisted UserProfile ─────────────────────────

function mapAuthResponseToUser(res: AuthResponse): UserProfile {
  return {
    userId: res.user.userId,
    id: String(res.user.userId),
    username: res.user.username,
    email: res.user.email,
    role: res.user.role,
  };
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true while restoring session

  // ── Restore session from localStorage on mount ─────────────────────────
  useEffect(() => {
    try {
      const token = localStorage.getItem("accessToken");
      const stored = localStorage.getItem("authUser");
      if (token && stored) {
        const parsed = JSON.parse(stored) as UserProfile;
        setUser(parsed);
      }
    } catch {
      // corrupt data → ignore
      localStorage.removeItem("authUser");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Listen for forced logout (emitted by httpClient 401 interceptor) ───
  useEffect(() => {
    const handleForceLogout = () => {
      setUser(null);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("authUser");
    };
    window.addEventListener("auth:logout", handleForceLogout);
    return () => window.removeEventListener("auth:logout", handleForceLogout);
  }, []);

  // ── Persist tokens & user helper ───────────────────────────────────────
  const persistSession = useCallback((data: AuthResponse) => {
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);
    const profile = mapAuthResponseToUser(data);
    localStorage.setItem("authUser", JSON.stringify(profile));
    setUser(profile);
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────
  const login = useCallback(
    async (data: LoginRequest) => {
      try {
        const res = await authService.login(data);
        persistSession(res.data);
      } catch (error) {
        throw new Error(extractErrorMessage(error));
      }
    },
    [persistSession],
  );

  // ── Register ───────────────────────────────────────────────────────────
  const register = useCallback(
    async (data: RegisterRequest) => {
      try {
        const res = await authService.register(data);
        persistSession(res.data);
      } catch (error) {
        throw new Error(extractErrorMessage(error));
      }
    },
    [persistSession],
  );

  // ── Google login ───────────────────────────────────────────────────────
  const loginWithGoogle = useCallback(
    async (idToken: string) => {
      try {
        const res = await authService.loginWithGoogle({ idToken });
        persistSession(res.data);
      } catch (error) {
        throw new Error(extractErrorMessage(error));
      }
    },
    [persistSession],
  );

  // ── Logout ─────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("authUser");
  }, []);

  // ── Context value ──────────────────────────────────────────────────────
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      register,
      loginWithGoogle,
      logout,
    }),
    [user, isLoading, login, register, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
