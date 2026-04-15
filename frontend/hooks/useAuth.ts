"use client";

import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import api from "@/lib/api";
import type { UserProfile } from "@/types";

interface AuthState {
  user:       UserProfile | null;
  firebaseUser: User | null;
  loading:    boolean;
  error:      string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user:         null,
    firebaseUser: null,
    loading:      true,
    error:        null,
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setState({ user: null, firebaseUser: null, loading: false, error: null });
        return;
      }

      try {
        // Get Firebase ID token and exchange it for our backend profile
        const idToken = await firebaseUser.getIdToken();
        const { data } = await api.post<{ user: UserProfile }>("/api/v1/auth/verify-token", {
          id_token: idToken,
        });
        setState({ user: data.user, firebaseUser, loading: false, error: null });
      } catch {
        // Token valid but no backend profile yet (e.g. during registration)
        setState({ user: null, firebaseUser, loading: false, error: null });
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged above will pick up the new user and fetch the profile
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setState((s) => ({ ...s, loading: false, error: message }));
      throw err;
    }
  };

  const logout = async () => {
    await signOut(auth);
    setState({ user: null, firebaseUser: null, loading: false, error: null });
  };

  return { ...state, login, logout };
}
