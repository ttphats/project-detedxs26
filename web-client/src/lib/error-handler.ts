/**
 * Sanitize error messages for production
 * Never expose technical database errors to users
 */
export function sanitizeError(error: any, fallbackMessage: string = 'Có lỗi xảy ra'): string {
  // Always log the real error for debugging
  console.error('Error:', error)

  // In development, you might want to show more details
  const isDev = process.env.NODE_ENV === 'development'

  // Database-related errors - never expose to users
  const dbErrorKeywords = [
    'table',
    'column',
    'database',
    'mysql',
    'sql',
    'query',
    'prisma',
    'constraint',
    'foreign key',
    'duplicate entry',
  ]

  const errorMessage = error?.message || error?.toString() || ''
  const lowerMessage = errorMessage.toLowerCase()

  // Check if error contains database keywords
  const isDatabaseError = dbErrorKeywords.some((keyword) => lowerMessage.includes(keyword))

  if (isDatabaseError) {
    // Never expose database errors in production
    if (isDev) {
      return `[DEV] ${errorMessage}`
    }
    return fallbackMessage
  }

  // For other errors, show a generic message
  return fallbackMessage
}

/**
 * Create a safe error response for API routes
 */
export function createErrorResponse(
  error: any,
  fallbackMessage: string = 'Có lỗi xảy ra'
): {success: false; error: string} {
  return {
    success: false,
    error: sanitizeError(error, fallbackMessage),
  }
}
