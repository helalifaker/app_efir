// app/api/versions/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import { validateBody, UuidSchema } from "@/lib/validateRequest";
import { isAdmin } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { withErrorHandler, createErrorResponse } from "@/lib/withErrorHandler";
import { runCashEngineForVersion } from "@/lib/engine/cashEngineService";
import { getServiceClient } from "@/lib/supabaseServer";
import { verifyVersionOwnership, getCurrentUserId } from "@/lib/ownership";

// Blueprint: Status values are capitalized (Draft, Ready, Locked, Archived)
const BodySchema = z.object({
  status: z.enum(["Draft", "Ready", "Locked", "Archived"]),
  note: z.string().optional(),
  reason: z.string().optional(), // Required for Admin transitions
  override: z.boolean().optional(), // Admin override flag for Draft→Ready with Critical issues
  override_reason: z.string().optional(), // Reason for override
});

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) => {
  if (!ctx?.params) {
    return createErrorResponse('Missing route parameters', 400);
  }
  const params = await ctx.params;
  const { id } = params as { id: string };
  
  // Log for debugging
  logger.debug('Status update request', { versionId: id, idType: typeof id, idLength: id?.length });
  
  // Validate UUID
  const uuidValidation = UuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    logger.warn('Invalid UUID format', { versionId: id, error: uuidValidation.error.issues });
    return NextResponse.json(
      {
        error: 'Invalid version ID format',
        details: uuidValidation.error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          code: issue.code,
        })),
      },
      { status: 400 }
    );
  }

  // Parse and validate body
  const rawBody = await req.json().catch(() => ({}));
  const validation = validateBody(BodySchema, rawBody);
  if (!validation.success) {
    return validation.response;
  }
  const { status, note, reason, override, override_reason } = validation.data;

  // Get current user from session
  let currentUserId: string | null = null;
  let currentUserEmail: string | null = null;
  let isUserAdmin = false;
  
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (user) {
      currentUserId = user.id;
      currentUserEmail = user.email || null;
      isUserAdmin = isAdmin(user);
    }
  } catch {
    logger.debug("No authenticated user, proceeding as System");
  }

  // Verify ownership (unless user is admin)
  const userId = await getCurrentUserId();
  if (!isUserAdmin) {
    const ownershipCheck = await verifyVersionOwnership(id, userId);
    if (!ownershipCheck.owned) {
      return ownershipCheck.error || createErrorResponse('Forbidden', 403);
    }
  }

  const supabase = getServiceClient();

  // Read current version to get old_status
  const { data: current, error: fetchError } = await supabase
    .from("model_versions")
    .select("status, created_by, override_flag")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    logger.error('Version not found for status update', fetchError, { versionId: id });
    return createErrorResponse(fetchError?.message ?? "Version not found", 404);
  }

  // If status unchanged, return early (no history record needed)
  if (current.status === status) {
    return NextResponse.json({ ok: true, message: "Status unchanged" });
  }

  // Check if transition is allowed using database function
  const { data: transitionCheck, error: checkError } = await supabase
    .rpc('can_transition_status', {
      version_id_param: id,
      from_status: current.status,
      to_status: status,
      actor_is_admin: isUserAdmin
    });

  if (checkError) {
    logger.error('Transition check error', checkError, { versionId: id });
    return createErrorResponse('Failed to validate transition', 500);
  }

  const transitionAllowed = transitionCheck?.allowed;
  if (!transitionAllowed) {
    logger.warn('Status transition blocked', {
      versionId: id,
      from: current.status,
      to: status,
      reason: transitionCheck?.reason,
      isAdmin: isUserAdmin
    });
    return createErrorResponse(
      transitionCheck?.reason || 'Status transition not allowed',
      403,
      { critical_count: transitionCheck?.critical_count }
    );
  }

  // Draft → Ready: Check for Critical issues and override
  let overrideFlag = override || false;
  let finalOverrideReason = override_reason || null;
  
  if (current.status === 'Draft' && status === 'Ready') {
    const { data: criticalValidations } = await supabase
      .from('version_validations')
      .select('id')
      .eq('version_id', id)
      .in('severity', ['error', 'critical']);

    const criticalCount = criticalValidations?.length || 0;
    
    if (criticalCount > 0) {
      if (!isUserAdmin) {
        return createErrorResponse(
          `Cannot transition to Ready: ${criticalCount} critical validation issue(s) found. Admin override required.`,
          403,
          { critical_count: criticalCount }
        );
      }
      
      // Admin override
      if (!override || !override_reason) {
        return createErrorResponse(
          'Admin override required: must provide override=true and override_reason when critical issues exist',
          400
        );
      }
      
      overrideFlag = true;
      finalOverrideReason = override_reason;
    }
  }

  // Admin transitions require reason/comment
  const adminTransitions = [
    { from: 'Ready', to: 'Locked' },
    { from: 'Locked', to: 'Draft' },
  ];
  
  const isAdminTransition = adminTransitions.some(
    t => t.from === current.status && t.to === status
  ) || status === 'Archived' || current.status === 'Archived';
  
  if (isAdminTransition && !isUserAdmin) {
    return createErrorResponse('Admin access required for this transition', 403);
  }
  
  if (isAdminTransition && !reason && !note) {
    return createErrorResponse('Reason or comment required for admin transitions', 400);
  }

  // Prepare update data
  const updateData: {
    status: string;
    updated_at: string;
    override_flag: boolean;
    override_reason: string | null;
    override_by: string | null;
    archived_at?: string | null;
  } = {
    status,
    updated_at: new Date().toISOString(),
    override_flag: overrideFlag,
    override_reason: finalOverrideReason || null,
    override_by: overrideFlag ? currentUserId : null,
  };

  // Set archived_at if transitioning to/from Archived
  const currentStatus = current.status as 'Draft' | 'Ready' | 'Locked' | 'Archived';
  if (status === 'Archived') {
    updateData.archived_at = new Date().toISOString();
  } else if (currentStatus === 'Archived') {
    updateData.archived_at = null; // Restore from archived
  }

  // Update status
  const { error: updateError } = await supabase
    .from("model_versions")
    .update(updateData)
    .eq("id", id);

  if (updateError) {
    logger.error('Status update error', updateError, { versionId: id, newStatus: status });
    return createErrorResponse(updateError.message, 400);
  }

  // Get validation counts for metadata
  const { data: validations } = await supabase
    .from('version_validations')
    .select('severity')
    .eq('version_id', id);

  const validationCounts = {
    critical: validations?.filter(v => v.severity === 'error' || v.severity === 'critical').length || 0,
    major: validations?.filter(v => v.severity === 'warning' || v.severity === 'major').length || 0,
    minor: validations?.filter(v => v.severity === 'minor').length || 0,
    total: validations?.length || 0,
  };

  // Log to version_audit using database function
  const { error: auditError } = await supabase
    .rpc('log_version_transition', {
      version_id_param: id,
      old_status_param: current.status,
      new_status_param: status,
      actor_id_param: currentUserId,
      actor_email_param: currentUserEmail,
      reason_param: reason || null,
      comment_param: note || null,
      override_flag_param: overrideFlag,
      override_reason_param: finalOverrideReason || null,
      metadata_param: {
        validation_counts: validationCounts,
        transition_type: isAdminTransition ? 'admin' : 'standard',
      },
    });

  if (auditError) {
    logger.error("Audit log error", auditError, { versionId: id });
    // Don't fail the operation, but log the error
  }

  logger.info('Status updated successfully', {
    versionId: id,
    oldStatus: current.status,
    newStatus: status,
    overrideFlag,
    isAdmin: isUserAdmin,
  });

  // Auto-trigger cash engine when status changes to Ready
  // This ensures financial statements are reconciled before version is marked Ready
  if (status === 'Ready' && current.status !== 'Ready') {
    // Trigger cash engine asynchronously (fire and forget)
    // Errors are logged but don't affect the status change response
    runCashEngineForVersion(id, { forceRecalculation: false })
      .then(() => {
        logger.info('Auto-triggered cash engine completed on Ready transition', { versionId: id });
      })
      .catch((error) => {
        logger.error('Auto-triggered cash engine failed on Ready transition', error, { versionId: id });
        // Don't throw - this is a background process, status change already succeeded
      });
  }
  
  // Revalidate cache
  revalidateTag('versions', {});
  revalidateTag('version-tabs', {});
  revalidateTag('version-validations', {});
  revalidateTag('version-history', {});
  revalidateTag(`version-${id}`, {});
  
  return NextResponse.json({
    ok: true,
    status,
    override_flag: overrideFlag,
  });
});
