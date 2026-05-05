'use client'

import {ReactNode, useEffect} from 'react'
import {useRouter, usePathname} from 'next/navigation'
import {useAuthState, AuthContext} from '@/hooks/useAuth'
import {Spin} from 'antd'

interface AuthProviderProps {
  children: ReactNode
}

function LoadingScreen({text = 'Loading...'}: {text?: string}) {
  return (
    <div className='min-h-screen flex flex-col items-center justify-center bg-gray-100 gap-4'>
      <Spin size='large' />
      <span className='text-gray-500'>{text}</span>
    </div>
  )
}

export default function AuthProvider({children}: AuthProviderProps) {
  const auth = useAuthState()
  const router = useRouter()
  const pathname = usePathname()

  const isLoginPage = pathname === '/admin/login'

  // Handle redirects in useEffect to avoid state updates during render
  useEffect(() => {
    if (auth.loading) return

    // Only redirect to dashboard if authenticated and on login page
    // Don't redirect to login here - let middleware handle it
    if (auth.isAuthenticated && isLoginPage) {
      router.push('/admin/dashboard')
      return
    }
  }, [auth.loading, auth.isAuthenticated, isLoginPage, router, pathname])

  // Show loading while checking auth
  if (auth.loading) {
    return <LoadingScreen />
  }

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}
