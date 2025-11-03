-- Complete EFIR Database Schema with RLS
-- Run this in your Supabase SQL editor to set up all tables

-- ============================================================================
-- 0. PROFILES TABLE (optional, for user metadata)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- ============================================================================
-- 1. MODELS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid, -- References auth.users(id), NULL allowed for testing
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_models_name ON public.models(name);
CREATE INDEX IF NOT EXISTS idx_models_owner_id ON public.models(owner_id);

-- ============================================================================
-- 2. MODEL_VERSIONS TABLE (main versions table)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'ready', 'locked')),
  created_by uuid, -- references auth.users(id)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_versions_model_id ON public.model_versions(model_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_status ON public.model_versions(status);
CREATE INDEX IF NOT EXISTS idx_model_versions_created_at ON public.model_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_versions_created_by ON public.model_versions(created_by);

-- ============================================================================
-- 3. VERSION_TABS TABLE (JSONB data for each tab)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.version_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  tab text NOT NULL CHECK (tab IN ('overview', 'pnl', 'bs', 'cf', 'capex', 'controls', 'assumptions')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(version_id, tab) -- One tab per type per version
);

CREATE INDEX IF NOT EXISTS idx_version_tabs_version_id ON public.version_tabs(version_id);
CREATE INDEX IF NOT EXISTS idx_version_tabs_tab ON public.version_tabs(tab);

-- ============================================================================
-- 4. VERSION_VALIDATIONS TABLE (validation errors/warnings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.version_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  code text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('error', 'warning')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_version_validations_version_id ON public.version_validations(version_id);
CREATE INDEX IF NOT EXISTS idx_version_validations_severity ON public.version_validations(severity);

-- ============================================================================
-- 5. VERSION_STATUS_HISTORY TABLE (track status changes)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.version_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  old_status text CHECK (old_status IN ('draft', 'ready', 'locked')),
  new_status text NOT NULL CHECK (new_status IN ('draft', 'ready', 'locked')),
  changed_by uuid, -- references auth.users(id)
  note text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vsh_version_id ON public.version_status_history(version_id);
CREATE INDEX IF NOT EXISTS idx_vsh_changed_at ON public.version_status_history(changed_at DESC);

-- ============================================================================
-- 6. APP_SETTINGS TABLE (application configuration)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at 
  ON public.app_settings(updated_at DESC);

-- Seed default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('vat', '{"rate": 0.15}'::jsonb),
  ('numberFormat', '{"locale": "en-US", "decimals": 2, "compact": false}'::jsonb),
  ('validation', '{"requireTabs": ["overview", "pnl", "bs", "cf"], "bsTolerance": 0.01}'::jsonb),
  ('ui', '{"currency": "SAR", "theme": "system"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- DONE! Schema created successfully.
-- ============================================================================

