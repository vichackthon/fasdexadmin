/**
 * Delivery-leg timings, shared by the Orders and Riders pages.
 *
 * A rider is measured from accepted_at, never created_at: before a rider
 * accepts, the clock is running on payment, the vendor and dispatch, none of
 * which the rider controls. created_at only feeds the customer-facing total.
 *
 * Milestones written before 20260925160000_order_milestone_server_clock.sql
 * came from the rider's phone clock and can sit an hour late relative to
 * created_at. Rider legs (accept → pickup → delivered) share that error and
 * stay correct; totals on old rows may read long.
 */

export type OrderMilestones = {
    created_at: string
    accepted_at: string | null
    picked_up_at: string | null
    delivered_at: string | null
}

export type OrderTimings = {
    /** created → accepted: payment, kitchen and dispatch. Not the rider. */
    waitForRider: number | null
    /** accepted → picked up: riding to the pickup and collecting. */
    toPickup: number | null
    /** picked up → delivered: the drop-off ride. */
    onTheRoad: number | null
    /** accepted → delivered: everything the rider is accountable for. */
    riderTime: number | null
    /** created → delivered: what the customer experienced. */
    total: number | null
}

export type RiderDeliverySpeed = {
    /** Delivered orders with both accepted_at and delivered_at. */
    timedDeliveries: number
    avgRiderMinutes: number | null
    avgToPickupMinutes: number | null
    avgOnTheRoadMinutes: number | null
    fastestMinutes: number | null
    slowestMinutes: number | null
}

/**
 * Riders need this many timed deliveries before their average is coloured
 * or ranked as meaningful — same idea as the rating column, where one bad
 * trip shouldn't brand a new rider.
 */
export const MIN_TIMED_DELIVERIES = 3

/** Minutes, accepted → delivered. Tune here, not at call sites. */
const FAST_DELIVERY_MINUTES = 30
const OK_DELIVERY_MINUTES = 45
const SLOW_DELIVERY_MINUTES = 60

export function minutesBetween(from: string | null | undefined, to: string | null | undefined): number | null {
    if (!from || !to) return null
    const start = Date.parse(from)
    const end = Date.parse(to)
    if (Number.isNaN(start) || Number.isNaN(end)) return null
    const minutes = (end - start) / 60000
    // Negative only happens when one side was phone-stamped and the other
    // server-stamped across the clock fix. It is not a duration.
    return minutes < 0 ? null : minutes
}

export function getOrderTimings(order: OrderMilestones): OrderTimings {
    return {
        waitForRider: minutesBetween(order.created_at, order.accepted_at),
        toPickup: minutesBetween(order.accepted_at, order.picked_up_at),
        onTheRoad: minutesBetween(order.picked_up_at, order.delivered_at),
        riderTime: minutesBetween(order.accepted_at, order.delivered_at),
        total: minutesBetween(order.created_at, order.delivered_at),
    }
}

function average(values: number[]): number | null {
    if (values.length === 0) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function summariseDeliverySpeed(orders: Array<Omit<OrderMilestones, 'created_at'>>): RiderDeliverySpeed {
    const riderTimes: number[] = []
    const toPickup: number[] = []
    const onTheRoad: number[] = []

    for (const order of orders) {
        const riderTime = minutesBetween(order.accepted_at, order.delivered_at)
        if (riderTime === null) continue
        riderTimes.push(riderTime)

        // Legs only count when both ends exist — a delivery with no pickup
        // stamp still counts toward the rider total, just not the split.
        const pickupLeg = minutesBetween(order.accepted_at, order.picked_up_at)
        const roadLeg = minutesBetween(order.picked_up_at, order.delivered_at)
        if (pickupLeg !== null && roadLeg !== null) {
            toPickup.push(pickupLeg)
            onTheRoad.push(roadLeg)
        }
    }

    return {
        timedDeliveries: riderTimes.length,
        avgRiderMinutes: average(riderTimes),
        avgToPickupMinutes: average(toPickup),
        avgOnTheRoadMinutes: average(onTheRoad),
        fastestMinutes: riderTimes.length ? Math.min(...riderTimes) : null,
        slowestMinutes: riderTimes.length ? Math.max(...riderTimes) : null,
    }
}

export function emptyDeliverySpeed(): RiderDeliverySpeed {
    return summariseDeliverySpeed([])
}

export function formatDuration(minutes: number | null, fallback = '—'): string {
    if (minutes === null) return fallback
    const rounded = Math.round(minutes)
    if (rounded < 1) return '<1m'
    if (rounded < 60) return `${rounded}m`
    const hours = Math.floor(rounded / 60)
    const rest = rounded % 60
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** Tailwind text colour for a rider-time figure. */
export function deliveryTimeTone(minutes: number | null): string {
    if (minutes === null) return 'text-gray-400'
    if (minutes <= FAST_DELIVERY_MINUTES) return 'text-green-600'
    if (minutes <= OK_DELIVERY_MINUTES) return 'text-gray-900'
    if (minutes <= SLOW_DELIVERY_MINUTES) return 'text-orange-600'
    return 'text-red-600'
}

/** "25 Sep 2026, 14:32" in the admin's local time. */
export function formatDateTime(value: string | null | undefined, fallback = '—'): string {
    if (!value) return fallback
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return fallback
    return date.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

/** "14:32" in the admin's local time. */
export function formatTime(value: string | null | undefined, fallback = '—'): string {
    if (!value) return fallback
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return fallback
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Straight-line km between two points. Road distance is longer; this is for
 * telling a 1 km hop from a 9 km cross-town run when judging a rider's time.
 */
export function straightLineKm(
    fromLat: number | null | undefined,
    fromLng: number | null | undefined,
    toLat: number | null | undefined,
    toLng: number | null | undefined,
): number | null {
    if (fromLat == null || fromLng == null || toLat == null || toLng == null) return null
    const toRad = (deg: number) => (deg * Math.PI) / 180
    const dLat = toRad(toLat - fromLat)
    const dLng = toRad(toLng - fromLng)
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
