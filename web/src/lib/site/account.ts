// Client accounts of the public site: a client is an ordinary Cognito user with the default role "user"; staff have one of
// the ERP roles. Helpers shared by the sign-in and sign-up pages, the gates and the ERP guard.

export const STAFF_ROLES: readonly string[] = ['org_admin', 'manager', 'viewer'];
export const SIGN_IN_PATH = '/compte/connexion';
export const SIGN_UP_PATH = '/compte/inscription';
export const FORGOT_PASSWORD_PATH = '/compte/mot-de-passe-oublie';
export const MIN_PASSWORD_LENGTH = 8;

/** True when the role is one of the ERP staff roles (a client never has one). */
export const isStaffRole = (role: string | null | undefined): boolean => role !== null && role !== undefined && STAFF_ROLES.includes(role);

// Where a visitor may be sent back to after signing in: pages of the public site only (never the ERP, never another site).
const SITE_NEXT = /^\/(?:logement\/[0-9a-f-]{36}|louer|acheter|favoris)?(?:\?[^#\s]*)?$/i;

/** The page to return to after signing in: a public-site path, or the home page. */
export function safeSiteNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/';
  return SITE_NEXT.test(next) ? next : '/';
}

/** A link to the sign-in (or sign-up) page that comes back to `next` afterwards. */
export function accountHref(path: typeof SIGN_IN_PATH | typeof SIGN_UP_PATH, next?: string): string {
  const target = next ? safeSiteNext(next) : '/';
  return target === '/' ? path : `${path}?next=${encodeURIComponent(target)}`;
}

export type AccountErrorKey = 'emailTaken' | 'weak' | 'invalid' | 'other';

/** The wording key for a Cognito (or data-layer) auth error code. */
export function accountErrorKey(code: string | undefined): AccountErrorKey {
  switch (code) {
    case 'UsernameExistsException':
      return 'emailTaken';
    case 'InvalidPasswordException':
      return 'weak';
    case 'InvalidParameterException':
    case 'NotAuthorizedException':
    case 'CodeMismatchException':
    case 'ExpiredCodeException':
    case 'invalid-request':
      return 'invalid';
    default:
      return 'other';
  }
}

export type AccountInput = { name: string; email: string; password: string };
export type AccountProblem = 'required' | 'email' | 'short';
export type AccountErrors = Partial<Record<keyof AccountInput, AccountProblem>>;

const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** What the form checks before asking the server (the server stays the authority). `name` only counts when signing up. */
export function validateAccount(input: AccountInput, mode: 'signin' | 'signup'): AccountErrors {
  const errors: AccountErrors = {};
  if (mode === 'signup' && input.name.trim().length < 2) errors.name = 'required';
  if (input.email.trim() === '') errors.email = 'required';
  else if (!EMAIL_FORMAT.test(input.email.trim())) errors.email = 'email';
  if (input.password === '') errors.password = 'required';
  else if (mode === 'signup' && input.password.length < MIN_PASSWORD_LENGTH) errors.password = 'short';
  return errors;
}
