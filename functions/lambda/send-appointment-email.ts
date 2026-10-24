import { handleAppointmentEmail } from '../send-appointment-email';
import { isAuthorizedWebhook } from '../_lib/webhook';
import { parseEventBody, toLambdaResponse, type ApiGatewayProxyEvent, type ApiGatewayProxyResult } from '../_lib/lambda-adapter';
import { resolveSecretEnv } from '../_lib/secrets';

export async function handler(event: ApiGatewayProxyEvent): Promise<ApiGatewayProxyResult> {
  const headers = event.headers ?? {};
  // Cheap reject before ever calling Secrets Manager — see _lib/secrets.ts for why.
  if (!isAuthorizedWebhook(headers, process.env.NHOST_WEBHOOK_SECRET)) {
    return toLambdaResponse({ status: 401, body: { error: 'unauthorized' } });
  }
  const env = await resolveSecretEnv(process.env);
  const result = await handleAppointmentEmail({ headers, body: parseEventBody(event), env });
  return toLambdaResponse(result);
}
