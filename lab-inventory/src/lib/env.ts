// Which deployment environment the app is running in. Driven by the
// VITE_APP_ENV build var (set to "staging" on the staging Vercel project);
// falls back to a hostname check so a staging URL is flagged even if the
// var is missing.
const rawEnv = (import.meta.env.VITE_APP_ENV as string | undefined)?.toLowerCase()

export const isStaging =
  rawEnv === 'staging' ||
  (typeof window !== 'undefined' && /staging|preview/.test(window.location.hostname))
