'use client';

// app/version-detail/[id]/ActionsBar.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

type Status = "draft" | "ready" | "locked";

export default function ActionsBar({ versionId, status }: { versionId: string; status: Status }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const updateStatus = async (newStatus: Status) => {
    if (loading) return;
    
    // Validate versionId before proceeding
    if (!versionId || typeof versionId !== 'string' || versionId.trim() === '') {
      console.error('Invalid versionId:', versionId);
      toast.error('Invalid version ID. Please refresh the page.');
      return;
    }
    
    setLoading(true);

    // Debug: log versionId
    console.log('Updating status:', { versionId, versionIdType: typeof versionId, versionIdLength: versionId?.length, newStatus });

    try {
      const url = `/api/versions/${versionId}/status`;
      console.log('Fetching URL:', url);
      
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Log full error for debugging
        console.error('Status update error:', { status: res.status, data, versionId });
        
        // Show detailed error message
        let errorMessage = data.error || "Failed to update status";
        if (data.details && Array.isArray(data.details) && data.details.length > 0) {
          const detailMessages = data.details.map((d: any) => d.message || d).join(', ');
          errorMessage = `${errorMessage}: ${detailMessages}`;
        }
        
        toast.error(errorMessage);
        return; // Don't throw, just show error and stop
      }

      toast.success(`Status updated to ${newStatus}`);
      router.refresh();
    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast.error(error.message || "Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      {status === "draft" && (
        <button
          onClick={() => updateStatus("ready")}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          Mark Ready
        </button>
      )}
      
      {status === "ready" && (
        <button
          onClick={() => updateStatus("locked")}
          disabled={loading}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          Lock Version
        </button>
      )}

      {status === "locked" && (
        <button
          onClick={() => updateStatus("draft")}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Reopen
        </button>
      )}
    </div>
  );
}

