import { User } from 'firebase/auth';

function usesAppleProvider(user: User): boolean {
  return user.providerData.some((provider) => provider.providerId === 'apple.com');
}

function isApplePrivateRelayEmail(email: string): boolean {
  return /@privaterelay\.appleid\.com$/i.test(email);
}

export interface AccountDisplay {
  title: string;
  subtitle?: string;
}

/** Me tab account line — never show Apple's private relay address as the main label. */
export function getAccountDisplay(
  user: User,
  profileDisplayName?: string | null,
): AccountDisplay {
  const email = user.email?.trim() ?? '';
  const savedName = profileDisplayName?.trim() || user.displayName?.trim() || '';

  if (usesAppleProvider(user)) {
    if (savedName) {
      return {
        title: savedName,
        subtitle: 'Signed in with Apple',
      };
    }

    if (email && !isApplePrivateRelayEmail(email)) {
      return {
        title: email,
        subtitle: 'Signed in with Apple',
      };
    }

    return {
      title: 'Apple account',
      subtitle: 'Signed in with Apple',
    };
  }

  if (savedName) {
    return {
      title: savedName,
      subtitle: email || undefined,
    };
  }

  if (email) {
    return { title: email };
  }

  return { title: 'Signed in' };
}
