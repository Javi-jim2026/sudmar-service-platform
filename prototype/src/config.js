/** Branding and feature flags. Add your approved logo here; no component edits needed. */
export const config = Object.freeze({
  brand: {
    name: 'SUDMAR', tagline: 'SERVICE PLATFORM', initials: 'S',
    logoUrl: '', // e.g. './assets/brand/logo.svg'
    accent: '#087f8c', primary: '#075985',
  },
  dataUrl: './data/operations.json',
  referenceUrl: './data/workbook-reference.json',
  personnelUrl: './data/personnel.json',

  // Supabase is now the live operational source for the pilot.
  // The publishable key is intentionally safe for browser use when RLS is enabled.
  supabase: {
    url: 'https://dakmaopqemivlcuiyxix.supabase.co',
    publishableKey: 'sb_publishable_RIVwhx5SMuHhDGMnONzBZQ_awSbzdSW',
  },

  // Kept empty until authenticated writes are enabled.
  writeApiUrl: '',
  timezone: 'America/Mexico_City',
  pageSize: 20,
  storageKey: 'sudmar.saved-views.v1',
  features: { editing: true, sharedDatabase: true, photoUpload: false },
});
