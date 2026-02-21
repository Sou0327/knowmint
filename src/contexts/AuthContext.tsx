"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile, UserType } from "@/types/database.types";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
    userType: UserType
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (
    data: Partial<Pick<Profile, "display_name" | "avatar_url" | "bio" | "wallet_address">>
  ) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getSupabaseConfigError(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return "Supabaseの環境変数が未設定です。.env.localを確認してください。";
  }

  if (
    url.includes("your-project.supabase.co") ||
    anonKey === "your-anon-key-here"
  ) {
    return "Supabaseの接続設定がサンプル値のままです。.env.localに実際のProject URLとanon keyを設定してください。";
  }

  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabase] = useState(() => createClient());

  const fetchProfile = useCallback(
    async (userId: string) => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile(data);
    },
    [supabase]
  );

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase, fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const configError = getSupabaseConfigError();
    if (configError) return { error: configError };

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return { error: error?.message ?? null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: `認証APIへの接続に失敗しました: ${message}` };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    displayName: string,
    userType: UserType
  ) => {
    const configError = getSupabaseConfigError();
    if (configError) return { error: configError };

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName, user_type: userType },
        },
      });
      return { error: error?.message ?? null };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return { error: `認証APIへの接続に失敗しました: ${message}` };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setSession(null);
  };

  const updateProfile = async (
    data: Partial<Pick<Profile, "display_name" | "avatar_url" | "bio" | "wallet_address">>
  ) => {
    if (!user) return { error: "Not authenticated" };
    const { error } = await supabase
      .from("profiles")
      .update(data)
      .eq("id", user.id);
    if (!error) {
      await fetchProfile(user.id);
    }
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
