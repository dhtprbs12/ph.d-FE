const API_BASE = 'https://phd-be-production.up.railway.app';

export function buildImageUrl(imageUrl?: string | null): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return `${API_BASE}${imageUrl}`;
}

export function productTypeLabel(type?: string): string {
  switch (type) {
    case 'dry_food': return 'Dry Food';
    case 'wet_food': return 'Wet Food';
    case 'treats': return 'Treats';
    case 'supplement': return 'Supplement';
    default: return 'Food';
  }
}

export function productTypeEmoji(type?: string): string {
  switch (type) {
    case 'dry_food': return '🥣';
    case 'wet_food': return '🥫';
    case 'treats': return '🦴';
    case 'supplement': return '💊';
    default: return '🍽️';
  }
}

export function scanTypeLabel(type: string): string {
  switch (type?.toLowerCase()) {
    case 'barcode': return 'Barcode';
    case 'label_photo':
    case 'label': return 'Label';
    case 'manual_input':
    case 'manual': return 'Manual';
    default: return 'Scan';
  }
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

/** First Latin letter of each space-separated word (and hyphen-separated part) upper; other Latin letters lower. */
function titleCaseLatinChunk(chunk: string): string {
  if (!chunk) return chunk;
  const lower = chunk.toLowerCase();
  const i = lower.search(/[a-z]/);
  if (i === -1) return chunk;
  return lower.slice(0, i) + lower.charAt(i).toUpperCase() + lower.slice(i + 1);
}

/** Brand / product name display: title-style Latin words (e.g. BLUE BUFFALO → Blue Buffalo). */
export function formatProductTitleText(value: string | null | undefined): string {
  if (value == null) return '';
  const t = value.trim();
  if (!t) return '';
  return t
    .split(/\s+/)
    .map((word) =>
      word
        .split(/(-)/)
        .map((part) => (part === '-' ? '-' : titleCaseLatinChunk(part)))
        .join('')
    )
    .join(' ');
}
