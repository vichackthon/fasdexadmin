import { X, AlertTriangle } from 'lucide-react'
import { Button } from '../../../components/ui/button'

interface ConfirmRemoveModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    memberName: string
    loading?: boolean
}

export default function ConfirmRemoveModal({ isOpen, onClose, onConfirm, memberName, loading = false }: ConfirmRemoveModalProps) {
    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-50" onClick={!loading ? onClose : undefined} />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-[420px]">
                    <div className="flex items-center justify-between p-6 pb-0">
                        <div />
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                            disabled={loading}
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    <div className="p-6 pt-2 flex flex-col items-center text-center gap-4">
                        <div className="h-14 w-14 rounded-full bg-red-100 flex items-center justify-center">
                            <AlertTriangle className="h-7 w-7 text-red-500" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-1">Remove Admin</h2>
                            <p className="text-sm text-gray-500">
                                Are you sure you want to remove <span className="font-semibold text-gray-700">{memberName}</span>? They will lose access to the admin dashboard immediately.
                            </p>
                        </div>

                        <div className="flex items-center gap-4 w-full pt-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={onClose}
                                disabled={loading}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                                onClick={onConfirm}
                                disabled={loading}
                            >
                                {loading ? 'Removing...' : 'Yes, remove'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
