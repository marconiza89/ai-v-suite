// src/app/api/check-api-key/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const hasKey = !!process.env.GOOGLE_API_KEY;
  return NextResponse.json({ hasKey });
}