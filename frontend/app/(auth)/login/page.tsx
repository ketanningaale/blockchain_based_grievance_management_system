"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Lock, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Role } from "@/types";

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z.object({
  email:    z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type FormValues = z.infer<typeof schema>;

// ── Role → path mapping (mirrors middleware.ts) ───────────────────────────────

const ROLE_ROUTES: Record<Role, string> = {
  student:   "/student/dashboard",
  committee: "/committee/dashboard",
  hod:       "/hod/dashboard",
  principal: "/principal/dashboard",
  admin:     "/admin/dashboard",
};

// ── Registered toast (isolated so useSearchParams is inside Suspense) ─────────

function RegisteredToast() {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("registered") === "true") {
      toast.success("Account created — please sign in.");
    }
  }, [searchParams]);
  return null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login } = useAuth();

  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  // Redirect once the auth hook has resolved the user profile
  useEffect(() => {
    if (!loading && user) {
      // Persist role to the cookie that Edge middleware reads for UX redirects.
      // (Not trusted for security — the backend always re-validates the Bearer token.)
      document.cookie = `grievance_role=${user.role}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`;
      router.replace(ROLE_ROUTES[user.role] ?? "/student/dashboard");
    }
  }, [user, loading, router]);

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    setFormError(null);
    try {
      await login(data.email, data.password);
      // Redirect is handled by the useEffect above once onAuthStateChanged fires
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      // Make Firebase error codes human-readable
      const friendly = raw.includes("user-not-found") || raw.includes("wrong-password") || raw.includes("invalid-credential")
        ? "Invalid email or password."
        : raw.includes("too-many-requests")
        ? "Too many attempts — please try again later."
        : "Sign in failed. Please try again.";
      setFormError(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
      <Suspense fallback={null}>
        <RegisteredToast />
      </Suspense>
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-sm text-gray-500">Sign in to your Grievance Portal account</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email */}
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@institute.edu"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-50 disabled:text-gray-400"
              disabled={submitting}
              {...register("email")}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-50 disabled:text-gray-400"
              disabled={submitting}
              {...register("password")}
            />
          </div>
          {errors.password && (
            <p className="text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        {/* Server-side / Firebase error */}
        {formError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {formError}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 text-white
                     rounded-lg font-medium text-sm hover:bg-blue-700 focus:outline-none focus:ring-2
                     focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed
                     transition-colors"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-blue-600 font-medium hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
