-- Phase 1: Status Model & Lifecycle Alignment
-- Migration to align with locked blueprint
-- Run this AFTER schema.sql and rls_policies.sql
--
-- Changes:
-- 1. Add Archived status and capitalize all status values (Draft, Ready, Locked, Archived)
-- 2. Add override_flag and archived_at fields to model_versions
-- 3. Create version_audit table for transition logging
-- 4. Update version_status_history to support capitalized statuses

-- ============================================================================
-- 1. UPDATE MODEL_VERSIONS TABLE
-- ============================================================================

-- Add new fields
ALTER TABLE public.model_versions 
  ADD COLUMN IF NOT EXISTS override_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS override_reason text,
  ADD COLUMN IF NOT EXISTS override_by uuid; -- references auth.users(id)

-- Create index for override_flag
CREATE INDEX IF NOT EXISTS idx_model_versions_override_flag ON public.model_versions(override_flag);
CREATE INDEX IF NOT EXISTS idx_model_versions_archived_at ON public.model_versions(archived_at);

-- ============================================================================
-- 2. MIGRATE EXISTING STATUS VALUES (lowercase → capitalized)
-- ============================================================================

-- First, fix any invalid status values (like "V1", empty strings, etc.)
-- Default invalid statuses to 'Draft'
UPDATE public.model_versions 
SET status = 'Draft'
WHERE status NOT IN ('draft', 'ready', 'locked', 'Draft', 'Ready', 'Locked', 'Archived');

-- Update existing status values to capitalized format
UPDATE public.model_versions 
SET status = 'Draft'
WHERE status IN ('draft', 'DRAFT');

UPDATE public.model_versions 
SET status = 'Ready'
WHERE status IN ('ready', 'READY');

UPDATE public.model_versions 
SET status = 'Locked'
WHERE status IN ('locked', 'LOCKED');

-- Update status history (normalize old_status)
UPDATE public.version_status_history 
SET old_status = 'Draft'
WHERE old_status IN ('draft', 'DRAFT', 'V1') OR old_status IS NULL;

UPDATE public.version_status_history 
SET old_status = 'Ready'
WHERE old_status IN ('ready', 'READY');

UPDATE public.version_status_history 
SET old_status = 'Locked'
WHERE old_status IN ('locked', 'LOCKED');

UPDATE public.version_status_history 
SET old_status = 'Archived'
WHERE old_status IN ('archived', 'ARCHIVED');

-- Update status history (normalize new_status)
UPDATE public.version_status_history 
SET new_status = 'Draft'
WHERE new_status IN ('draft', 'DRAFT', 'V1');

UPDATE public.version_status_history 
SET new_status = 'Ready'
WHERE new_status IN ('ready', 'READY');

UPDATE public.version_status_history 
SET new_status = 'Locked'
WHERE new_status IN ('locked', 'LOCKED');

UPDATE public.version_status_history 
SET new_status = 'Archived'
WHERE new_status IN ('archived', 'ARCHIVED');

-- ============================================================================
-- 3. UPDATE STATUS CONSTRAINTS TO SUPPORT CAPITALIZED VALUES + ARCHIVED
-- ============================================================================

-- Drop old constraint
ALTER TABLE public.model_versions 
  DROP CONSTRAINT IF EXISTS model_versions_status_check;

-- Add new constraint with capitalized values + Archived
ALTER TABLE public.model_versions 
  ADD CONSTRAINT model_versions_status_check 
  CHECK (status IN ('Draft', 'Ready', 'Locked', 'Archived'));

-- Update status history constraints
ALTER TABLE public.version_status_history 
  DROP CONSTRAINT IF EXISTS version_status_history_old_status_check;

ALTER TABLE public.version_status_history 
  DROP CONSTRAINT IF EXISTS version_status_history_new_status_check;

ALTER TABLE public.version_status_history 
  ADD CONSTRAINT version_status_history_old_status_check 
  CHECK (old_status IN ('Draft', 'Ready', 'Locked', 'Archived') OR old_status IS NULL);

ALTER TABLE public.version_status_history 
  ADD CONSTRAINT version_status_history_new_status_check 
  CHECK (new_status IN ('Draft', 'Ready', 'Locked', 'Archived'));

