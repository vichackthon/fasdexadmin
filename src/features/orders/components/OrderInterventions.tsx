import { useState } from 'react'
import { isAwaitingParcelAssignment } from '../../../lib/parcelAssignment'
import { AlertTriangle, Loader2, UserMinus, UserPlus, XCircle } from 'lucide-react'
import { useAdminCapabilities } from '../../../hooks/useAdminCapabilities'
import {
    assignRider,
    cancelOrder,
    fetchAssignableRiders,
    formatDistance,
    formatElapsed,
    releaseRider,
    type AssignableRider,
} from '../../../lib/orderInterventions'

/**
 * The intervention panel for a live order.
 *
 * Which verbs are offered is decided by where the food is, not by how
 * late the order is:
 *
 *   out_for_delivery  the rider accepted but has not collected the food
 *                     (this status is set at accept time — see
 *                     rider_repository.acceptOffer). Nothing is in
 *                     transit, so release and reassign are both safe.
 *
 *   picked_up         the rider is carrying the customer's meal. A second
 *                     rider cannot deliver food they do not have, so the
 *                     only honest options are chasing them by phone or
 *                     cancelling. The RPCs refuse a reassign here too —
 *                     this is the UI agreeing with the database rather
 *                     than the only thing standing in the way.
 */

type Stage = 'awaiting_pickup' | 'in_transit' | 'inactive'

// Matches sweep_stalled_deliveries(): warn at 20m before pickup, 45m in
// transit. Kept in sync by hand — when a settings table lands, both
// should read it.
const WARN_AFTER_MINUTES: Record<Exclude<Stage, 'inactive'>, number> = {
    awaiting_pickup: 20,
    in_transit: 45,
}

export interface InterventionOrder {
    id: string
    label: string
    status: string
    riderId: string | null
    riderName: string | null
    riderPhone: string | null
    acceptedAt: string | null
    pickedUpAt: string | null
    paymentStatus: string | null
    deliveryKind: string
}

interface Props {
    order: InterventionOrder
    /** Refetch the orders list once a write lands. */
    onChanged: () => void
}

