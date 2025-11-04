'use client';

// app/versions/[id]/ActionsBar.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { logger } from "@/lib/logger";
import { useAuth } from "@/app/providers/AuthProvider";

type Status = "Draft" | "Ready" | "Locked" | "Archived";

export default function ActionsBar({ versionId, status }: { versionId: string; status: Status }) {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);

  const updateStatus = async (newStatus: Status) => {
    if (loading) return;
    
    // Check authentication before attempting update
    if (!session) {
      toast.error(
        (t) => (
          <div onClick={() => { window.location.href = '/login'; toast.dismiss(t.id); }}>
            <div className="font-semibold">Authentication Required</div>
            <div className="text-sm mt-1">Please log in to update status</div>
            <div className="text-xs mt-1 underline">Click to go to login →</div>
          </div>
        ),
        { duration: 5000 }
      );
      return;
    }
    
    // Validate versionId before proceeding
    if (!versionId || typeof versionId !== 'string' || versionId.trim() === '') {
      logger.error('Invalid versionId in ActionsBar', undefined, { versionId });
      toast.error('Invalid version ID. Please refresh the page.');
      return;
    }
    
    setLoading(true);

    logger.debug('Updating version status', { versionId, newStatus, currentStatus: status });

    try {
      const url = `/api/versions/${versionId}/status`;
      
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json().catch(() => ({ error: 'Failed to update status' }));

      if (!res.ok) {
        // Handle authentication errors specially
        if (res.status === 401) {
          toast.error(
            (t) => (
              <div onClick={() => { window.location.href = '/login'; toast.dismiss(t.id); }}>
                <div className="font-semibold">Authentication Required</div>
                <div className="text-sm mt-1">Please log in to update status</div>
                <div className="text-xs mt-1 underline">Click to go to login →</div>
              </div>
            ),
            { duration: 5000 }
          );
          logger.warn('Status update failed - authentication required', {
            versionId,
            newStatus,
            currentStatus: status,
          });
          return;
        }
        
        logger.error('Status update failed', undefined, {
          versionId,
          newStatus,
          currentStatus: status,
          httpStatus: res.status,
          error: data.error,
        });
        
        // Show detailed error message for other errors
        let errorMessage = data.error || "Failed to update status";
        if (data.details && Array.isArray(data.details) && data.details.length > 0) {
          const detailMessages = data.details.map((d: unknown) => {
            if (typeof d === 'object' && d !== null && 'message' in d) {
              return String((d as { message: string }).message);
            }
            return String(d);
          }).join(', ');
          errorMessage = `${errorMessage}: ${detailMessages}`;
        }
        
        toast.error(errorMessage);
        return;
      }

      logger.info('Status updated successfully', { versionId, oldStatus: status, newStatus });
      toast.success(`Status updated to ${newStatus}`);
      router.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update status";
      logger.error('Unexpected error during status update', error, { versionId, newStatus });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2 items-center">
      {status === "Draft" && (
        <button
          onClick={() => updateStatus("Ready")}
          disabled={loading || authLoading || !session}
          className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg font-medium shadow-sm hover:shadow-md hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>✓</span>
              <span>Mark Ready</span>
            </>
          )}
        </button>
      )}
      
      {status === "Ready" && (
        <button
          onClick={() => updateStatus("Locked")}
          disabled={loading || authLoading || !session}
          className="px-4 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-lg font-medium shadow-sm hover:shadow-md hover:from-red-600 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>🔒</span>
              <span>Lock Version</span>
            </>
          )}
        </button>
      )}

      {status === "Locked" && (
        <button
          onClick={() => updateStatus("Draft")}
          disabled={loading || authLoading || !session}
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-medium shadow-sm hover:shadow-md hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
        >
          {loading ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>↻</span>
              <span>Reopen</span>
            </>
          )}
        </button>
      )}
    </div>
  );
}