-- ============================================================================
-- 4. CREATE VERSION_AUDIT TABLE (for comprehensive transition logging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.version_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  
  -- Transition details
  action text NOT NULL CHECK (action IN ('status_change', 'override', 'archived', 'restored', 'data_change')),
  old_status text CHECK (old_status IN ('Draft', 'Ready', 'Locked', 'Archived')),
  new_status text CHECK (new_status IN ('Draft', 'Ready', 'Locked', 'Archived')),
  
  -- Actor and reason
  actor_id uuid, -- references auth.users(id)
  actor_email text,
  reason text,
  comment text,
  
  -- Override details (if applicable)
  override_flag boolean NOT NULL DEFAULT false,
  override_reason text,
  
  -- Metadata
  metadata jsonb, -- Additional context (e.g., validation counts, data changes)
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_version_audit_version_id ON public.version_audit(version_id);
CREATE INDEX IF NOT EXISTS idx_version_audit_action ON public.version_audit(action);
CREATE INDEX IF NOT EXISTS idx_version_audit_created_at ON public.version_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_version_audit_actor_id ON public.version_audit(actor_id);

-- ============================================================================
-- 5. ENABLE RLS ON VERSION_AUDIT
-- ============================================================================

ALTER TABLE public.version_audit ENABLE ROW LEVEL SECURITY;

-- Users can view audit logs for versions they own
CREATE POLICY "Users can view audit logs for their versions"
  ON public.version_audit FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON m.id = mv.model_id
      WHERE mv.id = version_audit.version_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- Service role can insert audit logs (used by API routes)
CREATE POLICY "Service role can insert audit logs"
  ON public.version_audit FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS

-- ============================================================================
-- 6. HELPER FUNCTION: Log status transition
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_version_transition(
  version_id_param uuid,
  old_status_param text,
  new_status_param text,
  actor_id_param uuid,
  actor_email_param text,
  reason_param text DEFAULT NULL,
  comment_param text DEFAULT NULL,
  override_flag_param boolean DEFAULT false,
  override_reason_param text DEFAULT NULL,
  metadata_param jsonb DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  audit_id uuid;
BEGIN
  INSERT INTO public.version_audit (
    version_id,
    action,
    old_status,
    new_status,
    actor_id,
    actor_email,
    reason,
    comment,
    override_flag,
    override_reason,
    metadata
  ) VALUES (
    version_id_param,
    'status_change',
    old_status_param,
    new_status_param,
    actor_id_param,
    actor_email_param,
    reason_param,
    comment_param,
    override_flag_param,
    override_reason_param,
    metadata_param
  )
  RETURNING id INTO audit_id;
  
  -- Also insert into version_status_history for backward compatibility
  INSERT INTO public.version_status_history (
    version_id,
    old_status,
    new_status,
    changed_by,
    note
  ) VALUES (
    version_id_param,
    old_status_param,
    new_status_param,
    actor_id_param,
    COALESCE(comment_param, reason_param)
  );
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. HELPER FUNCTION: Check if transition is allowed
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_transition_status(
  version_id_param uuid,
  from_status text,
  to_status text,
  actor_is_admin boolean DEFAULT false
)
RETURNS jsonb AS $$
DECLARE
  current_status text;
  critical_count integer;
  result jsonb;
BEGIN
  -- Get current status
  SELECT status INTO current_status
  FROM public.model_versions
  WHERE id = version_id_param;
  
  -- Verify current status matches from_status
  IF current_status != from_status THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', format('Version status is %s, not %s', current_status, from_status)
    );
  END IF;
  
  -- Transition rules per blueprint
  
  -- Draft → Ready: Requires 0 Critical OR Admin override
  IF from_status = 'Draft' AND to_status = 'Ready' THEN
    SELECT COUNT(*) INTO critical_count
    FROM public.version_validations
    WHERE version_id = version_id_param
    AND severity IN ('error', 'critical');
    
    IF critical_count > 0 AND NOT actor_is_admin THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', format('Cannot transition to Ready: %s critical validation issues found', critical_count),
        'critical_count', critical_count
      );
    END IF;
  END IF;
  
  -- Ready → Locked: Requires Admin
  IF from_status = 'Ready' AND to_status = 'Locked' THEN
    IF NOT actor_is_admin THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Admin access required to transition Ready → Locked'
      );
    END IF;
  END IF;
  
  -- Locked → Draft: Requires Admin
  IF from_status = 'Locked' AND to_status = 'Draft' THEN
    IF NOT actor_is_admin THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Admin access required to transition Locked → Draft'
      );
    END IF;
  END IF;
  
  -- Any → Archived: Requires Admin
  IF to_status = 'Archived' THEN
    IF NOT actor_is_admin THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Admin access required to archive versions'
      );
    END IF;
  END IF;
  
  -- Archived → Any: Requires Admin (restore)
  IF from_status = 'Archived' THEN
    IF NOT actor_is_admin THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason', 'Admin access required to restore archived versions'
      );
    END IF;
  END IF;
  
  -- Allowed transition
  RETURN jsonb_build_object('allowed', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- DONE! Status model migration complete.
-- ============================================================================

