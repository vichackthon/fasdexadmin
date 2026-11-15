import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { RIDER_HEARTBEAT_WINDOW_MS } from './riderPresence'

type AdminSupabaseClient = SupabaseClient<Database>

/// Statuses that count as an in-progress delivery — mirrors the RLS window in
/// 20260724000000_live_rider_tracking_rls.sql.
const ACTIVE_ORDER_STATUSES = [
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'out_for_delivery',
    'picked_up',
]

export type RiderLocation = {
    riderId: string
    fullName: string | null
    phoneNumber: string | null
    avatarUrl: string | null
    latitude: number
    longitude: number
    lastUpdated: string | null
    isFresh: boolean
    activeOrder: {
        orderNumber: string | null
        status: string | null
        restaurantName: string | null
        deliveryAddress: string | null
    } | null
}

type CourierRow = {
    rider_id: string
    latitude: number | null
    longitude: number | null
    last_updated: string | null
    is_online: boolean | null
    rider:
        | { full_name: string | null; phone_number: string | null; avatar_url: string | null }
        | { full_name: string | null; phone_number: string | null; avatar_url: string | null }[]
        | null
}

function firstOrSelf<T>(value: T | T[] | null): T | null {
    if (!value) return null
    return Array.isArray(value) ? value[0] ?? null : value
}

/// One row per rider that currently has coordinates on file. Riders whose
/// heartbeat is older than the presence window are still returned but flagged
/// `isFresh = false` so the UI can dim them.
export async function fetchRiderLocations(
    supabase: AdminSupabaseClient,
    now = Date.now(),
): Promise<RiderLocation[]> {
    const { data: courierRows, error: courierError } = await supabase
        .from('courier_locations')
        .select(
            'rider_id, latitude, longitude, last_updated, is_online, rider:profiles!courier_locations_rider_id_fkey(full_name, phone_number, avatar_url)',
        )
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)

    if (courierError) throw courierError

    const rows = (courierRows || []) as CourierRow[]
    const riderIds = rows.map((r) => r.rider_id)

    const activeOrderByRider = new Map<string, RiderLocation['activeOrder']>()
    if (riderIds.length > 0) {
        const { data: orderRows, error: orderError } = await supabase
            .from('orders')
            .select(
                'rider_id, order_number, status, delivery_address, restaurant:restaurants!orders_restaurant_id_fkey(name)',
            )
            .in('rider_id', riderIds)
            .in('status', ACTIVE_ORDER_STATUSES as unknown as Database['public']['Tables']['orders']['Row']['status'][])

        if (orderError) throw orderError

        for (const order of orderRows || []) {
            if (!order.rider_id) continue
            if (activeOrderByRider.has(order.rider_id)) continue
            const restaurant = firstOrSelf(order.restaurant as { name: string | null } | { name: string | null }[] | null)
            activeOrderByRider.set(order.rider_id, {
                orderNumber: order.order_number ?? null,
                status: order.status ?? null,
                restaurantName: restaurant?.name ?? null,
                deliveryAddress: order.delivery_address ?? null,
            })
        }
    }

    return rows
        .filter((r) => r.latitude != null && r.longitude != null)
        .map((r) => {
            const profile = firstOrSelf(r.rider)
            const heartbeat = r.last_updated ? new Date(r.last_updated).getTime() : NaN
            const isFresh =
                r.is_online !== false &&
                !Number.isNaN(heartbeat) &&
                now - heartbeat <= RIDER_HEARTBEAT_WINDOW_MS
            return {
                riderId: r.rider_id,
                fullName: profile?.full_name ?? null,
                phoneNumber: profile?.phone_number ?? null,
                avatarUrl: profile?.avatar_url ?? null,
                latitude: r.latitude as number,
                longitude: r.longitude as number,
                lastUpdated: r.last_updated,
                isFresh,
                activeOrder: activeOrderByRider.get(r.rider_id) ?? null,
            }
        })
}
