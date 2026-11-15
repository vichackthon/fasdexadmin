import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type Notification = Database['public']['Tables']['notifications']['Row']

export function useNotifications() {
    const queryClient = useQueryClient()

    const { data: notifications = [], isLoading } = useQuery<Notification[]>({
        queryKey: ['notifications'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return []

            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })

            if (error) throw error
            return data
        }
    })

    const unreadCount = notifications.filter(n => !n.is_read).length

    // Set up real-time subscription
    useEffect(() => {
        let isMounted = true
        let channel: ReturnType<typeof supabase.channel> | null = null

        const setupSubscription = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user || !isMounted) return

            channel = supabase
                .channel(`notifications-changes-${user.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'notifications',
                        filter: `user_id=eq.${user.id}`
                    },
                    () => {
                        queryClient.invalidateQueries({ queryKey: ['notifications'] })
                    }
                )
                .subscribe()
        }

        void setupSubscription()

        return () => {
            isMounted = false
            if (channel) {
                void supabase.removeChannel(channel)
            }
        }
    }, [queryClient])

    const getCurrentUser = async () => {
        const { data: { user } } = await supabase.auth.getUser()
        return user
    }

    const markAsRead = async (id: string) => {
        const { error } = await (supabase
            .from('notifications') as any)
            .update({ is_read: true })
            .eq('id', id)

        if (error) throw error
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }

    const markAllAsRead = async () => {
        const user = await getCurrentUser()
        if (!user) return

        const { error } = await (supabase
            .from('notifications') as any)
            .update({ is_read: true })
            .eq('user_id', user.id)
            .eq('is_read', false)

        if (error) throw error
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }

    const clearNotification = async (id: string) => {
        const user = await getCurrentUser()
        if (!user) return

        // Optimistically remove from cache
        queryClient.setQueryData<Notification[]>(['notifications'], (prev = []) =>
            prev.filter(n => n.id !== id)
        )

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) {
            console.error('Failed to clear notification:', error)
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
    }

    const clearAllNotifications = async () => {
        const user = await getCurrentUser()
        if (!user) return

        // Optimistically clear the UI immediately
        queryClient.setQueryData<Notification[]>(['notifications'], [])

        const { error } = await supabase
            .from('notifications')
            .delete()
            .eq('user_id', user.id)

        if (error) {
            console.error('Failed to clear notifications:', error)
            // Revert optimistic update on failure
            queryClient.invalidateQueries({ queryKey: ['notifications'] })
        }
    }

    return {
        notifications,
        unreadCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        clearNotification,
        clearAllNotifications
    }
}
