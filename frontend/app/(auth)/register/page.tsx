"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, Lock, User, Building2 } from "lucide-react";
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
      // Redirect to login with a success toast trigger.
      router.push("/login?registered=true");
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const friendly = raw.includes("already")
        ? "An account with this email already exists."
        : raw.includes("domain") || raw.includes("institute")
        ? raw // backend sends an actionable message for domain validation
        : "Registration failed. Please try again.";
      setFormError(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-gray-900">Create account</h1>
        <p className="text-sm text-gray-500">
          Register with your institute email to get started
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Display name */}
        <div className="space-y-1">
          <label htmlFor="display_name" className="block text-sm font-medium text-gray-700">
            Full name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="display_name"
              type="text"
              autoComplete="name"
              placeholder="Jane Doe"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-50 disabled:text-gray-400"
              disabled={submitting}
              {...register("display_name")}
            />
          </div>
          {errors.display_name && (
            <p className="text-xs text-red-600">{errors.display_name.message}</p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Institute email
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

        {/* Department (optional) */}
        <div className="space-y-1">
          <label htmlFor="department" className="block text-sm font-medium text-gray-700">
            Department <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="department"
              type="text"
              placeholder="Computer Engineering"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-50 disabled:text-gray-400"
              disabled={submitting}
              {...register("department")}
            />
          </div>
          {errors.department && (
            <p className="text-xs text-red-600">{errors.department.message}</p>
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
              autoComplete="new-password"
              placeholder="Min 8 chars, 1 uppercase, 1 number"
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

        {/* Confirm password */}
        <div className="space-y-1">
          <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700">
            Confirm password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-50 disabled:text-gray-400"
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
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="text-blue-600 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
