"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";
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
  const { user, loading, error: authError, login } = useAuth();

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
      document.cookie = `grievance_role=${user.role}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 7}`;
      router.replace(ROLE_ROUTES[user.role] ?? "/student/dashboard");
    }
  }, [user, loading, router]);

  // Show spinner while Firebase auth OR verify-token is in flight
  const isBusy = submitting || (loading && !authError);

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    setFormError(null);
    try {
      await login(data.email, data.password);
      // Redirect is handled by the useEffect above once onAuthStateChanged fires
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
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
    <>
      <Suspense fallback={null}>
        <RegisteredToast />
      </Suspense>

      {/* Mobile-only logo (desktop shows it in the left panel) */}
      <div className="lg:hidden text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 mb-3">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <p className="text-xs font-semibold text-blue-700 tracking-wide uppercase">Grievance Portal</p>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
        <p className="text-sm text-slate-500 mt-1">Sign in to your account to continue</p>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 space-y-6">
        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="label">
              Email address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@institute.edu"
                className="input-base pl-10"
                disabled={submitting}
                {...register("email")}
              />
            </div>
            {errors.email && (
              <p className="text-xs text-red-600 flex items-center gap-1 mt-1">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="label">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                className="input-base pl-10"
                disabled={submitting}
                {...register("password")}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-600 mt-1">{errors.password.message}</p>
            )}
          </div>

          {/* Server-side / Firebase error */}
          {(formError || authError) && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError || authError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isBusy}
            className="btn-primary w-full py-3"
          >
            {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isBusy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-blue-600 font-semibold hover:text-indigo-600 transition-colors">
            Register
          </Link>
        </p>
      </div>

      <p className="text-center text-xs text-slate-400 mt-6 flex items-center justify-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" />
        Secured by blockchain · immutable audit trail
      </p>
    </>
  );
}
