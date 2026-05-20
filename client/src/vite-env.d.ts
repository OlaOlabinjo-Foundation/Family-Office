/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  /** Optional URL (e.g. Notion / Google Doc) shown on Help page as “Customer hub”. */
  readonly VITE_HELP_CENTER_URL?: string
  /** Set to `1` to use httpOnly session cookies (requires `FAMILY_OFFICE_SESSION_COOKIE=1` on API). */
  readonly VITE_SESSION_COOKIE?: string
  /** Optional absolute or site-relative URL for the Command Centre welcome portrait (chairman). */
  readonly VITE_CHAIRMAN_IMAGE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
