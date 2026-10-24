import { handleLeaseDaily } from '../lease-daily';
import { toLambdaResponse, type ApiGatewayProxyEvent, type ApiGatewayProxyResult } from '../_lib/lambda-adapter';

export async function handler(event: ApiGatewayProxyEvent): Promise<ApiGatewayProxyResult> {
  const result = await handleLeaseDaily({ headers: event.headers ?? {}, env: process.env });
  return toLambdaResponse(result);
}
