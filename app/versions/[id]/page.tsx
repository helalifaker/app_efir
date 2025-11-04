// app/versions/[id]/page.tsx
import { redirect } from 'next/navigation';

export default async function VersionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Redirect to overview tab
  redirect(`/versions/${id}/overview`);
}

