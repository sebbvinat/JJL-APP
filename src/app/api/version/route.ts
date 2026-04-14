import { NextResponse } from 'next/server';

export const runtime = 'edge';

const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.NEXT_PUBLIC_BUILD_ID ||
  'dev';

export async function GET() {
  return NextResponse.json(
    { buildId: BUILD_ID },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  );
}
