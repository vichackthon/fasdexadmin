import { X, MapPin, User, Timer } from 'lucide-react'
import { Button } from '../../../components/ui/button'

interface Delivery {
    id: string
    /** Straight-line pickup → drop-off, e.g. "3.2 km", or 'N/A'. */
    distance: string
    date: string
    /** Accepted → delivered, already formatted. */
    riderTime: string
    riderTimeTone: string
    /** "12m to pickup · 19m on the road", or null without a pickup stamp. */
    breakdown: string | null
    pickup: {
        name: string
        address: string
    }
    destination: {
        name: string
        address: string
    }
    customerContact: string
    earnings: string
}

interface DeliveryHistoryModalProps {
    isOpen: boolean
    onClose: () => void
    riderName: string
    deliveries: Delivery[]
    loading?: boolean
}

export default function DeliveryHistoryModal({ isOpen, onClose, riderName, deliveries, loading = false }: DeliveryHistoryModalProps) {
    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-[560px] max-h-[90vh] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Delivery History</h2>
                            <p className="text-sm text-gray-500">All deliveries for {riderName}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {loading ? (
                            <div className="text-center text-gray-500 py-8">Loading delivery history...</div>
                        ) : deliveries.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">No completed deliveries found for this rider.</div>
                        ) : (
                            deliveries.map((delivery) => (
                                <div key={delivery.id} className="border border-gray-200 rounded-lg p-4">
                                    {/* Header Row */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-gray-900">#{delivery.id}</span>
                                            {delivery.distance !== 'N/A' && (
                                                <span className="text-sm text-gray-400" title="Straight-line distance; the road route is longer">
                                                    {delivery.distance}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="font-semibold text-[#FF6E15] text-sm">{delivery.earnings}</span>
                                            <span className="text-sm text-gray-500">{delivery.date}</span>
                                        </div>
                                    </div>

                                    {/* Delivery time */}
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-4 text-sm">
                                        <Timer className="h-4 w-4 text-gray-400" />
                                        <span className={`font-semibold ${delivery.riderTimeTone}`}>{delivery.riderTime}</span>
                                        <span className="text-gray-400">
                                            {delivery.breakdown ?? 'accepted → delivered'}
                                        </span>
                                    </div>

                                    {/* Details Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                                        {/* Pickup */}
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">Pickup from</p>
                                            <div className="flex items-start gap-2">
                                                <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <MapPin className="h-3 w-3 text-[#FF6E15]" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{delivery.pickup.name}</p>
                                                    <p className="text-gray-500 text-xs">{delivery.pickup.address}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Destination */}
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">Deliver to</p>
                                            <div className="flex items-start gap-2">
                                                <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <User className="h-3 w-3 text-gray-600" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{delivery.destination.name}</p>
                                                    <p className="text-gray-500 text-xs">{delivery.destination.address}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Customer Contact */}
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">Drop-off contact</p>
                                            <p className="font-medium text-gray-900">{delivery.customerContact}</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-gray-100 flex justify-end flex-shrink-0">
                        <Button variant="outline" size="default" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}