export default function OrderInterventions({ order, onChanged }: Props) {
    const { can, isUnassigned, isLoading: capsLoading } = useAdminCapabilities()

    const [busy, setBusy] = useState<null | 'release' | 'assign' | 'cancel'>(null)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const [showCancel, setShowCancel] = useState(false)
    const [cancelReason, setCancelReason] = useState('')

    const [showPicker, setShowPicker] = useState(false)
    const [riders, setRiders] = useState<AssignableRider[] | null>(null)
    const [ridersLoading, setRidersLoading] = useState(false)

    const stage: Stage =
        order.status === 'out_for_delivery'
            ? 'awaiting_pickup'
            : order.status === 'picked_up'
                ? 'in_transit'
                : 'inactive'

    // An order nobody can still be waiting on has nothing to intervene in.
    if (['delivered', 'cancelled'].includes(order.status)) return null
    if (capsLoading) return null

    const awaitingAssignment = isAwaitingParcelAssignment({
        delivery_kind: order.deliveryKind,
        status: order.status,
        payment_status: order.paymentStatus,
        rider_id: order.riderId,
    })
    const canReassign = can('orders.reassign_rider')
    const canCancel = can('orders.cancel')
    if (!canReassign && !canCancel && !isUnassigned) return null

    const since = stage === 'in_transit' ? order.pickedUpAt : order.acceptedAt
    const minutesElapsed = since
        ? Math.floor((Date.now() - new Date(since).getTime()) / 60000)
        : null
    const isStalled =
        stage !== 'inactive' &&
        minutesElapsed !== null &&
        minutesElapsed >= WARN_AFTER_MINUTES[stage]

    const run = async (
        kind: 'release' | 'assign' | 'cancel',
        action: () => Promise<{ message: string; refundOwed?: boolean }>,
    ) => {
        setBusy(kind)
        setError(null)
        setNotice(null)
        try {
            const result = await action()
            setNotice(result.message)
            setShowCancel(false)
            setShowPicker(false)
            setCancelReason('')
            onChanged()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong.')
        } finally {
            setBusy(null)
        }
    }

    const openPicker = async () => {
        setShowPicker(true)
        setError(null)
        if (riders) return
        setRidersLoading(true)
        try {
            setRiders(await fetchAssignableRiders(order.id))
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not load riders.')
        } finally {
            setRidersLoading(false)
        }
    }

    return (
        <div className="border-t border-gray-100 pt-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{awaitingAssignment ? 'Assign parcel rider' : 'Intervene'}</h3>
                {stage !== 'inactive' && (
                    <span className="text-sm text-gray-500">
                        {stage === 'in_transit' ? 'In transit for' : 'Assigned for'}{' '}
                        <span className={isStalled ? 'font-semibold text-red-600' : 'font-medium text-gray-900'}>
                            {formatElapsed(since)}
                        </span>
                    </span>
                )}
            </div>

            {awaitingAssignment && (
                <p className="mb-4 rounded-lg bg-orange-50 p-3 text-sm text-orange-900">
                    This paid parcel request is waiting for you to assign a rider.
                </p>
            )}

            {isStalled && (
                <div className="mb-4 flex gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                    <AlertTriangle className="h-5 w-5 flex-shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-900">
                        {stage === 'awaiting_pickup'
                            ? (order.deliveryKind === 'parcel'
                                ? 'This rider has not collected the parcel. After 40 minutes it returns to admin assignment. You can release it or assign another rider now.'
                                : 'This rider has not collected the food. It is released to the pool automatically at 40 minutes — release it now if you have already given up on them.')
                            : 'This delivery is overdue and the rider has the food. It cannot be reassigned: call the rider, or cancel the order.'}
                    </p>
                </div>
            )}

            {isUnassigned && (
                <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-600">
                    Your account is not on the admin roster yet, so these actions are
                    disabled. Ask a super admin to assign your tier.
                </div>
            )}

            {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {notice && (
                <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-800">
                    {notice}
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                {canReassign && stage === 'awaiting_pickup' && order.riderId && (
                    <button
                        onClick={() =>
                            run('release', () => releaseRider(order.id, 'Released from the dashboard'))
                        }
                        disabled={busy !== null}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                    >
                        {busy === 'release'
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <UserMinus className="h-4 w-4" />}
                        Release rider
                    </button>
                )}

                {canReassign && (stage === 'awaiting_pickup' || awaitingAssignment) && (
                    <button
                        onClick={openPicker}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-50"
                    >
                        <UserPlus className="h-4 w-4" />
                        Assign a rider
                    </button>
                )}

                {canCancel && (
                    <button
                        onClick={() => { setShowCancel(true); setError(null) }}
                        disabled={busy !== null}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                        <XCircle className="h-4 w-4" />
                        Cancel order
                    </button>
                )}
            </div>

            {/* Rider picker. Offline riders are listed too — an operator is
                usually already on the phone with the person they want. */}
            {showPicker && (
                <div className="mt-4 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
                        <p className="text-sm font-medium text-gray-900">Nearest riders</p>
                        <button
                            onClick={() => setShowPicker(false)}
                            className="text-xs text-gray-500 hover:text-gray-700"
                        >
                            Close
                        </button>
                    </div>

                    {ridersLoading && (
                        <p className="px-4 py-6 text-center text-sm text-gray-500">Loading riders…</p>
                    )}

                    {!ridersLoading && riders?.length === 0 && (
                        <p className="px-4 py-6 text-center text-sm text-gray-500">
                            No riders on the platform yet.
                        </p>
                    )}

                    {!ridersLoading && riders && riders.length > 0 && (
                        <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
                            {riders.map((rider) => (
                                <li
                                    key={rider.rider_id}
                                    className="flex items-center justify-between gap-3 px-4 py-3"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-gray-900">
                                            {rider.full_name || 'Unnamed rider'}
                                            {rider.rider_id === order.riderId && (
                                                <span className="ml-2 text-xs text-gray-400">(current)</span>
                                            )}
                                        </p>
                                        <p className="mt-0.5 text-xs text-gray-500">
                                            {rider.is_online ? 'Online' : 'Offline'}
                                            {' · '}
                                            {formatDistance(rider.distance_m)} away
                                            {rider.active_deliveries > 0 &&
                                                ` · ${rider.active_deliveries} active`}
                                            {rider.phone_number ? ` · ${rider.phone_number}` : ''}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() =>
                                            run('assign', () =>
                                                assignRider(order.id, rider.rider_id, 'Assigned from the dashboard'),
                                            )
                                        }
                                        disabled={busy !== null || rider.rider_id === order.riderId}
                                        className="flex-shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-40"
                                    >
                                        {busy === 'assign' ? 'Assigning…' : 'Assign'}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {/* Cancel. The reason is mandatory in the RPC — it is quoted
                verbatim to the customer and stored in admin_audit_log. */}
            {showCancel && (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50/40 p-4">
                    <p className="text-sm font-medium text-gray-900">
                        Cancel order {order.label}?
                    </p>
                    <p className="mt-1 text-xs text-gray-600">
                        The customer and the restaurant are both told, and this reason is
                        shown to the customer word for word.
                        {order.paymentStatus === 'paid' && (
                            <>
                                {' '}
                                <span className="font-semibold text-red-700">
                                    This order is paid. Cancelling does not refund it — you must
                                    issue the Paystack refund by hand.
                                </span>
                            </>
                        )}
                    </p>
                    <textarea
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        rows={2}
                        placeholder="e.g. Rider unreachable for 90 minutes; customer asked to cancel."
                        className="mt-3 w-full rounded-lg border border-gray-200 p-2.5 text-sm focus:border-primary focus:outline-none"
                    />
                    <div className="mt-3 flex justify-end gap-3">
                        <button
                            onClick={() => { setShowCancel(false); setCancelReason('') }}
                            disabled={busy !== null}
                            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            Keep order
                        </button>
                        <button
                            onClick={() => run('cancel', () => cancelOrder(order.id, cancelReason))}
                            disabled={busy !== null || cancelReason.trim().length < 5}
                            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                        >
                            {busy === 'cancel' && <Loader2 className="h-4 w-4 animate-spin" />}
                            Cancel order
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
