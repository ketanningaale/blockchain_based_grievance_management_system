/**
 * Shared layout for /login and /register — centres the card on screen with animated gradient.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main
      className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-12"
      style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #e8eeff 30%, #f5f0ff 60%, #fef0ff 100%)" }}
    >
      {/* Decorative blobs */}
      <div className="absolute top-[-10%] left-[-5%] w-96 h-96 bg-blue-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-96 h-96 bg-indigo-300/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-200/10 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </main>
  );
}
