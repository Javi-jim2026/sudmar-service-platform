/** Branding and feature flags. Add your approved logo here; no component edits needed. */
export const config = Object.freeze({
  brand: {
    name: 'SUDMAR', tagline: 'SERVICE PLATFORM', initials: 'S',
    logoUrl: '', // e.g. './assets/brand/logo.svg'
    accent: '#087f8c', primary: '#075985',
  },
  dataUrl: './data/operations.json',
  referenceUrl: './data/workbook-reference.json',
  timezone: 'America/Mexico_City',
  pageSize: 20,
  storageKey: 'sudmar.saved-views.v1',
  features: { editing: false, sharedDatabase: false, photoUpload: false },
});
