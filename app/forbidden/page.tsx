// app/forbidden/page.tsx
import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">403</h1>
        <h2 className="text-2xl font-semibold text-gray-700">Forbidden</h2>
        <p className="text-gray-600 max-w-md">
          You don&apos;t have permission to access this resource. Admin access is required.
        </p>
        <div className="flex gap-4 justify-center mt-6">
          <Link
            href="/"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Home
          </Link>
          <Link
            href="/login"
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Login
          </Link>
        </div>
      </div>
    </main>
  );
}

