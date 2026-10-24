import { handleAppointmentEmail } from '../send-appointment-email';
import { parseEventBody, toLambdaResponse, type ApiGatewayProxyEvent, type ApiGatewayProxyResult } from '../_lib/lambda-adapter';

export async function handler(event: ApiGatewayProxyEvent): Promise<ApiGatewayProxyResult> {
  const result = await handleAppointmentEmail({ headers: event.headers ?? {}, body: parseEventBody(event), env: process.env });
  return toLambdaResponse(result);
}
