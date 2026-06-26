import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'No token' }, { status: 401 });
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/speakers/submissions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { rawResponse: text };
    }

    return NextResponse.json({
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),
      data,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
