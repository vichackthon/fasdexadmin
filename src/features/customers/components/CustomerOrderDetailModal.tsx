import { X } from 'lucide-react'

interface OrderItem {
    name: string
    quantity: number
    price: string
}

interface CustomerOrderDetailModalProps {
    isOpen: boolean
    onClose: () => void
    order: {
        id: string
        status: 'Completed' | 'Active' | 'Cancelled'
        date: string
        items: OrderItem[]
        subtotal: string
        deliveryFee: string
        total: string
        restaurant: string
        deliveryAddress: string
        assignedRider: string
        paymentMethod: string
    } | null
}

export default function CustomerOrderDetailModal({ isOpen, onClose, order }: CustomerOrderDetailModalProps) {
    if (!isOpen || !order) return null

    const statusColors = {
        Completed: 'bg-green-100 text-green-700',
        Active: 'bg-orange-100 text-orange-700',
        Cancelled: 'bg-red-100 text-red-700',
    }

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
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[order.status]}`}>
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
                        {/* Order Detail Header */}
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Order Detail</h3>
                            <span className="text-sm text-gray-500">{order.date}</span>
                        </div>

                        {/* Items */}
                        <div>
                            <p className="text-sm font-medium text-gray-900 mb-3">Items</p>
                            <div className="space-y-2">
                                {order.items.map((item, i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <span className="text-sm text-gray-600">
                                            {item.name} x{item.quantity}
                                        </span>
                                        <span className="text-sm text-gray-900">{item.price}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="border-t border-gray-100 pt-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Sub total</span>
                                <span className="text-sm text-gray-900">{order.subtotal}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Delivery fee</span>
                                <span className="text-sm text-gray-900">{order.deliveryFee}</span>
                            </div>
                            <div className="flex items-center justify-between font-semibold">
                                <span className="text-sm text-gray-900">Total</span>
                                <span className="text-sm text-gray-900">{order.total}</span>
                            </div>
                        </div>

                        {/* Delivery Info */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Restaurant</p>
                                <p className="text-sm text-gray-900 font-medium">{order.restaurant}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Delivery Address</p>
                                <p className="text-sm text-gray-900 font-medium">{order.deliveryAddress}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Assigned Rider</p>
                                <p className="text-sm text-gray-900 font-medium">{order.assignedRider}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Payment method</p>
                                <p className="text-sm text-gray-900 font-medium">{order.paymentMethod}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
