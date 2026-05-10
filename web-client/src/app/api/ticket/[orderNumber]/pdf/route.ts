import {NextRequest, NextResponse} from 'next/server'

/**
 * GET /api/ticket/:orderNumber/pdf
 * Proxy PDF generation request to backend
 */
export async function GET(
  request: NextRequest,
  {params}: {params: Promise<{orderNumber: string}>}
) {
  try {
    const {orderNumber} = await params
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json({success: false, error: 'Access token required'}, {status: 401})
    }

    // Forward to backend API - disable redirect to prevent loop
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'
    const pdfApiUrl = `${backendUrl}/ticket/${orderNumber}/pdf?token=${token}`

    const response = await fetch(pdfApiUrl, {
      headers: {
        'User-Agent': request.headers.get('user-agent') || '',
      },
      redirect: 'manual', // Don't follow redirects
    })

    // If backend redirects (302), follow it manually but to the final destination
    if (response.status === 302) {
      const redirectUrl = response.headers.get('location')
      if (redirectUrl) {
        // Follow the redirect
        const finalResponse = await fetch(redirectUrl, {
          headers: {
            'User-Agent': request.headers.get('user-agent') || '',
          },
        })

        if (!finalResponse.ok) {
          return NextResponse.json(
            {success: false, error: 'PDF generation failed after redirect'},
            {status: finalResponse.status}
          )
        }

        const pdfBlob = await finalResponse.blob()
        return new NextResponse(pdfBlob, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="ticket-${orderNumber}.pdf"`,
          },
        })
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({error: 'PDF generation failed'}))
      return NextResponse.json(error, {status: response.status})
    }

    // Return PDF blob
    const pdfBlob = await response.blob()

    return new NextResponse(pdfBlob, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ticket-${orderNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF proxy error:', error)
    return NextResponse.json({success: false, error: 'Failed to generate PDF'}, {status: 500})
  }
}
