// app/api/versions/[id]/clone/route.ts
import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { validateBody, UuidSchema } from "@/lib/validateRequest";
import { logger } from "@/lib/logger";
import { withErrorHandler } from "@/lib/withErrorHandler";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
);

const BodySchema = z.object({
  name: z.string().min(1).optional(),
  includeChildren: z.boolean().default(true),
});

type CloneBody = z.infer<typeof BodySchema>;

async function generateCloneName(baseName: string): Promise<string> {
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
  ctx: { params: Promise<{ id: string }> }
) => {
  const { id } = await ctx.params;
  
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

  // 1) Read source version
  const { data: src, error: errSrc } = await supabase
    .from("model_versions")
    .select("*")
    .eq("id", id)
    .single();

  if (errSrc || !src) {
    logger.error('Version not found for clone', errSrc, { versionId: id });
    return NextResponse.json(
      { error: errSrc?.message ?? "Version not found" },
      { status: 404 }
    );
  }

  // 2) Build new row (copy only safe fields)
  const newRow = {
    model_id: src.model_id,
    name: name ?? (await generateCloneName(src.name)),
    status: "draft" as const,
    created_by: src.created_by, // Must copy this as it's NOT NULL
  };

  // 3) Insert new version
  const { data: inserted, error: errIns } = await supabase
    .from("model_versions")
    .insert(newRow)
    .select()
    .maybeSingle();

  if (errIns) {
    logger.error("Clone insert error", errIns, { versionId: id });
    return NextResponse.json(
      { error: errIns.message },
      { status: 500 }
    );
  }
  
  if (!inserted) {
    logger.error("Clone insert error: No data returned", undefined, { versionId: id });
    return NextResponse.json(
      { error: "Failed to insert clone - no data returned" },
      { status: 500 }
    );
  }

  // 4) Optionally clone children (version_tabs and version_validations)
  if (includeChildren) {
    // Clone version_tabs
    const { data: tabs, error: errTabs } = await supabase
      .from("version_tabs")
      .select("*")
      .eq("version_id", id);

    if (errTabs) {
      logger.error("Clone read version_tabs error", errTabs, { versionId: id });
      return NextResponse.json(
        { error: `Clone failed reading version_tabs: ${errTabs.message}` },
        { status: 500 }
      );
    }

    if (tabs && tabs.length > 0) {
      const toInsert = tabs.map((tab) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, created_at, updated_at, ...restTab } = tab;
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
        return NextResponse.json(
          { error: `Clone failed writing version_tabs: ${errInsertTabs.message}` },
          { status: 500 }
        );
      }
    }

    // Clone version_validations
    const { data: validations, error: errValidations } = await supabase
      .from("version_validations")
      .select("*")
      .eq("version_id", id);

    if (errValidations) {
      logger.warn("Clone read version_validations error", { error: errValidations, versionId: id });
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
        logger.warn("Clone write version_validations error", { error: errInsertValidations, versionId: id });
        // Don't fail the whole operation if validations can't be cloned
      }
    }
  }

  logger.info('Version cloned successfully', { sourceId: id, newId: inserted.id });
  
  // Revalidate cache
  revalidateTag('versions', {});
  revalidateTag('version-tabs', {});
  revalidateTag('version-validations', {});
  
  return NextResponse.json({ id: inserted.id, name: inserted.name }, { status: 201 });
});
