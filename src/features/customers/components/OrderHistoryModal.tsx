import { X } from 'lucide-react'

interface Order {
    id: string
    order_number?: string | null
    status: string
    total_amount: number | null
    created_at: string
    restaurant?: { name: string } | null
}

interface OrderHistoryModalProps {
    isOpen: boolean
    onClose: () => void
    onViewDetails: (orderId: string) => void
    customerName: string
    orders: Order[]
    loading?: boolean
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'delivered': return 'bg-green-100 text-green-700'
        case 'cancelled': return 'bg-red-100 text-red-700'
        case 'picked_up':
        case 'ready_for_pickup': return 'bg-orange-100 text-orange-700'
        case 'preparing':
        case 'confirmed': return 'bg-blue-100 text-blue-700'
        default: return 'bg-gray-100 text-gray-700'
    }
}

const formatStatus = (status: string) =>
    status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export default function OrderHistoryModal({
    isOpen,
    onClose,
    onViewDetails,
    customerName,
    orders,
    loading = false,
}: OrderHistoryModalProps) {
    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-[560px] max-h-[90vh] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100 flex-shrink-0">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Order History</h2>
                            <p className="text-sm text-gray-500">Showing all orders for {customerName}</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Content - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-3">
                        {loading ? (
                            <div className="text-center text-gray-500 py-8">Loading order history...</div>
                        ) : orders.length === 0 ? (
                            <div className="text-center text-gray-500 py-8">No orders found for this customer.</div>
                        ) : (
                            orders.map((order) => (
                                <div
                                    key={order.id}
                                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex flex-col gap-1">
                                        <span className="font-semibold text-gray-900 text-sm">
                                            #{order.order_number || order.id.slice(0, 8).toUpperCase()}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {(order.restaurant as any)?.name || 'Unknown restaurant'}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            {new Date(order.created_at).toLocaleDateString('en-GB')}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="font-semibold text-gray-900 text-sm">
                                            ₦{(order.total_amount || 0).toLocaleString()}
                                        </span>
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(order.status)}`}>
                                            {formatStatus(order.status)}
                                        </span>
                                        <button
                                            onClick={() => onViewDetails(order.id)}
                                            className="text-xs font-medium text-[#FF6E15] hover:underline"
                                        >
                                            View details
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </>
    )
}
