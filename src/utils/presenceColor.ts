const COLORS = [
  { background: '#FF6B6B', stroke: '#C53030' },
  { background: '#4ECDC4', stroke: '#2C7A7B' },
  { background: '#45B7D1', stroke: '#2B6CB0' },
  { background: '#96CEB4', stroke: '#276749' },
  { background: '#FFEAA7', stroke: '#D69E2E' },
  { background: '#DDA0DD', stroke: '#805AD5' },
  { background: '#F0A500', stroke: '#C05621' },
  { background: '#88D8B0', stroke: '#2F855A' },
];

function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getPresenceColor(userId: string): { background: string; stroke: string } {
  return COLORS[hashUserId(userId) % COLORS.length];
}
