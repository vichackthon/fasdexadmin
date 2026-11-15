import { X, Send, Users, AlertCircle } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { useState } from 'react'
import { useBroadcast } from '../../../hooks/useBroadcast'

interface BroadcastModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function BroadcastModal({ isOpen, onClose }: BroadcastModalProps) {
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [targetRole, setTargetRole] = useState('All user')
    const { sendBroadcast, isLoading } = useBroadcast()

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) return

        try {
            const result = await sendBroadcast(title, message, targetRole)
            if (result.success) {
                alert(result.message || 'Broadcast sent successfully!')
                setTitle('')
                setMessage('')
                onClose()
            }
        } catch (err) {
            alert('Failed to send broadcast. Please try again.')
        }
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-all"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[550px] flex flex-col max-h-[90vh] pointer-events-auto overflow-hidden animate-in fade-in zoom-in duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between p-8 border-b border-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-2 rounded-xl">
                                <Send className="h-5 w-5 text-[#FF6E15]" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-gray-900 leading-tight">System Broadcast</h2>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Send alerts to your users</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="h-10 w-10 flex items-center justify-center hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-8 space-y-6 overflow-y-auto">
                        {/* Target Audience */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Users className="h-3 w-3" />
                                Target Audience
                            </label>
                            <select
                                value={targetRole}
                                onChange={(e) => setTargetRole(e.target.value)}
                                className="flex h-12 w-full items-center justify-between rounded-xl border-2 border-gray-100 bg-gray-50/50 px-4 py-2 text-sm font-bold text-gray-700 hover:border-[#FF6E15]/30 focus:border-[#FF6E15] focus:outline-none focus:ring-4 focus:ring-orange-100 transition-all appearance-none cursor-pointer"
                            >
                                <option>All user</option>
                                <option>Riders</option>
                                <option>Restaurants</option>
                                <option>Customers</option>
                            </select>
                        </div>

                        {/* Title */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <AlertCircle className="h-3 w-3" />
                                Notification Title
                            </label>
                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Important: System Maintenance..."
                                className="h-12 rounded-xl border-2 border-gray-100 bg-gray-50/50 px-4 font-bold text-gray-700 focus:bg-white transition-all shadow-inner"
                            />
                        </div>

                        {/* Message */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Detailed Message</label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                className="flex min-h-[140px] w-full rounded-2xl border-2 border-gray-100 bg-gray-50/50 px-4 py-4 text-sm font-medium text-gray-700 focus:bg-white focus:outline-none focus:ring-4 focus:ring-orange-100 focus:border-[#FF6E15] transition-all resize-none shadow-inner"
                                placeholder="Type your broadcast message clearly here..."
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-8 bg-gray-50/50 flex items-center gap-4 border-t border-gray-50">
                        <Button
                            variant="ghost"
                            className="flex-1 h-12 rounded-xl font-bold text-gray-500 hover:bg-white hover:text-gray-700 transition-all"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="flex-1 h-12 rounded-xl font-bold bg-[#FF6E15] hover:bg-[#FF6E15]/90 text-white shadow-lg shadow-orange-200 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
                            onClick={handleSend}
                            disabled={isLoading || !title.trim() || !message.trim()}
                        >
                            {isLoading ? 'Processing...' : 'Blast Notification'}
                        </Button>
                    </div>
                </div>
            </div>
        </>
    )
}
