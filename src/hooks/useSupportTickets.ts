import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type SupportTicket = Database['public']['Tables']['support_tickets']['Row'] & {
    customer?: { full_name: string | null }
}

export function useSupportTickets() {
    const queryClient = useQueryClient()

    const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
        queryKey: ['support-tickets'],
        queryFn: async () => {
            const { data, error } = await (supabase
                .from('support_tickets') as any)
                .select('*, customer:profiles!user_id(full_name)')
                .order('created_at', { ascending: false })

            if (error) throw error
            return data as SupportTicket[]
        }
    })

    // Set up real-time subscription
    useEffect(() => {
        const channel = supabase
            .channel('support-tickets-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'support_tickets'
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['support-tickets'] })
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [queryClient])

    return {
        tickets,
        isLoading
    }
}
