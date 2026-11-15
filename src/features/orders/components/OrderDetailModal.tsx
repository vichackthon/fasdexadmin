import { X } from 'lucide-react'
import OrderInterventions, { type InterventionOrder } from './OrderInterventions'
import {
    deliveryTimeTone,
    formatDateTime,
    formatDuration,
    getOrderTimings,
    type OrderMilestones,
} from '../../../lib/orderTimings'

interface OrderDetailModalProps {
    isOpen: boolean
    onClose: () => void
    /**
     * Raw order identity for the intervention panel. The `order` prop below
     * is display-formatted (its `id` is the human order number), which is no
     * use for an RPC — this carries the real UUID and the raw status. Omit
     * it to render the modal read-only.
     */
    intervention?: InterventionOrder
    /** Called after an intervention writes, so the list can refetch. */
    onChanged?: () => void
    order: {
        id: string
        kind: 'food' | 'parcel'
        status: string
        date: string
        notes: string | null
        /** Sender/recipient detail; only set for parcel orders. */
        parcel: {
            description: string | null
            size: string | null
            pickupContactName: string | null
            pickupContactPhone: string | null
            recipientName: string | null
            recipientPhone: string | null
        } | null
        milestones: OrderMilestones
        items: Array<{
            name: string
            quantity: number
            price: string
        }>
        restaurant: string
        total: string
        customer: {
            name: string
            phone: string
            /** null hides the field — a parcel's address is the recipient's. */
            address: string | null
        }
        delivery: {
            pickup: string
            destination: string
        }
        rider: {
            name: string
            phone: string
        }
    } | null
}

