// app/api/versions/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import { validateBody, UuidSchema } from "@/lib/validateRequest";
import { logger } from "@/lib/logger";
import { withErrorHandler } from "@/lib/withErrorHandler";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
);

const BodySchema = z.object({
  status: z.enum(["draft", "ready", "locked"]),
  note: z.string().optional(),
});

export const PATCH = withErrorHandler(async (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) => {
  const { id } = await ctx.params;
  
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
  const { status, note } = validation.data;

  // Get current user from session
  let currentUserId: string | null = null;
  try {
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    currentUserId = user?.id || null;
  } catch {
    logger.debug("No authenticated user, proceeding as System");
  }

  // Read current version to get old_status
  const { data: current, error: fetchError } = await supabase
    .from("model_versions")
    .select("status, created_by")
    .eq("id", id)
    .single();

  if (fetchError || !current) {
    logger.error('Version not found for status update', fetchError, { versionId: id });
    return NextResponse.json(
      { error: fetchError?.message ?? "Version not found" },
      { status: 404 }
    );
  }

  // If status unchanged, return early (no history record needed)
  if (current.status === status) {
    return NextResponse.json({ ok: true, message: "Status unchanged" });
  }

  // Check for blocking validation errors when transitioning to "ready"
  if (status === 'ready') {
    const { data: validations, error: validationError } = await supabase
      .from('version_validations')
      .select('code, message, severity')
      .eq('version_id', id)
      .eq('severity', 'error');

    if (!validationError && validations && validations.length > 0) {
      logger.warn('Blocked status change to ready due to validation errors', {
        versionId: id,
        errorCount: validations.length,
      });
      return NextResponse.json(
        {
          error: 'Cannot set status to ready: validation errors exist',
          details: validations.map((v) => ({
            code: v.code,
            message: v.message,
          })),
        },
        { status: 400 }
      );
    }
  }

  // Update status
  const { error: updateError } = await supabase
    .from("model_versions")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) {
    logger.error('Status update error', updateError, { versionId: id, newStatus: status });
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  // Insert history record
  const { error: historyError } = await supabase
    .from("version_status_history")
    .insert({
      version_id: id,
      old_status: current.status,
      new_status: status,
      changed_by: currentUserId || null,
      note: note || null,
    });

  // Don't fail the operation if history insert fails, but log it
  if (historyError) {
    logger.error("History insert error", historyError, { versionId: id });
  }

  logger.info('Status updated successfully', { versionId: id, oldStatus: current.status, newStatus: status });
  
  // Revalidate cache
  revalidateTag('versions', {});
  revalidateTag('version-tabs', {});
  revalidateTag('version-validations', {});
  revalidateTag('version-history', {});
  revalidateTag(`version-${id}`, {});
  
  return NextResponse.json({ ok: true });
});
