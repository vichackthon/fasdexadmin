import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { X, Bell, Ticket, Send, CheckSquare, Trash2 } from 'lucide-react'
import BroadcastModal from '../components/BroadcastModal'
import { format } from 'date-fns'
import { useNotifications } from '../../../hooks/useNotifications'
import { useSupportTickets } from '../../../hooks/useSupportTickets'

export default function SupportPage() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<'notification' | 'tickets'>('notification')
    const [broadcastModalOpen, setBroadcastModalOpen] = useState(false)

    const {
        notifications,
        unreadCount,
        isLoading: notificationsLoading,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAllNotifications,
    } = useNotifications()
    const { tickets, isLoading: ticketsLoading } = useSupportTickets()

    const isLoading = activeTab === 'notification' ? notificationsLoading : ticketsLoading

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Notifications & Support</h1>
                        <p className="text-gray-500 text-sm">Manage alerts and customer support tickets</p>
                    </div>
                    <Button
                        className="bg-[#FF6E15] hover:bg-[#FF6E15]/90 text-white w-full sm:w-auto flex items-center gap-2"
                        onClick={() => setBroadcastModalOpen(true)}
                    >
                        <Send className="h-4 w-4" />
                        Send Broadcast
                    </Button>
                </div>

                {/* Tabs */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="bg-gray-100/50 p-1.5 rounded-xl inline-flex w-full sm:w-auto border border-gray-200">
                        <button
                            onClick={() => setActiveTab('notification')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'notification'
                                ? 'bg-white text-[#FF6E15] shadow-md border border-orange-100'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Bell className="h-4 w-4" />
                            System Notifications
                        </button>
                        <button
                            onClick={() => setActiveTab('tickets')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === 'tickets'
                                ? 'bg-white text-[#FF6E15] shadow-md border border-orange-100'
                                : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <Ticket className="h-4 w-4" />
                            Support Tickets
                        </button>
                    </div>

                    {activeTab === 'notification' && notifications.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                            {unreadCount > 0 && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="text-[#FF6E15] border-orange-200 hover:bg-orange-50"
                                    onClick={() => void markAllAsRead()}
                                >
                                    <CheckSquare className="h-4 w-4" />
                                    Mark all read
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600"
                                onClick={() => void clearAllNotifications()}
                            >
                                <Trash2 className="h-4 w-4" />
                                Clear notifications
                            </Button>
                        </div>
                    )}
                </div>

                {/* Content */}
                <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="p-20 text-center">
                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-100 border-t-[#FF6E15] mx-auto mb-4" />
                                <p className="text-gray-500 font-medium">Fetching {activeTab} data...</p>
                            </div>
                        ) : activeTab === 'notification' ? (
                            notifications.length === 0 ? (
                                <div className="p-20 text-center bg-gray-50/30">
                                    <div className="bg-gray-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Bell className="h-8 w-8 text-gray-300" />
                                    </div>
                                    <h3 className="text-gray-900 font-bold text-lg mb-1">No System Notifications</h3>
                                    <p className="text-gray-500">You're all caught up! No recent system activity to report.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {notifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={`p-6 flex items-start gap-4 hover:bg-gray-50 transition-all group relative ${!notif.is_read ? 'bg-orange-50/20' : ''}`}
                                        >
                                            <div className={`mt-1 h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 ${!notif.is_read ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`}>
                                                <Bell className="h-5 w-5" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className={`font-bold ${!notif.is_read ? 'text-gray-900' : 'text-gray-600'}`}>{notif.title}</h4>
                                                    <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full border border-gray-100">
                                                        {format(new Date(notif.created_at), 'MMM dd, yyyy • HH:mm')}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-gray-500 leading-relaxed max-w-3xl">{notif.message}</p>
                                                {!notif.is_read && (
                                                    <button
                                                        onClick={() => void markAsRead(notif.id)}
                                                        className="mt-3 text-xs font-bold text-[#FF6E15] hover:underline flex items-center gap-1"
                                                    >
                                                        Mark as read
                                                    </button>
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => void clearNotification(notif.id)}
                                                className="text-gray-300 hover:text-red-500 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity p-2"
                                                aria-label={`Clear notification ${notif.title}`}
                                            >
                                                <X className="h-5 w-5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            tickets.length === 0 ? (
                                <div className="p-20 text-center bg-gray-50/30">
                                    <div className="bg-gray-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Ticket className="h-8 w-8 text-gray-300" />
                                    </div>
                                    <h3 className="text-gray-900 font-bold text-lg mb-1">No Active Tickets</h3>
                                    <p className="text-gray-500">Everything is running smoothly. No new support requests.</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-50">
                                    {tickets.map((ticket) => (
                                        <div key={ticket.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-all border-l-4 border-transparent hover:border-[#FF6E15]">
                                            <div className="flex gap-4 items-center">
                                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${ticket.status === 'open' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                                                    <Ticket className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-lg mb-0.5">{ticket.subject}</h3>
                                                    <div className="flex items-center gap-3 text-sm">
                                                        <span className="text-gray-500 font-medium">From: <span className="text-gray-900">{ticket.customer?.full_name || 'Anonymous'}</span></span>
                                                        <span className="text-gray-300">•</span>
                                                        <span className="text-gray-400">{format(new Date(ticket.created_at), 'dd MMM yyyy')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className={`px-4 py-1.5 text-xs font-bold rounded-full uppercase tracking-wider ${ticket.status === 'open'
                                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                                                    }`}>
                                                    {ticket.status}
                                                </span>
                                                <Button
                                                    className="bg-[#FF6E15] hover:bg-[#FF6E15]/90 text-white px-8 rounded-xl font-bold shadow-lg shadow-orange-200 transition-all hover:scale-105 active:scale-95"
                                                    onClick={() => navigate(`/support/${ticket.id}`)}
                                                >
                                                    View Details
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        )}
                    </CardContent>
                </Card>
            </div>

            <BroadcastModal
                isOpen={broadcastModalOpen}
                onClose={() => setBroadcastModalOpen(false)}
            />
        </MainLayout>
    )
}
