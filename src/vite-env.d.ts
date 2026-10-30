/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The Google Sheet web app that receives "Was this helpful?" feedback. Optional: without it, feedback is not saved. */
  readonly VITE_FEEDBACK_WEBHOOK_URL?: string
}
interface ImportMeta { readonly env: ImportMetaEnv }
