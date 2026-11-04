/**
 * Content moderation and profanity detection for user chat messages, reviews, and comments.
 * Covers Vietnamese and English profane, vulgar, and abusive terms while avoiding
 * false positives in normal travel platform conversations.
 */

export const PROFANITY_ERROR_MESSAGE = 'Tin nhắn chứa từ ngữ không phù hợp hoặc vi phạm tiêu chuẩn cộng đồng';

// Multi-word phrases that indicate harassment, abuse, or vulgarity
const PROFANE_PHRASES = [
  // Vietnamese multi-word vulgarities & insults
  'địt mẹ',
  'dit me',
  'địt con mẹ',
  'dit con me',
  'địt cụ',
  'dit cu',
  'địt bà',
  'dit ba',
  'địt bố',
  'dit bo',
  'địt nhau',
  'dit nhau',
  'đụ mẹ',
  'du me',
  'đụ má',
  'du ma',
  'duma',
  'dume',
  'đụ cha',
  'đụ mọe',
  'du moe',
  'đụ con mẹ',
  'mẹ mày',
  'me may',
  'bà mẹ mày',
  'con mẹ mày',
  'con me may',
  'cha mày',
  'cha may',
  'óc chó',
  'oc cho',
  'chó đẻ',
  'cho de',
  'đồ chó',
  'do cho',
  'thằng chó',
  'thang cho',
  'con chó mày',
  'con cho nay',
  'lũ chó',
  'đồ súc vật',
  'con súc vật',
  'súc sinh',
  'suc sinh',
  'mặt lồn',
  'mat lon',
  'ngu lồn',
  'ngu lon',
  'hãm lồn',
  'ham lon',
  'xàm lồn',
  'xam lon',
  'nứng lồn',
  'nung lon',
  'bú lồn',
  'bu lon',
  'cái lồn',
  'cai lon',
  'bú cặc',
  'bu cac',
  'ngu cặc',
  'ngu cac',
  'xàm cặc',
  'xam cac',
  'cái cặc',
  'cai cac',
  'đồ khốn',
  'thằng khốn',
  'con khốn',
  'mất dạy',
  'mat day',
  'khốn nạn',
  'khon nan',
  'con đĩ',
  'con di',
  'đồ đĩ',
  'thằng mặt lồn',
  'thằng mặt cặc',
  'vãi lồn',
  'vai lon',
  'vãi cặc',
  'vai cac',
  'vãi đái',
  'vai dai',
  'đéo mẹ',
  'deo me',
  'đéo cần',
  'deo can',
  'đéo biết',
  'deo biet',
  'đéo được',
  'deo duoc',
  'cút đi',
  'cút mẹ',
  'cut me',
  'bố mày',
  'bo may',
  'chết tiệt',
];

// Single word patterns (matched with unicode boundary: not preceded or followed by unicode letter or digit)
const PROFANE_WORDS = [
  // Vietnamese unambiguous vulgar words
  'đ+ị+t+',
  'd+i+t+',
  'c+ặ+c+',
  'c+ặ+k+',
  'c+a+k+',
  'l+ồ+n+',
  'l+0+n+',
  'l+ồ+z+',
  'l+o+z+',
  'b+u+ồ+i+',
  'đ+é+o+',
  'đ+ĩ+',
  'đ+ỉ+',
  // Common Vietnamese swearing acronyms
  'đ+m+',
  'd+m+',
  'đ+m+m+',
  'd+m+m+',
  'đ+c+m+',
  'd+c+m+',
  'đ+c+l+',
  'd+c+l+',
  'c+l+m+m+',
  'c+l+g+t+',
  'v+c+l+',
  'v+k+l+',
  'v+c+c+',
  'v+c+l+l+',
  'd+k+m+',
  'v+l+',
  // English vulgar words (with repetition allowance)
  'f+u+c+k+[a-z]*',
  'f+c+k+',
  'b+i+t+c+h+[a-z]*',
  'b+t+c+h+',
  's+h+i+t+[a-z]*',
  'b+u+l+l+s+h+i+t+',
  'a+s+s+h+o+l+e+[a-z]*',
  'd+i+c+k+h+e+a+d+[a-z]*',
  'd+i+c+k+',
  'p+u+s+s+y+',
  'c+u+n+t+',
  'b+a+s+t+a+r+d+[a-z]*',
  'w+h+o+r+e+[a-z]*',
  's+l+u+t+[a-z]*',
  'm+o+t+h+e+r+f+u+c+k+e+r+[a-z]*',
];

// Build regex patterns
// Unicode boundary: start of text or character other than letter and digit
const BOUNDARY_PRE = '(?:^|[^\\p{L}\\p{N}])';
const BOUNDARY_POST = '(?=[^\\p{L}\\p{N}]|$)';

const PHRASE_REGEXES: RegExp[] = PROFANE_PHRASES.map(
  (phrase) => new RegExp(`${BOUNDARY_PRE}${escapeRegex(phrase)}${BOUNDARY_POST}`, 'iu'),
);

const WORD_REGEXES: RegExp[] = PROFANE_WORDS.map(
  (word) => new RegExp(`${BOUNDARY_PRE}${word}${BOUNDARY_POST}`, 'iu'),
);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes text to uncover evasion attempts like:
 * - "đ.m", "d_m", "v-c-l", "f.u.c.k"
 * - leetspeak: "d!t" -> "dit", "c@c" -> "cac", "l0n" -> "lon", "f*ck" -> "fck"
 * - spaced single letters: "đ m" -> "đm", "v c l" -> "vcl"
 */
function normalizeEvasions(raw: string): string {
  let text = raw.toLowerCase();

  // Leetspeak substitutions
  text = text
    .replace(/[@]/g, 'a')
    .replace(/[!]/g, 'i')
    .replace(/[$]/g, 's')
    .replace(/[*]/g, '')
    .replace(/0/g, 'o');

  // Collapse dots/hyphens/underscores between single letters: e.g. "d.m" -> "dm", "f.u.c.k" -> "fuck"
  text = text.replace(new RegExp('([\\p{L}\\p{N}])[._\\-~+]+(?=[\\p{L}\\p{N}])', 'gu'), '$1');

  // Collapse spaces between isolated single letters: e.g. "đ m" -> "đm", "v c l" -> "vcl", "f u c k" -> "fuck"
  text = text.replace(new RegExp('(?:^|[^\\p{L}\\p{N}])(\\p{L}(?:\\s+\\p{L})+)(?=[^\\p{L}\\p{N}]|$)', 'gu'), (_, group: string) =>
    group.replace(/\s+/g, ''),
  );

  return text;
}

/**
 * Checks if a string contains profanity, vulgarity, or toxic swearing.
 * Returns true if blocked content is detected.
 */
export function containsProfanity(rawText: string | undefined | null): boolean {
  if (!rawText) return false;
  const trimmed = rawText.trim();
  if (!trimmed) return false;

  const normalized = normalizeEvasions(trimmed);

  // Check original text against phrases and words
  for (const regex of PHRASE_REGEXES) {
    if (regex.test(trimmed)) return true;
  }
  for (const regex of WORD_REGEXES) {
    if (regex.test(trimmed)) return true;
  }

  // Check normalized evasions
  if (normalized !== trimmed.toLowerCase()) {
    for (const regex of PHRASE_REGEXES) {
      if (regex.test(normalized)) return true;
    }
    for (const regex of WORD_REGEXES) {
      if (regex.test(normalized)) return true;
    }
  }

  return false;
}
