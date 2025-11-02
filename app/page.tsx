export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-bold">app_efir deployed ✅</h1>
      <p className="text-gray-600">
        This is a static page from the latest deployment.
      </p>
      <a
        href="/dashboard"
        className="px-4 py-2 rounded bg-black text-white"
      >
        Go to dashboard
      </a>
    </main>
  );
}
