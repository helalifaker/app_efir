export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Login</h1>
      <p className="text-gray-600 text-center max-w-md">
        Auth provider not wired yet in Next.js (we removed useAuth so Vercel can build).
        Next step: add a real AuthProvider in app/layout.tsx and restore this page.
      </p>
    </main>
  );
}
