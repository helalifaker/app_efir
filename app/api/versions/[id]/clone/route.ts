// app/api/versions/[id]/clone/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { validateBody, UuidSchema } from "@/lib/validateRequest";
import { logger } from "@/lib/logger";
import { withErrorHandler, createErrorResponse } from "@/lib/withErrorHandler";
import { getServiceClient } from "@/lib/supabaseServer";
import { verifyVersionOwnership, getCurrentUserId } from "@/lib/ownership";
import { NotFoundError } from "@/lib/errors";
import { CACHE_TAGS, VERSION_STATUS } from "@/lib/constants";

const BodySchema = z.object({
  name: z.string().min(1).optional(),
  includeChildren: z.boolean().default(true),
});

async function generateCloneName(baseName: string, supabase: ReturnType<typeof getServiceClient>): Promise<string> {
  const { data, error } = await supabase
    .from("model_versions")
    .select("name")
    .ilike("name", `${baseName}%`);

  if (error || !data?.length) return `${baseName} (copy)`;

  const existing = data.map((r) => r.name);
  if (!existing.includes(`${baseName} (copy)`)) return `${baseName} (copy)`;

  let n = 2;
  while (existing.includes(`${baseName} (copy ${n})`)) n++;
  return `${baseName} (copy ${n})`;
}

