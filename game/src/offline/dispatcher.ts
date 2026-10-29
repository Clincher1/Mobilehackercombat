import { dispatchApiRequest } from '../../api/_router';
import type { ApiRequest, ApiResponse } from '../../api/_lib/http';

// Run the existing game rules locally. No HTTP request or server is involved.
export async function dispatchOffline(path: string, method: 'GET' | 'POST', body: unknown, headers: Record<string, string>) {
  const req = {
    url: path, method, body: body ?? {},
    headers: { host: 'offline.local', 'x-demo-user-id': headers['X-Demo-User-Id'], 'x-demo-username': headers['X-Demo-Username'] },
    socket: { remoteAddress: 'offline' },
  } as unknown as ApiRequest;
  let payload = '';
  let status = 200;
  const responseHeaders: Record<string, string> = {};
  const res = {
    get statusCode() { return status; }, set statusCode(value: number) { status = value; },
    setHeader(name: string, value: string) { responseHeaders[name.toLowerCase()] = String(value); },
    end(value: string) { payload = value ?? ''; },
  } as unknown as ApiResponse;
  await dispatchApiRequest(req, res);
  return { status, headers: responseHeaders, data: JSON.parse(payload) };
}
