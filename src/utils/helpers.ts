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
