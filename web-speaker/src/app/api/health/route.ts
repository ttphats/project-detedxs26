import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    success: true, 
    message: 'Web-speaker API is healthy',
    timestamp: new Date().toISOString()
  });
}
