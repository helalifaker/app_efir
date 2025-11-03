import type { NextConfig } from "next";
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  // External packages are not bundled (useful for native modules)
  serverExternalPackages: ['@supabase/supabase-js'],
};

// Export with Sentry configuration
export default withSentryConfig(nextConfig, {
  // Sentry options
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});
