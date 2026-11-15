import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send, CheckCircle2, Clock, Mail, Calendar, Hash } from 'lucide-react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { useState, useRef, useEffect } from 'react'
import { useTicketDetail } from '../../../hooks/useTicketDetail'
import { format } from 'date-fns'

export default function TicketDetailPage() {
    const navigate = useNavigate()
    const { id } = useParams()
    const { ticket, messages, isLoading, updateStatus, sendMessage } = useTicketDetail(id)
    const [reply, setReply] = useState('')
    const [isSending, setIsSending] = useState(false)
    const messagesEndRef = useRef<HTMLDivElement>(null)

    const isResolved = ticket?.status === 'resolved' || ticket?.status === 'closed'

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = async () => {
        if (!reply.trim()) return
        setIsSending(true)
        try {
            await sendMessage(reply.trim())
            setReply('')
        } catch (err) {
            console.error(err)
            alert('Failed to send message')
        } finally {
            setIsSending(false)
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    if (isLoading) {
        return (
            <MainLayout>
                <div className="flex h-[60vh] items-center justify-center">
                    <div className="text-center">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-100 border-t-[#FF6E15] mx-auto mb-4" />
                        <p className="text-gray-500 font-medium tracking-wide">Loading ticket details...</p>
                    </div>
                </div>
            </MainLayout>
        )
    }

    if (!ticket) {
        return (
            <MainLayout>
                <div className="p-10 text-center">
                    <h2 className="text-xl font-bold text-gray-900">Ticket not found</h2>
                    <Button onClick={() => navigate('/support')} className="mt-4">Back to Support</Button>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/support')}
                            className="h-10 w-10 flex items-center justify-center hover:bg-gray-100 rounded-xl transition-all"
                        >
                            <ArrowLeft className="h-6 w-6 text-gray-600" />
                        </button>
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-2xl font-black text-gray-900">Ticket Details</h1>
                                <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest border ${ticket.status === 'open' ? 'bg-green-50 text-green-600 border-green-200' :
                                    ticket.status === 'in_progress' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                        ticket.status === 'resolved' ? 'bg-purple-50 text-purple-600 border-purple-200' :
                                            'bg-gray-50 text-gray-600 border-gray-200'
                                    }`}>
                                    {ticket.status.replace('_', ' ')}
                                </span>
                            </div>
                            <p className="text-gray-500 text-sm font-medium">Ticket ID: {ticket.id.slice(0, 8)}...</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Chat Area */}
                    <div className="lg:col-span-2 space-y-4">
                        {/* Subject */}
                        <Card className="border-none shadow-xl rounded-2xl bg-white">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Subject</p>
                                        <h2 className="text-lg font-bold text-gray-900">{ticket.subject}</h2>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Opened</p>
                                        <p className="text-sm font-bold text-gray-900">{format(new Date(ticket.created_at), 'MMM dd, yyyy')}</p>
                                    </div>
                                </div>
                                {ticket.related_order_id && (
                                    <div className="flex items-center gap-3 bg-orange-50/50 p-3 rounded-xl border border-orange-100 mt-4">
                                        <Hash className="h-4 w-4 text-[#FF6E15]" />
                                        <span className="text-sm font-bold text-gray-700">Related Order:</span>
                                        <span className="text-sm font-black text-[#FF6E15]">#{ticket.related_order_id.slice(0, 8)}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Chat Thread */}
                        <Card className="border-none shadow-xl rounded-2xl bg-white overflow-hidden">
                            <CardContent className="p-0 flex flex-col" style={{ height: '520px' }}>
                                {/* Messages scroll area */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                    {/* Original customer message */}
                                    <div className="flex justify-start">
                                        <div className="max-w-[75%]">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                                {ticket.user?.full_name || 'Customer'}
                                            </p>
                                            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                                                <p className="text-gray-800 text-sm leading-relaxed">{ticket.message}</p>
                                            </div>
                                            <p className="text-[10px] text-gray-400 mt-1">
                                                {format(new Date(ticket.created_at), 'MMM d, h:mm a')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Thread messages */}
                                    {messages.map((msg) => {
                                        const isAdmin = msg.sender_type === 'admin'
                                        return (
                                            <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                                                <div className="max-w-[75%]">
                                                    {!isAdmin && (
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">
                                                            {ticket.user?.full_name || 'Customer'}
                                                        </p>
                                                    )}
                                                    <div className={`rounded-2xl px-4 py-3 ${isAdmin
                                                        ? 'bg-[#FF6E15] text-white rounded-tr-sm'
                                                        : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                                                        }`}>
                                                        <p className="text-sm leading-relaxed">{msg.message}</p>
                                                    </div>
                                                    <p className={`text-[10px] text-gray-400 mt-1 ${isAdmin ? 'text-right' : ''}`}>
                                                        {isAdmin ? 'Support · ' : ''}{format(new Date(msg.created_at), 'MMM d, h:mm a')}
                                                    </p>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {messages.length === 0 && (
                                        <div className="flex items-center justify-center h-32">
                                            <div className="text-center">
                                                <Clock className="h-8 w-8 text-gray-200 mx-auto mb-2" />
                                                <p className="text-sm text-gray-400 font-medium">No replies yet. Start the conversation.</p>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Reply input */}
                                {isResolved ? (
                                    <div className="border-t border-gray-100 px-6 py-4 bg-gray-50">
                                        <div className="flex items-center gap-2 text-gray-400">
                                            <CheckCircle2 className="h-4 w-4 text-purple-400" />
                                            <p className="text-sm font-medium">This ticket is resolved. Reopen it to reply.</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border-t border-gray-100 px-4 py-4 flex items-end gap-3 bg-white">
                                        <textarea
                                            value={reply}
                                            onChange={(e) => setReply(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            rows={2}
                                            className="flex-1 p-3 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-100 focus:border-[#FF6E15] transition-all resize-none"
                                            placeholder="Reply to customer... (Enter to send, Shift+Enter for new line)"
                                        />
                                        <Button
                                            onClick={handleSend}
                                            disabled={isSending || !reply.trim()}
                                            className="bg-[#FF6E15] hover:bg-[#FF6E15]/90 text-white h-10 w-10 p-0 rounded-xl flex items-center justify-center shadow-lg shadow-orange-100 flex-shrink-0"
                                        >
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-8">
                        {/* User Profile */}
                        <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                            <CardContent className="p-8">
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-8">Requester Info</h3>

                                <div className="flex flex-col items-center mb-8">
                                    <div className="h-24 w-24 rounded-3xl overflow-hidden border-4 border-gray-50 shadow-lg mb-4 bg-gray-100">
                                        <img
                                            src={ticket.user?.avatar_url || `https://ui-avatars.com/api/?name=${ticket.user?.full_name || 'User'}&background=FF6E15&color=fff`}
                                            alt="User"
                                            className="h-full w-full object-cover"
                                        />
                                    </div>
                                    <h4 className="text-xl font-black text-gray-900">{ticket.user?.full_name || 'Anonymous'}</h4>
                                    <span className="text-xs font-bold text-gray-400 capitalize bg-gray-50 px-3 py-1 rounded-full mt-1 border border-gray-100">
                                        {ticket.user?.role || 'Customer'}
                                    </span>
                                </div>

                                <div className="space-y-5">
                                    <div className="flex items-center gap-4 group">
                                        <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center text-[#FF6E15] group-hover:scale-110 transition-transform">
                                            <Mail className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email</p>
                                            <p className="text-sm font-bold text-gray-700 truncate">{ticket.user?.email || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 group">
                                        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                            <Calendar className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Member Since</p>
                                            <p className="text-sm font-bold text-gray-700">
                                                {ticket.user?.created_at ? format(new Date(ticket.user.created_at), 'MMMM yyyy') : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Status Management */}
                        <Card className="border-none shadow-xl rounded-2xl overflow-hidden bg-white">
                            <CardContent className="p-8">
                                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-6 text-center">Update Status</h3>
                                <div className="space-y-3">
                                    <Button
                                        onClick={() => updateStatus('in_progress')}
                                        disabled={ticket.status === 'in_progress'}
                                        variant="outline"
                                        className="w-full h-12 rounded-xl font-bold border-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all active:scale-95"
                                    >
                                        <Clock className="h-4 w-4 mr-2" />
                                        In Progress
                                    </Button>
                                    <Button
                                        onClick={() => updateStatus('resolved')}
                                        disabled={ticket.status === 'resolved'}
                                        className="w-full h-12 rounded-xl font-bold bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-100 transition-all active:scale-95"
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Mark Resolved
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
