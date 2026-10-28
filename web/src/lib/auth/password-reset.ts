// Forgotten-password flow shared by the ERP and the public site: ask for a code by e-mail, then set a new password with it.

export const RESET_CODE_LENGTH = 6;
/** Same rule as the Cognito pool: 8+ characters with an upper case letter, a lower case letter and a digit. */
export const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const EMAIL_FORMAT = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CODE_FORMAT = new RegExp(`^\\d{${RESET_CODE_LENGTH}}$`);

export type ResetProblem = 'required' | 'email' | 'code' | 'weak' | 'mismatch';
export type NewPasswordInput = { code: string; password: string; confirm: string };
export type NewPasswordErrors = Partial<Record<keyof NewPasswordInput, ResetProblem>>;

/** What the first step checks before asking the server for a code; `null` when the address is fine. */
export function validateResetEmail(email: string): ResetProblem | null {
  const value = email.trim();
  if (value === '') return 'required';
  return EMAIL_FORMAT.test(value) ? null : 'email';
}

/** What the second step checks before sending the code and the new password (the server stays the authority). */
export function validateNewPassword(input: NewPasswordInput): NewPasswordErrors {
  const errors: NewPasswordErrors = {};
  const code = input.code.trim();
  if (code === '') errors.code = 'required';
  else if (!CODE_FORMAT.test(code)) errors.code = 'code';
  if (input.password === '') errors.password = 'required';
  else if (!STRONG_PASSWORD.test(input.password)) errors.password = 'weak';
  if (input.confirm !== input.password) errors.confirm = 'mismatch';
  return errors;
}

export type ResetErrorKey = 'badCode' | 'expiredCode' | 'weak' | 'tooMany' | 'invalid' | 'unreachable' | 'other';

/** The wording key for an auth error code coming back from the server. */
export function resetErrorKey(code: string | undefined): ResetErrorKey {
  switch (code) {
    case 'CodeMismatchException':
      return 'badCode';
    case 'ExpiredCodeException':
      return 'expiredCode';
    case 'InvalidPasswordException':
      return 'weak';
    case 'LimitExceededException':
    case 'TooManyRequestsException':
    case 'TooManyFailedAttemptsException':
      return 'tooMany';
    case 'invalid-request':
      return 'invalid';
    case 'unreachable':
      return 'unreachable';
    default:
      return 'other';
  }
}