export default function OrderDetailModal({
    isOpen,
    onClose,
    order,
    intervention,
    onChanged,
}: OrderDetailModalProps) {
    if (!isOpen || !order) return null

    const statusColors: Record<string, string> = {
        Delivered: 'bg-green-100 text-green-700',
        Cancelled: 'bg-red-100 text-red-700',
        Pending: 'bg-gray-100 text-gray-700',
        'Pending Acceptance': 'bg-yellow-100 text-yellow-700',
        Confirmed: 'bg-blue-100 text-blue-700',
        Preparing: 'bg-blue-100 text-blue-700',
        'Ready For Pickup': 'bg-orange-100 text-orange-700',
        'Out For Delivery': 'bg-orange-100 text-orange-700',
        'Picked Up': 'bg-orange-100 text-orange-700',
    }

    const isParcel = order.kind === 'parcel'
    const timings = getOrderTimings(order.milestones)

    // Each step shows how long it took from the one before. The first leg is
    // labelled so nobody reads kitchen time as a slow rider.
    const timeline: Array<{ label: string; at: string | null; leg: number | null; legLabel?: string }> = [
        { label: 'Order placed', at: order.milestones.created_at, leg: null },
        { label: 'Rider accepted', at: order.milestones.accepted_at, leg: timings.waitForRider, legLabel: isParcel ? 'finding a rider' : 'payment, kitchen and dispatch' },
        { label: 'Picked up', at: order.milestones.picked_up_at, leg: timings.toPickup, legLabel: 'to pickup' },
        { label: 'Delivered', at: order.milestones.delivered_at, leg: timings.onTheRoad, legLabel: 'on the road' },
    ]

    const contact = (name: string | null, phone: string | null) =>
        [name, phone].filter(Boolean).join(' · ') || '—'

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-900">{order.id}</h2>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status] || 'bg-gray-100 text-gray-700'}`}>
                                {order.status}
                            </span>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-6">
                        {/* Order Detail */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Order Detail</h3>
                                <span className="text-sm text-gray-500">{formatDateTime(order.milestones.created_at, order.date)}</span>
                            </div>
                            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                                <div className="md:col-span-2">
                                    <p className="text-gray-500 mb-1">{isParcel ? 'Package' : 'Items'}</p>
                                    {isParcel ? (
                                        <p className="text-gray-900 font-medium">
                                            {order.parcel?.description || 'Not described'}
                                            {order.parcel?.size && (
                                                <span className="ml-1.5 font-normal text-gray-500 capitalize">({order.parcel.size})</span>
                                            )}
                                        </p>
                                    ) : order.items.length === 0 ? (
                                        <p className="text-gray-900 font-medium">No items listed</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {order.items.map((item, index) => (
                                                <div key={`${item.name}-${index}`} className="flex items-start justify-between gap-3">
                                                    <p className="text-gray-900 font-medium">
                                                        {item.quantity}x {item.name}
                                                    </p>
                                                    <p className="text-gray-500 whitespace-nowrap">{item.price}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-1">{isParcel ? 'Service' : 'Restaurant'}</p>
                                    <p className="text-gray-900 font-medium">{order.restaurant}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-1">Total</p>
                                    <p className="text-gray-900 font-medium">{order.total}</p>
                                </div>
                                {order.notes && (
                                    <div className="md:col-span-3">
                                        <p className="text-gray-500 mb-1">{isParcel ? 'Instructions for the rider' : 'Special instructions'}</p>
                                        <p className="text-gray-900 font-medium whitespace-pre-line">{order.notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Customer Contact Details */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                {isParcel ? 'Sender (customer account)' : 'Customer contact details'}
                            </h3>
                            <div className={`grid gap-4 text-sm ${order.customer.address === null ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                <div>
                                    <p className="text-gray-500 mb-1">Name</p>
                                    <p className="text-gray-900 font-medium">{order.customer.name}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-1">Phone number</p>
                                    <p className="text-gray-900 font-medium">{order.customer.phone}</p>
                                </div>
                                {order.customer.address !== null && (
                                    <div>
                                        <p className="text-gray-500 mb-1">Address</p>
                                        <p className="text-gray-900 font-medium">{order.customer.address}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Parcel hand-off contacts. The rider calls these,
                            not the account holder, at each end. */}
                        {order.parcel && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Parcel contacts</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-500 mb-1">Hand over at pickup</p>
                                        <p className="text-gray-900 font-medium">
                                            {contact(order.parcel.pickupContactName, order.parcel.pickupContactPhone)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 mb-1">Recipient</p>
                                        <p className="text-gray-900 font-medium">
                                            {contact(order.parcel.recipientName, order.parcel.recipientPhone)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Delivery Details */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delivery details</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500 mb-1">Pickup address</p>
                                    <p className="text-gray-900 font-medium">{order.delivery.pickup}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-1">{isParcel ? 'Drop-off address' : 'Delivery Address'}</p>
                                    <p className="text-gray-900 font-medium">{order.delivery.destination}</p>
                                </div>
                            </div>
                        </div>

                        {/* Rider Details */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rider details</h3>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-500 mb-1">Assigned Rider</p>
                                    <p className="text-gray-900 font-medium">{order.rider.name}</p>
                                </div>
                                <div>
                                    <p className="text-gray-500 mb-1">Rider contact</p>
                                    <p className="text-gray-900 font-medium">{order.rider.phone}</p>
                                </div>
                            </div>
                        </div>

                        {/* Timeline */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
                            <ol className="space-y-3 text-sm">
                                {timeline.map((step) => (
                                    <li key={step.label} className="flex items-start gap-3">
                                        <span
                                            className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${step.at ? 'bg-[#FF6E15]' : 'bg-gray-200'}`}
                                        />
                                        <div className="flex-1 flex flex-wrap items-baseline justify-between gap-x-3">
                                            <p className={step.at ? 'text-gray-900 font-medium' : 'text-gray-400'}>{step.label}</p>
                                            <p className={step.at ? 'text-gray-600' : 'text-gray-400'}>{formatDateTime(step.at)}</p>
                                            {step.at && step.leg !== null && (
                                                <p className="basis-full text-xs text-gray-400">
                                                    +{formatDuration(step.leg)} {step.legLabel}
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ol>

                            {order.milestones.delivered_at && (
                                <div className="mt-4 grid grid-cols-2 gap-3">
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <p className={`text-lg font-bold ${deliveryTimeTone(timings.riderTime)}`}>
                                            {formatDuration(timings.riderTime)}
                                        </p>
                                        <p className="text-xs text-gray-500">Rider time (accepted → delivered)</p>
                                    </div>
                                    <div className="bg-gray-50 rounded-lg p-3">
                                        <p className="text-lg font-bold text-gray-900">{formatDuration(timings.total)}</p>
                                        <p className="text-xs text-gray-500">Order total (placed → delivered)</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {intervention && (
                            <OrderInterventions
                                order={intervention}
                                onChanged={onChanged ?? (() => {})}
                            />
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
