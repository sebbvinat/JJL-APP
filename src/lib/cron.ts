import { NextResponse, type NextRequest } from 'next/server';

/**
 * Vercel attaches `Authorization: Bearer ${CRON_SECRET}` to requests from
 * its cron runner. Reject anything else.
 *
 * The extra `x-vercel-cron` check is a belt-and-suspenders: Vercel sets it
 * on scheduled invocations. We accept either so local `curl` tests with the
 * secret also work.
 */
export function requireCron(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET no configurado' },
      { status: 500 }
    );
  }
  const header = request.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  if (header !== expected && request.headers.get('x-vercel-cron') !== '1') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  return null;
}
