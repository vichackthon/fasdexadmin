import { X } from 'lucide-react'
import { Button } from '../../../components/ui/button'

interface CustomerProfileModalProps {
    isOpen: boolean
    onClose: () => void
    onViewHistory: () => void
    onSuspend: () => void
    customer: {
        id: string
        name: string
        avatar: string
        joinedDate: string
        isVerified: boolean
        email: string
        phone: string
        address: string
        totalOrders: number
        totalSpent: number
    } | null
}

export default function CustomerProfileModal({
    isOpen,
    onClose,
    onViewHistory,
    onSuspend,
    customer
}: CustomerProfileModalProps) {
    if (!isOpen || !customer) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-gray-900">Customer Profile</h2>
                            {customer.isVerified && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                    Verified
                                </span>
                            )}
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
                        {/* Profile Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="h-14 w-14 rounded-full overflow-hidden bg-gray-200">
                                    <img
                                        src={customer.avatar}
                                        alt={customer.name}
                                        className="h-full w-full object-cover"
                                    />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
                                    <p className="text-sm text-gray-500">Joined {customer.joinedDate}</p>
                                </div>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-gray-700 border-gray-200"
                                onClick={onSuspend}
                            >
                                Suspend account
                            </Button>
                        </div>

                        {/* Contact Info */}
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Email address</p>
                                <p className="text-sm text-gray-900 font-medium break-all">{customer.email}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Phone number</p>
                                <p className="text-sm text-gray-900 font-medium">{customer.phone}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 mb-1">Address</p>
                                <p className="text-sm text-gray-900 font-medium">{customer.address}</p>
                            </div>
                        </div>

                        {/* Stats Cards - 2 columns for customer */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-gray-50 rounded-lg p-4 text-center">
                                <p className="text-2xl font-bold text-gray-900">{customer.totalOrders}</p>
                                <p className="text-sm text-gray-500">Total order</p>
                            </div>
                            <div className="bg-gray-50 rounded-lg p-4 text-center">
                                <p className="text-2xl font-bold text-gray-900">{customer.totalSpent.toLocaleString()}</p>
                                <p className="text-sm text-gray-500">Total spent (naira)</p>
                            </div>
                        </div>

                        {/* View History Button */}
                        <Button
                            className="w-full"
                            onClick={onViewHistory}
                        >
                            See order History
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}