export const POST = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) => {
  if (!ctx?.params) {
    return createErrorResponse('Missing route parameters', 400);
  }
  const params = await ctx.params;
  const { id } = params as { id: string };
  
  // Validate UUID
  const uuidValidation = UuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return NextResponse.json(
      {
        error: 'Invalid version ID format',
        details: [{ path: 'id', message: 'Must be a valid UUID', code: 'invalid_type' }],
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
  const { name, includeChildren } = validation.data;

  // Verify ownership
  const userId = await getCurrentUserId();
  const ownershipCheck = await verifyVersionOwnership(id, userId);
  if (!ownershipCheck.owned) {
    return ownershipCheck.error || createErrorResponse('Forbidden', 403);
  }

  const supabase = getServiceClient();

  // 1) Read source version
  const { data: src, error: errSrc } = await supabase
    .from("model_versions")
    .select("*")
    .eq("id", id)
    .single();

  if (errSrc || !src) {
    logger.error('Version not found for clone', errSrc, { versionId: id });
    throw new NotFoundError('Version', id);
  }

  // 2) Build new row (copy only safe fields)
  const newRow = {
    model_id: src.model_id,
    name: name ?? (await generateCloneName(src.name, supabase)),
    status: VERSION_STATUS.DRAFT, // Blueprint: capitalized status
    created_by: userId || src.created_by, // Use current user if available, otherwise original creator
  };

  // 3) Insert new version
  const { data: inserted, error: errIns } = await supabase
    .from("model_versions")
    .insert(newRow)
    .select()
    .maybeSingle();

  if (errIns) {
    logger.error("Clone insert error", errIns, { versionId: id });
    throw new Error(`Failed to insert clone: ${errIns.message}`);
  }
  
  if (!inserted) {
    logger.error("Clone insert error: No data returned", undefined, { versionId: id });
    throw new Error("Failed to insert clone - no data returned");
  }

  // 4) Optionally clone children (version_tabs and version_validations)
  // Note: Supabase doesn't support explicit transactions, but we'll handle errors
  // and clean up if needed. For better transaction handling, consider using RPC functions.
  // 
  // Cleanup helper function
  const cleanup = async (reason: string) => {
    logger.warn('Cleaning up failed clone operation', { newVersionId: inserted.id, reason });
    try {
      // Delete any tabs that might have been created
      await supabase.from("version_tabs").delete().eq("version_id", inserted.id);
      // Delete any validations that might have been created
      await supabase.from("version_validations").delete().eq("version_id", inserted.id);
      // Delete the version itself
      await supabase.from("model_versions").delete().eq("id", inserted.id);
    } catch (cleanupError) {
      logger.error('Cleanup failed during clone operation', cleanupError, { 
        newVersionId: inserted.id,
        reason 
      });
      // Continue anyway - the error will be thrown below
    }
  };

  if (includeChildren) {
    try {
      // Clone version_tabs
      const { data: tabs, error: errTabs } = await supabase
        .from("version_tabs")
        .select("*")
        .eq("version_id", id);

      if (errTabs) {
        logger.error("Clone read version_tabs error", errTabs, { versionId: id });
        await cleanup('Failed to read source version_tabs');
        throw new Error(`Failed to clone version: unable to read source tabs. ${errTabs.message}`);
      }

      if (tabs && tabs.length > 0) {
        const toInsert = tabs.map((tab) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: tabId, created_at, updated_at, ...restTab } = tab;
          return {
            ...restTab,
            version_id: inserted.id,
          };
        });

        const { error: errInsertTabs } = await supabase
          .from("version_tabs")
          .insert(toInsert);

        if (errInsertTabs) {
          logger.error("Clone write version_tabs error", errInsertTabs, { versionId: id });
          await cleanup('Failed to insert cloned version_tabs');
          throw new Error(`Failed to clone version: unable to create tabs. ${errInsertTabs.message}`);
        }
      }

      // Clone curriculum_plan (School Relocation Planner)
      const { data: curriculumPlans, error: errCurriculumPlans } = await supabase
        .from("curriculum_plan")
        .select("*")
        .eq("version_id", id);

      if (!errCurriculumPlans && curriculumPlans && curriculumPlans.length > 0) {
        const toInsertCurriculum = curriculumPlans.map((plan) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: planId, created_at, updated_at, ...restPlan } = plan;
          return {
            ...restPlan,
            version_id: inserted.id,
          };
        });

        const { error: errInsertCurriculum } = await supabase
          .from("curriculum_plan")
          .insert(toInsertCurriculum);

        if (errInsertCurriculum) {
          logger.warn("Clone write curriculum_plan error", {
            error: errInsertCurriculum,
            versionId: id
          });
        }
      }

      // Clone rent_plan (School Relocation Planner)
      const { data: rentPlans, error: errRentPlans } = await supabase
        .from("rent_plan")
        .select("*")
        .eq("version_id", id);

      if (!errRentPlans && rentPlans && rentPlans.length > 0) {
        const toInsertRent = rentPlans.map((plan) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: planId, created_at, updated_at, ...restPlan } = plan;
          return {
            ...restPlan,
            version_id: inserted.id,
          };
        });

        const { error: errInsertRent } = await supabase
          .from("rent_plan")
          .insert(toInsertRent);

        if (errInsertRent) {
          logger.warn("Clone write rent_plan error", {
            error: errInsertRent,
            versionId: id
          });
        }
      }

      // Clone opex_plan (School Relocation Planner)
      const { data: opexPlans, error: errOpexPlans } = await supabase
        .from("opex_plan")
        .select("*")
        .eq("version_id", id);

      if (!errOpexPlans && opexPlans && opexPlans.length > 0) {
        const toInsertOpex = opexPlans.map((plan) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id: planId, created_at, updated_at, ...restPlan } = plan;
          return {
            ...restPlan,
            version_id: inserted.id,
          };
        });

        const { error: errInsertOpex } = await supabase
          .from("opex_plan")
          .insert(toInsertOpex);

        if (errInsertOpex) {
          logger.warn("Clone write opex_plan error", {
            error: errInsertOpex,
            versionId: id
          });
        }
      }

      // Clone version_validations (non-critical, but log errors)
      const { data: validations, error: errValidations } = await supabase
        .from("version_validations")
        .select("*")
        .eq("version_id", id);

      if (errValidations) {
        logger.warn("Clone read version_validations error (non-critical)", {
          error: errValidations,
          versionId: id
        });
        // Don't fail if validations don't exist or can't be read
      } else if (validations && validations.length > 0) {
        const toInsertValidations = validations.map((val) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, created_at, ...restVal } = val;
          return {
            ...restVal,
            version_id: inserted.id,
          };
        });

        const { error: errInsertValidations } = await supabase
          .from("version_validations")
          .insert(toInsertValidations);

        if (errInsertValidations) {
          logger.warn("Clone write version_validations error (non-critical)", {
            error: errInsertValidations,
            versionId: id
          });
          // Don't fail the whole operation if validations can't be cloned
          // Validations will be regenerated on next validation run
        }
      }
    } catch (error) {
      // If we're here, cleanup has already been called
      // Re-throw the error to be handled by withErrorHandler
      throw error;
    }
  }

  logger.info('Version cloned successfully', { sourceId: id, newId: inserted.id });
  
  // Revalidate cache
  revalidateTag(CACHE_TAGS.VERSIONS, {});
  revalidateTag(CACHE_TAGS.VERSION_TABS, {});
  revalidateTag(CACHE_TAGS.VERSION_VALIDATIONS, {});
  
  return NextResponse.json({ id: inserted.id, name: inserted.name }, { status: 201 });
});
