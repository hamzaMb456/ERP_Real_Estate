import { NextResponse } from 'next/server';
import { PUBLIC_TOKEN, appsyncRequest } from '@/lib/backend';

// Same-origin relay from the browser to AppSync (Floci sends no CORS headers). It adds no rights:
// the caller's token goes through unchanged and AppSync's Lambda authorizer checks every call.
export async function POST(request: Request): Promise<Response> {
  const payload = (await request.json().catch(() => null)) as { query?: unknown; variables?: unknown } | null;
  if (typeof payload?.query !== 'string' || (payload.variables != null && typeof payload.variables !== 'object')) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }
  const token = request.headers.get('authorization') || PUBLIC_TOKEN;
  try {
    const data = await appsyncRequest(payload.query, (payload.variables ?? {}) as Record<string, unknown>, token);
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'server_error';
    return NextResponse.json({ error: message }, { status: /permission_denied/.test(message) ? 403 : 400 });
  }
}
