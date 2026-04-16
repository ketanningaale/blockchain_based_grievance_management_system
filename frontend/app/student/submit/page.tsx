"use client";

export const dynamic = "force-dynamic";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  Upload,
  X,
  FileText,
  Eye,
  EyeOff,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import api from "@/lib/api";

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Academic",
  "Administrative",
  "Examination",
  "Hostel",
  "Infrastructure",
  "Library",
  "Other",
] as const;

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
const MAX_FILE_SIZE  = 10 * 1024 * 1024;  // 10 MB
const MAX_FILE_COUNT = 5;

// ── Validation ─────────────────────────────────────────────────────────────────

const schema = z.object({
  title:       z.string().min(5,  "Title must be at least 5 characters").max(200),
  category:    z.enum(CATEGORIES, { errorMap: () => ({ message: "Select a category" }) }),
  sub_category: z.string().max(80).optional(),
  department:  z.string().min(2, "Department is required").max(80),
  description: z.string().min(20, "Description must be at least 20 characters").max(5000),
  is_anonymous: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

// ── File-validation helper (client-side) ───────────────────────────────────────

function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME.has(file.type))
    return `${file.name}: unsupported file type (PDF, JPG, PNG, WEBP, DOCX only)`;
  if (file.size > MAX_FILE_SIZE)
    return `${file.name}: exceeds 10 MB limit`;
  return null;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SubmitGrievancePage() {
  const router      = useRouter();
  const { user }    = useAuth();

  const [files,      setFiles]      = useState<File[]>([]);
  const [dragging,   setDragging]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      department:   user?.department ?? "",
      is_anonymous: false,
    },
  });

  const isAnonymous = watch("is_anonymous");

  // ── File handlers ───────────────────────────────────────────────────────────

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming);
    const errors: string[] = [];
    const valid: File[] = [];

    for (const f of arr) {
      const err = validateFile(f);
      if (err) { errors.push(err); continue; }
      valid.push(f);
    }

    setFiles((prev) => {
      const merged = [...prev, ...valid];
      if (merged.length > MAX_FILE_COUNT) {
        toast.error(`Maximum ${MAX_FILE_COUNT} attachments allowed.`);
        return merged.slice(0, MAX_FILE_COUNT);
      }
      return merged;
    });

    if (errors.length) toast.error(errors.join("\n"));
  }, []);

  const removeFile = (idx: number) =>
    setFiles((prev) => prev.filter((_, i) => i !== idx));

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  // ── Submit ──────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("title",        data.title);
      form.append("category",     data.category);
      form.append("sub_category", data.sub_category ?? "");
      form.append("department",   data.department);
      form.append("description",  data.description);
      form.append("is_anonymous", String(data.is_anonymous));
      files.forEach((f) => form.append("files", f));

      await api.post("/api/v1/grievances", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("Grievance submitted successfully!");
      router.push("/student/dashboard");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/student/dashboard"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Back to dashboard"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Submit Grievance</h1>
          <p className="text-sm text-gray-500">
            All submissions are recorded on-chain — immutable and tamper-proof.
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100"
        noValidate
      >
        {/* ── Section 1: Core details ───────────────────────────────────── */}
        <div className="p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Grievance Details
          </h2>

          {/* Title */}
          <Field label="Title" error={errors.title?.message}>
            <input
              type="text"
              placeholder="Brief description of the issue"
              className={inputCls(!!errors.title)}
              disabled={submitting}
              {...register("title")}
            />
          </Field>

          {/* Category + Sub-category */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Category" error={errors.category?.message}>
              <select
                className={inputCls(!!errors.category)}
                disabled={submitting}
                defaultValue=""
                {...register("category")}
              >
                <option value="" disabled>Select category…</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <Field
              label={<>Sub-category <Opt /></>}
              error={errors.sub_category?.message}
            >
              <input
                type="text"
                placeholder="e.g. Marks dispute"
                className={inputCls(!!errors.sub_category)}
                disabled={submitting}
                {...register("sub_category")}
              />
            </Field>
          </div>

          {/* Department */}
          <Field label="Department" error={errors.department?.message}>
            <input
              type="text"
              placeholder="e.g. Computer Engineering"
              className={inputCls(!!errors.department)}
              disabled={submitting}
              {...register("department")}
            />
          </Field>

          {/* Description */}
          <Field label="Description" error={errors.description?.message}>
            <textarea
              rows={5}
              placeholder="Describe the issue in detail — what happened, when, who was involved…"
              className={cn(inputCls(!!errors.description), "resize-none")}
              disabled={submitting}
              {...register("description")}
            />
            <p className="text-xs text-gray-400 mt-1">
              Stored on IPFS — not modifiable after submission.
            </p>
          </Field>
        </div>

        {/* ── Section 2: Attachments ────────────────────────────────────── */}
        <div className="p-6 space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Attachments <span className="font-normal text-gray-400 normal-case">(optional, max 5 × 10 MB)</span>
          </h2>

          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              dragging
                ? "border-blue-400 bg-blue-50"
                : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
            )}
          >
            <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Drag & drop files here, or{" "}
              <span className="text-blue-600 font-medium">browse</span>
            </p>
            <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG, WEBP, DOCX</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
          </div>

          {/* File list */}
          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 px-3 py-2
                             bg-gray-50 rounded-lg border border-gray-200 text-sm"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="truncate text-gray-700">{f.name}</span>
                    <span className="text-gray-400 shrink-0">
                      ({(f.size / 1024 / 1024).toFixed(1)} MB)
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-700 transition-colors"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Section 3: Privacy + submit ───────────────────────────────── */}
        <div className="p-6 space-y-4">
          {/* Anonymous toggle */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isAnonymous}
              onClick={() => setValue("is_anonymous", !isAnonymous, { shouldValidate: true })}
              disabled={submitting}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
                "transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
                isAnonymous ? "bg-blue-600" : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow",
                  "transform transition-transform",
                  isAnonymous ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                {isAnonymous
                  ? <><EyeOff className="h-4 w-4 text-blue-600" /> Anonymous submission</>
                  : <><Eye className="h-4 w-4 text-gray-400" /> Public submission</>
                }
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {isAnonymous
                  ? "Your name will not be visible to committee members or staff."
                  : "Your name will be visible to committee members and staff."}
              </p>
            </div>
          </div>

          {/* Blockchain notice */}
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
            <strong>On-chain submission:</strong> Once submitted, your grievance is
            recorded on the blockchain and cannot be edited or deleted. A cryptographic
            hash of your content is stored on-chain; attachments are stored on IPFS.
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white
                       rounded-lg font-medium text-sm hover:bg-blue-700 focus:outline-none focus:ring-2
                       focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed
                       transition-colors"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? "Submitting to blockchain…" : "Submit Grievance"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Tiny helpers ───────────────────────────────────────────────────────────────

function Opt() {
  return <span className="text-gray-400 font-normal">(optional)</span>;
}

function Field({
  label,
  error,
  children,
}: {
  label: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return cn(
    "w-full px-3 py-2.5 border rounded-lg text-sm bg-white transition-colors",
    "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
    "disabled:bg-gray-50 disabled:text-gray-400",
    hasError ? "border-red-400" : "border-gray-300"
  );
}
