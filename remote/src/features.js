// Feature flags. The admin (owner) has every feature. Everyone else gets each feature's default,
// changed per person by the admin in the remote (Settings → Allowed users → Features), stored as
// config/access/<emailKey>/features/<id>: true | false.
// NOTE: copy of src/features.js; functions/index.js (FEATURE_DEFAULTS) and the
// english/malayalam write rules in database.rules.json (editText) must agree with it.

export const FEATURES = [
  { id: 'bible', label: 'Bible', hint: 'Browse and show verses, recent verses', default: true },
  { id: 'ccc', label: 'Catechism (CCC)', default: true },
  { id: 'songs', label: 'Songs', default: true },
  { id: 'holyMass', label: 'Holy Mass', default: true },
  { id: 'prayers', label: 'Prayers', hint: 'Novenas and prayer pages', default: false },
  { id: 'slides', label: 'Slides', default: true },
  { id: 'themes', label: 'Colour themes', default: true },
  { id: 'aiSearch', label: 'AI search', hint: 'Find verses and songs by meaning', default: false },
  { id: 'media', label: 'Media & backgrounds', hint: 'Posters, images and the background image', default: false },
  { id: 'eventFrame', label: 'Event frame', default: false },
  { id: 'voice', label: 'Voice search', default: false },
  { id: 'addSong', label: 'Add song', default: false },
  { id: 'editText', label: 'Edit text on the display', hint: 'Correct verse and song lyrics and save them', default: false },
];

// { bible: true, ccc: true, … } for this person
export function featureAccess(isOwner, overrides) {
  const out = {};
  for (const f of FEATURES) out[f.id] = !!isOwner || (overrides?.[f.id] ?? f.default);
  return out;
}
