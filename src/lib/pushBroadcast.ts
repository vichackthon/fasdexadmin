import { supabase } from './supabase'

export const PUSH_AUDIENCES = ['customers', 'riders', 'vendors', 'everyone'] as const
export type PushAudience = (typeof PUSH_AUDIENCES)[number]

export const AUDIENCE_LABELS: Record<PushAudience, string> = {
    customers: 'All customers',
    riders: 'All riders',
    vendors: 'All vendors',
    everyone: 'Everyone',
}

export interface AudienceStats {
    /** People the audience matches. */
    audienceTotal: number
    /** Of those, how many have a device token and could actually receive a push. */
    reachableTotal: number
}

export interface BroadcastRequest {
    audience: PushAudience
    title: string
    body: string
    /** In-app route to open on tap, e.g. '/send-parcel'. */
    deepLink?: string
}

export interface BroadcastResult {
    campaignId: string
    audienceTotal: number
    reachableTotal: number
    inappCount: number
    sent: number
    failed: number
    clearedTokens: number
    /** The send hit its time budget; `sent + failed` is short of `reachableTotal`. */
    truncated: boolean
}

export interface PushCampaignRow {
    id: string
    audience: PushAudience
    title: string
    body: string
    deep_link: string | null
    status: 'sending' | 'sent' | 'failed'
    audience_total: number
    reachable_total: number
    sent_count: number
    failed_count: number
    cleared_token_count: number
    inapp_count: number
    error: string | null
    created_at: string
    completed_at: string | null
}

/**
 * How many people a given audience covers.
 *
 * Comes from the same SQL function the send resolves recipients through, so
 * the number shown on the confirm dialog is the number that actually gets a
 * notification — the two cannot drift apart.
 */
export async function fetchAudienceStats(audience: PushAudience): Promise<AudienceStats> {
    const { data, error } = await supabase.rpc('push_audience_stats', { p_audience: audience })
    if (error) throw error

    const row = (Array.isArray(data) ? data[0] : data) as
        | { audience_total: number | string; reachable_total: number | string }
        | undefined

    return {
        audienceTotal: Number(row?.audience_total ?? 0),
        reachableTotal: Number(row?.reachable_total ?? 0),
    }
}

export async function fetchPushCampaigns(limit = 25): Promise<PushCampaignRow[]> {
    const { data, error } = await supabase
        .from('push_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) throw error
    return (data ?? []) as PushCampaignRow[]
}

/**
 * Send the broadcast.
 *
 * Goes to the `broadcast-push` Edge Function rather than writing rows
 * directly: the capability check, the audience resolution and the FCM sending
 * all have to happen with credentials the browser must never hold.
 */
export async function sendBroadcast(req: BroadcastRequest): Promise<BroadcastResult> {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) throw new Error('Your session has expired. Sign in again.')

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
    const resp = await fetch(`${supabaseUrl}/functions/v1/broadcast-push`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            audience: req.audience,
            title: req.title,
            body: req.body,
            deep_link: req.deepLink || undefined,
        }),
    })

    if (resp.status === 401) throw new Error('Your session has expired. Sign in again.')
    if (resp.status === 403) throw new Error('You do not have permission to send broadcasts.')

    const result = await resp.json().catch(() => null) as
        | (Record<string, unknown> & { ok?: boolean; message?: string })
        | null

    if (!resp.ok || !result?.ok) {
        throw new Error(result?.message ?? 'The broadcast could not be sent.')
    }

    return {
        campaignId: String(result.campaign_id),
        audienceTotal: Number(result.audience_total ?? 0),
        reachableTotal: Number(result.reachable_total ?? 0),
        inappCount: Number(result.inapp_count ?? 0),
        sent: Number(result.sent ?? 0),
        failed: Number(result.failed ?? 0),
        clearedTokens: Number(result.cleared_tokens ?? 0),
        truncated: result.truncated === true,
    }
}
