import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { emptyDeliverySpeed, summariseDeliverySpeed, type RiderDeliverySpeed } from './orderTimings'

type AdminSupabaseClient = SupabaseClient<Database>

type RiderProfileRow = Pick<
    Database['public']['Tables']['profiles']['Row'],
    'id' | 'full_name' | 'email' | 'phone_number' | 'address' | 'avatar_url' | 'role' | 'is_online' | 'is_available' | 'created_at' | 'rider_rating' | 'rider_total_ratings'
>

type RiderVerificationRow = {
    rider_id: string
    status: string | null
    submitted_at: string | null
    rider: RiderProfileRow | null
}

type CourierLocationRow = {
    rider_id: string
    last_updated: string | null
    is_online: boolean | null
}

type RiderOrderRow = {
    rider_id: string | null
    status: string | null
    accepted_at: string | null
    picked_up_at: string | null
    delivered_at: string | null
}

export type AdminRiderRecord = RiderProfileRow & {
    courier_location: Array<{
        last_updated: string | null
        is_online: boolean | null
    }>
    verification_status: string | null
    verification_submitted_at: string | null
    order_count: number
    delivered_count: number
    delivery_speed: RiderDeliverySpeed
}

const riderProfileSelect = 'id, full_name, email, phone_number, address, avatar_url, role, is_online, is_available, created_at, rider_rating, rider_total_ratings'

function toTimestamp(value: string | null | undefined) {
    if (!value) return 0
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
}

function createEmptyRider(id: string): AdminRiderRecord {
    return {
        id,
        full_name: null,
        email: null,
        phone_number: null,
        address: null,
        avatar_url: null,
        role: 'customer',
        is_online: false,
        is_available: false,
        created_at: new Date(0).toISOString(),
        rider_rating: null,
        rider_total_ratings: 0,
        courier_location: [],
        verification_status: null,
        verification_submitted_at: null,
        order_count: 0,
        delivered_count: 0,
        delivery_speed: emptyDeliverySpeed(),
    }
}

function mergeProfile(existing: AdminRiderRecord | undefined, profile: Partial<RiderProfileRow> & { id: string }) {
    const base = existing ?? createEmptyRider(profile.id)

    return {
        ...base,
        id: profile.id,
        full_name: profile.full_name ?? base.full_name,
        email: profile.email ?? base.email,
        phone_number: profile.phone_number ?? base.phone_number,
        address: profile.address ?? base.address,
        avatar_url: profile.avatar_url ?? base.avatar_url,
        role: profile.role ?? base.role,
        is_online: profile.is_online ?? base.is_online,
        is_available: profile.is_available ?? base.is_available,
        created_at: profile.created_at ?? base.created_at,
        rider_rating: profile.rider_rating ?? base.rider_rating,
        rider_total_ratings: profile.rider_total_ratings ?? base.rider_total_ratings,
    }
}

export async function fetchAdminRiderRecords(supabase: AdminSupabaseClient): Promise<AdminRiderRecord[]> {
    const [{ data: profileRows, error: profilesError }, { data: verificationRows, error: verificationsError }] = await Promise.all([
        supabase
            .from('profiles')
            .select(riderProfileSelect)
            .eq('role', 'rider')
            .order('created_at', { ascending: false }),
        supabase
            .from('rider_verifications')
            .select(`
                rider_id,
                status,
                submitted_at,
                rider:profiles!rider_verifications_rider_id_fkey(${riderProfileSelect})
            `)
            .order('submitted_at', { ascending: false })
    ])

    if (profilesError) throw profilesError
    if (verificationsError) throw verificationsError

    const ridersById = new Map<string, AdminRiderRecord>()

    for (const profile of (profileRows || []) as RiderProfileRow[]) {
        ridersById.set(profile.id, mergeProfile(ridersById.get(profile.id), profile))
    }

    for (const verification of (verificationRows || []) as RiderVerificationRow[]) {
        const riderId = verification.rider_id
        if (!riderId) continue

        const merged = mergeProfile(
            ridersById.get(riderId),
            verification.rider ?? { id: riderId }
        )

        const shouldReplaceVerification =
            !merged.verification_submitted_at ||
            toTimestamp(verification.submitted_at) >= toTimestamp(merged.verification_submitted_at)

        ridersById.set(riderId, {
            ...merged,
            verification_status: shouldReplaceVerification
                ? verification.status ?? merged.verification_status
                : merged.verification_status,
            verification_submitted_at: shouldReplaceVerification
                ? verification.submitted_at ?? merged.verification_submitted_at
                : merged.verification_submitted_at,
        })
    }

    const riderIds = Array.from(ridersById.keys())
    if (riderIds.length === 0) return []

    const [{ data: courierRows, error: courierError }, { data: orderRows, error: orderError }] = await Promise.all([
        supabase
            .from('courier_locations')
            .select('rider_id, last_updated, is_online')
            .in('rider_id', riderIds),
        supabase
            .from('orders')
            .select('rider_id, status, accepted_at, picked_up_at, delivered_at')
            .in('rider_id', riderIds)
    ])

    if (courierError) throw courierError
    if (orderError) throw orderError

    for (const row of (courierRows || []) as CourierLocationRow[]) {
        if (!row.rider_id) continue
        const rider = ridersById.get(row.rider_id)
        if (!rider) continue
        rider.courier_location.push({
            last_updated: row.last_updated,
            is_online: row.is_online,
        })
    }

    const deliveredByRider = new Map<string, RiderOrderRow[]>()

    for (const row of (orderRows || []) as RiderOrderRow[]) {
        if (!row.rider_id) continue
        const rider = ridersById.get(row.rider_id)
        if (!rider) continue
        rider.order_count += 1
        if (row.status === 'delivered') {
            rider.delivered_count += 1
            const delivered = deliveredByRider.get(row.rider_id) ?? []
            delivered.push(row)
            deliveredByRider.set(row.rider_id, delivered)
        }
    }

    for (const [riderId, delivered] of deliveredByRider) {
        const rider = ridersById.get(riderId)
        if (rider) rider.delivery_speed = summariseDeliverySpeed(delivered)
    }

    return Array.from(ridersById.values()).sort(
        (a, b) => toTimestamp(b.created_at) - toTimestamp(a.created_at)
    )
}
