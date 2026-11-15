import { supabase } from './supabase'

/**
 * Wrappers over the admin order-intervention RPCs
 * (20260923150000_admin_order_interventions.sql).
 *
 * Every one of these is a SECURITY DEFINER function that checks
 * admin_can() before it writes and appends to admin_audit_log after. The
 * dashboard never UPDATEs `orders` directly for these three verbs: the
 * orders RLS policies still spell staff as `role IN ('admin','sub_admin')`,
 * which makes a sub_admin a full admin, and phase 2 has not rewritten
 * them. Going through the RPCs means the tier grid is respected today.
 *
 * The RPCs return `{ ok: false, error }` for situations an operator can
 * act on ("the rider already has the food") and raise 42501 only for a
 * genuine permission failure. Both arrive here as a rejected promise with
 * a readable message.
 */

export interface AssignableRider {
    rider_id: string
    full_name: string | null
    phone_number: string | null
    is_online: boolean
    is_available: boolean
    active_deliveries: number
    distance_m: number | null
    last_seen: string | null
}

export interface InterventionResult {
    message: string
    /** Set by cancelOrder when the order was already paid. */
    refundOwed?: boolean
}

/** Turns both failure shapes into one thrown Error. */
function unwrap(
    data: Record<string, unknown> | null,
    error: { message: string } | null,
): Record<string, unknown> {
    if (error) {
        // 42501 from the admin_can() gate — the raw Postgres text is
        // already the sentence we want to show.
        throw new Error(error.message)
    }
    if (!data || data.ok !== true) {
        throw new Error(
            (data?.error as string | undefined) ?? 'The action did not go through. Try again.',
        )
    }
    return data
}

export async function fetchAssignableRiders(orderId: string): Promise<AssignableRider[]> {
    const { data, error } = await supabase.rpc('admin_assignable_riders', {
        p_order_id: orderId,
    })
    if (error) throw new Error(error.message)
    return (data ?? []) as AssignableRider[]
}

/**
 * Take the order back from its rider and return it to the dispatch pool.
 * Only valid before pickup — the RPC refuses once the food is in transit.
 */
export async function releaseRider(
    orderId: string,
    reason: string,
): Promise<InterventionResult> {
    const { data, error } = await supabase.rpc('admin_release_order_rider', {
        p_order_id: orderId,
        p_reason: reason || null,
    })
    const result = unwrap(data as Record<string, unknown> | null, error)
    return { message: result.message as string }
}

/** Hand the order to a named rider, releasing the current one first. */
export async function assignRider(
    orderId: string,
    riderId: string,
    reason: string,
): Promise<InterventionResult> {
    const { data, error } = await supabase.rpc('admin_assign_order_rider', {
        p_order_id: orderId,
        p_rider_id: riderId,
        p_reason: reason || null,
    })
    const result = unwrap(data as Record<string, unknown> | null, error)
    return { message: result.message as string }
}

/**
 * Cancel the order. Nothing here moves money — a paid order still needs a
 * manual Paystack refund, which `refundOwed` flags so the UI can say so.
 */
export async function cancelOrder(
    orderId: string,
    reason: string,
): Promise<InterventionResult> {
    const { data, error } = await supabase.rpc('admin_cancel_order', {
        p_order_id: orderId,
        p_reason: reason,
    })
    const result = unwrap(data as Record<string, unknown> | null, error)
    return {
        message: result.message as string,
        refundOwed: result.refund_owed === true,
    }
}

/** "1.2 km" / "340 m" / "—" for the rider picker. */
export function formatDistance(metres: number | null): string {
    if (metres == null) return '—'
    if (metres < 1000) return `${Math.round(metres)} m`
    return `${(metres / 1000).toFixed(1)} km`
}

/** "12m" / "1h 40m", for how long an order has been sitting. */
export function formatElapsed(since: string | null): string {
    if (!since) return '—'
    const ms = Date.now() - new Date(since).getTime()
    if (Number.isNaN(ms) || ms < 0) return '—'
    const minutes = Math.floor(ms / 60000)
    if (minutes < 60) return `${minutes}m`
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
