// Adapts the existing handle*() cores (used today behind Nhost's Express-style default export) to an
// AWS Lambda handler shape, so the same logic can run via API Gateway + Lambda on Floci (or real AWS)
// instead of Nhost's function runtime. The handle*() functions are already runtime-agnostic
// ({headers, body, env} in, CoreResult out) — this only translates the event/response envelope.
import type { CoreResult } from './runtime';

export type ApiGatewayProxyEvent = {
  headers?: Record<string, string | undefined>;
  body?: string | null;
  isBase64Encoded?: boolean;
};

export type ApiGatewayProxyResult = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
};

/** API Gateway lower-cases nothing by default; isAuthorizedWebhook already matches headers case-insensitively. */
export function parseEventBody(event: ApiGatewayProxyEvent): unknown {
  if (event.body == null) return undefined;
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function toLambdaResponse(result: CoreResult): ApiGatewayProxyResult {
  return {
    statusCode: result.status,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(result.body),
  };
}
