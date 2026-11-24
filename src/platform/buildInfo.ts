/** The short git commit id of this build. Shown in the UI and later in feedback notes. */
export const BUILD_ID: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev';
