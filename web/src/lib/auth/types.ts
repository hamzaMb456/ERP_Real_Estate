export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  /** Staff role (org_admin, manager, viewer) or "user" for a client account. */
  defaultRole: string;
};

export type AuthSession = {
  /** Cognito ID token: carries custom:role and custom:org_id, sent to the server and AppSync. */
  accessToken: string;
  /** Cognito access token: only used to sign out. */
  cognitoAccessToken: string;
  refreshToken: string;
  /** Epoch milliseconds when the ID token expires. */
  expiresAt: number;
  user: AuthUser;
};
