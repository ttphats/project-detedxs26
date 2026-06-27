import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test database connection
    await prisma.$connect();
    const userCount = await prisma.user.count();

    // Test speaker submissions table
    let submissionsCount = 0;
    let submissionsError = null;
    try {
      submissionsCount = await prisma.speakerSubmission.count();
    } catch (err: any) {
      submissionsError = err.message;
    }

    return NextResponse.json({
      success: true,
      database: 'connected',
      userCount,
      submissionsCount,
      submissionsError,
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
        nodeEnv: process.env.NODE_ENV,
        apiUrl: process.env.NEXT_PUBLIC_API_URL
      }
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
