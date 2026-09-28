// Build constants from vite.config.ts `define`.

/** package.json's version. */
declare const __APP_VERSION__: string
/** HEAD's commit date, "Sep 27, 2026". */
declare const __APP_DATE__: string
/** Each file in public/fonts/imported/ by name, in bytes. */
declare const __FONT_BYTES__: Record<string, number>
