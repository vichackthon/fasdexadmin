import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Session } from '@supabase/supabase-js'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [loading, setLoading] = useState(true)
    const [roleAllowed, setRoleAllowed] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const location = useLocation()
    // Role is verified once per user id, not per access token: a TOKEN_REFRESHED
    // event must not tear the app down. RLS enforces access server-side either way.
    const verifiedUserIdRef = useRef<string | null>(null)
    const inFlightUserIdRef = useRef<string | null>(null)

    useEffect(() => {
        let active = true
        let eventReceived = false
        console.log('[Auth] ProtectedRoute mounted')

        // Safety timeout to show recovery options if it hangs
        const safetyTimeoutId = setTimeout(() => {
            if (active && !eventReceived) {
                console.warn('[Auth] No auth event received after 20s')
                setErrorMessage('Authentication service is taking too long to respond.')
                setLoading(false)
            }
        }, 20000)

        const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string) => {
            let timeoutId: ReturnType<typeof setTimeout> | null = null
            const timeoutPromise = new Promise<T>((_, reject) => {
                timeoutId = setTimeout(() => {
                    console.warn(`[Auth] ${label} timed out after ${ms}ms`)
                    reject(new Error('timeout'))
                }, ms)
            })
            try {
                return await Promise.race([promise, timeoutPromise])
            } finally {
                if (timeoutId) clearTimeout(timeoutId)
            }
        }

        const failVerification = (userId: string, message: string) => {
            inFlightUserIdRef.current = null
            setErrorMessage(message)
            setRoleAllowed(false)
            setLoading(false)
            console.warn('[Auth] Verification failed for user:', userId)
        }

        const verifySession = async (currentSession: Session | null, attempt = 0) => {
            if (!active) return
            console.log('[Auth] Verifying session:', currentSession?.user?.id || 'No session')

            if (!currentSession) {
                console.log('[Auth] No session found, redirecting to login')
                verifiedUserIdRef.current = null
                inFlightSessionReset()
                setRoleAllowed(true)
                setErrorMessage(null)
                setLoading(false)
                return
            }

            const userId = currentSession.user.id

            if (verifiedUserIdRef.current === userId) {
                console.log('[Auth] User already verified this session, skipping role check')
                setErrorMessage(null)
                setRoleAllowed(true)
                setLoading(false)
                return
            }

            if (attempt === 0) {
                if (inFlightUserIdRef.current === userId) {
                    console.log('[Auth] Verification already in progress for this user, skipping duplicate event')
                    return
                }
                inFlightUserIdRef.current = userId
            }

            // Only block the UI when nothing has been verified yet (fresh page load).
            // If a different user somehow appears mid-session, verify in the background
            // and let RLS keep any data queries safe in the meantime.
            if (verifiedUserIdRef.current === null) {
                setLoading(true)
            }

            try {
                console.log('[Auth] Checking profile for:', userId, attempt > 0 ? `(retry ${attempt})` : '')
                const { data, error } = await withTimeout<{ data: any; error: any }>(
                    supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', userId)
                        .maybeSingle() as any,
                    15000,
                    'Profile check'
                )

                if (!active || inFlightUserIdRef.current !== userId) return

                if (error) {
                    console.error('[Auth] Profile check error:', error)
                    if (attempt === 0) {
                        scheduleRetry(currentSession)
                        return
                    }
                    failVerification(userId, 'Unable to verify your account permissions (Database Error).')
                    return
                }

                inFlightUserIdRef.current = null

                const role = data?.role
                console.log('[Auth] User role found:', role)

                if (!data) {
                    console.warn('[Auth] No profile found for user')
                    setErrorMessage('Your account exists but has no profile data. Please contact support.')
                    setRoleAllowed(false)
                    setLoading(false)
                    return
                }

                const allowed = role === 'admin' || role === 'sub_admin'
                verifiedUserIdRef.current = allowed ? userId : null
                setRoleAllowed(allowed)

                if (!allowed) {
                    console.warn('[Auth] Access denied for role:', role)
                    setErrorMessage('Your account does not have admin access.')
                    supabase.auth.signOut({ scope: 'local' })
                } else {
                    setErrorMessage(null)
                    setLoading(false)
                }
            } catch (err) {
                if (!active || inFlightUserIdRef.current !== userId) return
                console.error('[Auth] Verification exception:', err)
                if (attempt === 0) {
                    scheduleRetry(currentSession)
                    return
                }
                const message = err instanceof Error && err.message === 'timeout'
                    ? 'The authentication server is taking too long to respond.'
                    : 'System verification failed.'
                failVerification(userId, message)
            }
        }

        // Transient network blips are common right after a laptop wakes up,
        // which is exactly when this code tends to run. Retry once before failing.
        const scheduleRetry = (currentSession: Session) => {
            console.warn('[Auth] Retrying profile check in 2s')
            setTimeout(() => {
                if (active) verifySession(currentSession, 1)
            }, 2000)
        }

        const inFlightSessionReset = () => {
            inFlightUserIdRef.current = null
        }

        // Listen for changes. IMPORTANT: never await Supabase calls inside this
        // callback — it holds the auth lock, and queries need that same lock to
        // read the session, which deadlocks (the classic stale-tab infinite
        // spinner on supabase-js >= 2.39). Defer real work with setTimeout(0).
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            if (!active) return
            eventReceived = true
            console.log('[Auth] Auth state changed:', event, session?.user?.id || 'None')

            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                setSession(session)
                setTimeout(() => verifySession(session), 0)
            } else if (event === 'SIGNED_OUT') {
                verifiedUserIdRef.current = null
                inFlightSessionReset()
                setSession(null)
                setRoleAllowed(true)
                setErrorMessage(null)
                setLoading(false)
            }
        })

        return () => {
            console.log('[Auth] ProtectedRoute unmounting')
            active = false
            clearTimeout(safetyTimeoutId)
            subscription.unsubscribe()
        }
    }, [])

    const handleReset = async () => {
        console.log('[Auth] Client-side reset initiated')
        localStorage.clear()
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        window.location.assign('/login')
    }

    if (loading) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-white">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-100 border-t-[#FF6E15]" />
                    <div className="text-center">
                        <p className="text-sm font-medium text-gray-900">Authenticating...</p>
                        <p className="mt-1 text-xs text-gray-500">Checking your secure session</p>
                    </div>
                </div>
                <button
                    onClick={handleReset}
                    className="mt-12 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-4"
                >
                    Taking too long? Click to reset session
                </button>
            </div>
        )
    }

    if (errorMessage) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-white px-4">
                <div className="max-w-md text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="mt-4 text-lg font-bold text-gray-900">Access Issue</h2>
                    <p className="mt-2 text-sm text-gray-600">{errorMessage}</p>
                    <div className="mt-6 flex flex-col gap-3">
                        <button
                            className="inline-flex items-center justify-center rounded-lg bg-[#FF6E15] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#FF6E15]/90 transition-colors"
                            onClick={() => window.location.reload()}
                        >
                            Try refreshing the page
                        </button>
                        <button
                            className="text-sm font-medium text-gray-500 hover:text-gray-700"
                            onClick={handleReset}
                        >
                            Log out and reset session
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (!session || !roleAllowed) {
        return <Navigate to="/login" state={{ from: location }} replace />
    }

    return <>{children}</>
}
