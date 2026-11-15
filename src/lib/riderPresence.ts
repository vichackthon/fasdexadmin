export const RIDER_HEARTBEAT_WINDOW_MS = 2 * 60 * 1000

type HeartbeatRow = {
    is_online?: boolean | null
    last_updated?: string | null
}

type HeartbeatValue = HeartbeatRow | HeartbeatRow[] | null | undefined

function getHeartbeatRow(value: HeartbeatValue): HeartbeatRow | null {
    if (!value) return null
    if (Array.isArray(value)) return value[0] ?? null
    return value
}

export function isRiderActuallyOnline(
    profileIsOnline: boolean | null | undefined,
    heartbeat: HeartbeatValue,
    now = Date.now(),
): boolean {
    if (!profileIsOnline) return false

    const heartbeatRow = getHeartbeatRow(heartbeat)
    if (!heartbeatRow?.last_updated) return false
    if (heartbeatRow.is_online === false) return false

    const heartbeatTime = new Date(heartbeatRow.last_updated).getTime()
    if (Number.isNaN(heartbeatTime)) return false

    return now - heartbeatTime <= RIDER_HEARTBEAT_WINDOW_MS
}
