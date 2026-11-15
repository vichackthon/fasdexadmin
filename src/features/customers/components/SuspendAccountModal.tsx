import { X } from 'lucide-react'
import { Button } from '../../../components/ui/button'

interface SuspendAccountModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    customerName: string
}

export default function SuspendAccountModal({
    isOpen,
    onClose,
    onConfirm,
    customerName
}: SuspendAccountModalProps) {
    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-[60]"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-[420px]">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-100">
                        <h2 className="text-xl font-bold text-gray-900">Suspend account</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to suspend {customerName}'s account? They will not be able to place orders until reactivated.
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={onClose}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-red-500 hover:bg-red-600"
                                onClick={onConfirm}
                            >
                                Suspend Account
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
