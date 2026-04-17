"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, Lock, User, Building2, UserPlus } from "lucide-react";
import api from "@/lib/api";

// ── Validation ────────────────────────────────────────────────────────────────

const schema = z
  .object({
    display_name: z
      .string()
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name is too long"),
    email: z.string().email("Enter a valid email address"),
    department: z.string().max(80, "Department name is too long").optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number"),
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path:    ["confirm_password"],
  });

type FormValues = z.infer<typeof schema>;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();

  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    setFormError(null);
    try {
      await api.post("/api/v1/auth/register", {
        display_name: data.display_name,
        email:        data.email,
        password:     data.password,
        department:   data.department ?? "",
      });
      // Backend created the Firebase user and set the student role claim.
      router.push("/login?registered=true");
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const friendly = raw.includes("already")
        ? "An account with this email already exists."
        : raw.includes("domain") || raw.includes("institute")
        ? raw
        : "Registration failed. Please try again.";
      setFormError(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Header above card */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30 mb-4">
          <UserPlus className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
          Create account
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Register with your institute email to get started
        </p>
      </div>

      {/* Card */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-8 space-y-6">
        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Display name */}
          <div className="space-y-1.5">
            <label htmlFor="display_name" className="block text-sm font-medium text-gray-700">
              Full name
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                id="display_name"
                type="text"
                autoComplete="name"
                placeholder="Jane Doe"
                className="input-base pl-10"
                disabled={submitting}
                {...register("display_name")}
              />
            </div>
            {errors.display_name && (
              <p className="text-xs text-red-600">{errors.display_name.message}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Institute email
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
              <p className="text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          {/* Department (optional) */}
          <div className="space-y-1.5">
            <label htmlFor="department" className="block text-sm font-medium text-gray-700">
              Department <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                id="department"
                type="text"
                placeholder="Computer Engineering"
                className="input-base pl-10"
                disabled={submitting}
                {...register("department")}
              />
            </div>
            {errors.department && (
              <p className="text-xs text-red-600">{errors.department.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Min 8 chars, 1 uppercase, 1 number"
                className="input-base pl-10"
                disabled={submitting}
                {...register("password")}
              />
            </div>
            {errors.password && (
              <p className="text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
              Confirm password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                id="confirm_password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="input-base pl-10"
                disabled={submitting}
                {...register("confirm_password")}
              />
            </div>
            {errors.confirm_password && (
              <p className="text-xs text-red-600">{errors.confirm_password.message}</p>
            )}
          </div>

          {/* Server error */}
          {formError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full py-3 mt-2"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="text-blue-600 font-semibold hover:text-indigo-600 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </>
  );
}
