import { supabase } from './supabase'

export interface PushNotificationPayload {
  userId: string
  title: string
  body: string
  /** Optional extra key-value pairs delivered to the app */
  data?: Record<string, string>
}

export type PushFailureReason = 'no_fcm_token' | 'unauthorized' | 'error'

export type PushResult =
  | { ok: true }
  | { ok: false; reason: PushFailureReason; message?: string }

/**
 * Sends an ad-hoc push notification to a single user from the admin web app.
 * Requires the calling admin to be signed in — the session JWT is forwarded
 * to the `notify-user` Edge Function which verifies the admin role server-side.
 */
export async function sendPushNotification(
  payload: PushNotificationPayload,
): Promise<PushResult> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) {
    return { ok: false, reason: 'unauthorized', message: 'No active session' }
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const url = `${supabaseUrl}/functions/v1/notify-user`

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      user_id: payload.userId,
      title: payload.title,
      body: payload.body,
      data: payload.data,
    }),
  })

  if (resp.status === 401) {
    return { ok: false, reason: 'unauthorized', message: 'Session expired' }
  }
  if (resp.status === 403) {
    return { ok: false, reason: 'unauthorized', message: 'Admin role required' }
  }
  if (!resp.ok) {
    const text = await resp.text()
    return { ok: false, reason: 'error', message: text }
  }

  const result = await resp.json() as { ok: boolean; reason?: string }
  if (!result.ok) {
    return { ok: false, reason: (result.reason as PushFailureReason | undefined) ?? 'error' }
  }
  return { ok: true }
}
