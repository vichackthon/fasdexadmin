import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type TicketWithUser = Database['public']['Tables']['support_tickets']['Row'] & {
    user?: Database['public']['Tables']['profiles']['Row']
}

type TicketMessage = Database['public']['Tables']['ticket_messages']['Row']

export function useTicketDetail(ticketId: string | undefined) {
    const queryClient = useQueryClient()

    const { data: ticket, isLoading } = useQuery<TicketWithUser | null>({
        queryKey: ['support-ticket', ticketId],
        queryFn: async () => {
            if (!ticketId) return null
            const { data, error } = await (supabase
                .from('support_tickets') as any)
                .select('*, user:profiles(id, full_name, email, avatar_url, created_at)')
                .eq('id', ticketId)
                .single()

            if (error) throw error
            return data
        },
        enabled: !!ticketId
    })

    const { data: messages = [] } = useQuery<TicketMessage[]>({
        queryKey: ['ticket-messages', ticketId],
        queryFn: async () => {
            if (!ticketId) return []
            const { data, error } = await (supabase
                .from('ticket_messages') as any)
                .select('*')
                .eq('ticket_id', ticketId)
                .order('created_at', { ascending: true })

            if (error) throw error
            return data ?? []
        },
        enabled: !!ticketId
    })

    // Real-time subscription for ticket changes
    useEffect(() => {
        if (!ticketId) return

        const channel = supabase
            .channel(`ticket-${ticketId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'support_tickets',
                    filter: `id=eq.${ticketId}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] })
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'ticket_messages',
                    filter: `ticket_id=eq.${ticketId}`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [ticketId, queryClient])

    const updateStatus = async (status: Database['public']['Tables']['support_tickets']['Row']['status']) => {
        if (!ticketId) return
        const { error } = await (supabase
            .from('support_tickets') as any)
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', ticketId)

        if (error) throw error
        queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] })

        // Notify customer when ticket is resolved
        if (status === 'resolved' && ticket?.user_id) {
            await (supabase.from('notifications') as any).insert({
                user_id: ticket.user_id,
                title: 'Ticket resolved',
                message: `Your support ticket "${ticket.subject}" has been marked as resolved.`,
                type: 'support_ticket',
                is_read: false,
                metadata: { ticket_id: ticketId },
            })
        }
    }

    const sendMessage = async (message: string) => {
        if (!ticketId || !ticket) return

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        const { error } = await (supabase.from('ticket_messages') as any).insert({
            ticket_id: ticketId,
            sender_type: 'admin',
            sender_id: user.id,
            message,
        })

        if (error) throw error

        // Move ticket to in_progress if still open
        if (ticket.status === 'open') {
            await (supabase.from('support_tickets') as any)
                .update({ status: 'in_progress', updated_at: new Date().toISOString() })
                .eq('id', ticketId)
        }

        // Notify the customer
        if (ticket.user_id) {
            await (supabase.from('notifications') as any).insert({
                user_id: ticket.user_id,
                title: 'Support ticket update',
                message: `We've responded to your ticket: "${ticket.subject}". Tap to view.`,
                type: 'support_ticket',
                is_read: false,
                metadata: { ticket_id: ticketId },
            })
        }

        queryClient.invalidateQueries({ queryKey: ['ticket-messages', ticketId] })
        queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] })
    }

    // Keep for backward compat — now delegates to sendMessage
    const sendResponse = sendMessage

    return {
        ticket,
        messages,
        isLoading,
        updateStatus,
        sendMessage,
        sendResponse,
    }
}
