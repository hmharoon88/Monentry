const JOIN_PREFIX = 'monentry://join?code=';

export function buildHouseholdInviteLink(code: string): string {
  return `${JOIN_PREFIX}${encodeURIComponent(code.trim().toUpperCase())}`;
}

export function parseHouseholdInviteCode(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('monentry://')) {
    try {
      const url = new URL(trimmed);
      if (url.hostname === 'join' || url.pathname.includes('join')) {
        const code = url.searchParams.get('code') ?? url.pathname.split('/').pop();
        return code ? normalizeInviteCode(code) : null;
      }
    } catch {
      // fall through
    }
  }

  if (trimmed.includes('code=')) {
    const match = trimmed.match(/code=([A-Z0-9]+)/i);
    if (match?.[1]) {
      return normalizeInviteCode(match[1]);
    }
  }

  if (/^[A-Z0-9]{4,8}$/i.test(trimmed)) {
    return normalizeInviteCode(trimmed);
  }

  return null;
}

function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}
