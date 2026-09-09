// ============================================================================
// auth/usernamePolicy.ts
//
// Validates a username on signup: basic shape rules (length, allowed
// characters) plus a blocklist rejecting slurs and strong profanity.
//
// The blocklist matches against a *normalized* form of the username -
// lowercased, common leetspeak substitutions undone (0->o, 1->i, 3->e, etc.),
// repeated characters collapsed, and separators (._-) stripped - so
// "n1gg3r", "n----r" and "niggerrrr" all get caught the same as the plain
// word would. This is a substring match, not a whole-word one: since a
// username is a single token with no spaces, someone evading the filter
// would just glue the slur onto other characters ("coolnazi123"), and a
// whole-word check wouldn't catch that. The trade-off is the classic
// "Scunthorpe problem" - a handful of innocent words that happen to contain
// a shorter banned substring could get flagged too. For a signup gate (not
// a chat filter blocking free-form text), that trade-off is the right one:
// a rare false-positive username can just be tweaked slightly, whereas a
// slur slipping through as someone's permanent, publicly-displayed name is
// the worse failure by far.
//
// This list is intentionally not exhaustive - no static list ever fully is,
// and language evolves. It covers the most common English-language slurs
// and strong profanity likely to be attempted here. Add to BANNED_WORDS as
// new evasions or terms turn up; nothing else about the filter needs to change.
// ============================================================================

const BANNED_WORDS = [
  // Strong general profanity
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'bastard',
  'dick',
  'pussy',
  'asshole',
  'cock',
  'whore',
  'slut',
  'twat',
  'wanker',
  'faggot',
  'fag',
  'retard',
  'retarded',

  // Racial/ethnic slurs (base forms - substring matching catches plurals/suffixes)
  'nigger',
  'nigga',
  'chink',
  'gook',
  'spic',
  'wetback',
  'coon',
  'kike',
  'paki',
  'towelhead',
  'raghead',
  'beaner',
  'gypsy',
  'jap',
  'zipperhead',
  'sandnigger',

  // Slurs targeting sexual orientation / gender identity
  'dyke',
  'tranny',
  'shemale',

  // Slurs targeting religion/ethnicity intersecting with hate ideology
  'nazi',
  'hitler',

  // Ableist slurs beyond "retard" above
  'spastic',
  'cripple',
];

const LEET_SUBSTITUTIONS: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '$': 's',
  '@': 'a',
  '!': 'i',
};

/** Lowercase, undo common leetspeak substitutions, drop separators, then
 * collapse runs of 3+ identical characters down to one - "fuuuuck" and
 * "f.u.c.k"-style leet normalize down to something the plain word list
 * matches. Capped at 3+ rather than any repeat: several banned words have a
 * genuine double letter (the two g's in "nigger"), and collapsing those too
 * would turn them into a different word ("niger") that isn't - and
 * shouldn't be - in the list. Real words essentially never have a run of 3
 * identical characters, so this only ever catches deliberate repetition-spam. */
function normalize(input: string): string {
  const substituted = Array.from(input.toLowerCase())
    .map((ch) => LEET_SUBSTITUTIONS[ch] ?? ch)
    .join('');
  const separatorsStripped = substituted.replace(/[._\-\s]/g, '');
  return separatorsStripped.replace(/(.)\1{2,}/g, '$1');
}

export interface UsernameCheckResult {
  ok: boolean;
  reason?: string;
}

const USERNAME_SHAPE = /^[a-zA-Z0-9_]{3,20}$/;

export function checkUsername(username: string): UsernameCheckResult {
  if (!USERNAME_SHAPE.test(username)) {
    return { ok: false, reason: 'Usernames must be 3-20 characters: letters, numbers, and underscores only.' };
  }

  const normalized = normalize(username);
  const hit = BANNED_WORDS.find((word) => normalized.includes(word));
  if (hit) {
    return { ok: false, reason: 'That username is not allowed.' };
  }

  return { ok: true };
}
