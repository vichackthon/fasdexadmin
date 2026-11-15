import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Database } from '../lib/database.types'

type NotificationInsert = Database['public']['Tables']['notifications']['Insert']

export function useBroadcast() {
    const [isLoading, setIsLoading] = useState(false)

    const sendBroadcast = async (title: string, message: string, targetRole: string) => {
        setIsLoading(true)
        try {
            // Fetch all users with the target role
            let query = (supabase.from('profiles') as any).select('id')

            if (targetRole !== 'All user') {
                const roleMap: Record<string, string> = {
                    'Riders': 'rider',
                    'Restaurants': 'vendor',
                    'Customers': 'customer'
                }
                const role = roleMap[targetRole]
                if (role) {
                    query = query.eq('role', role)
                }
            }

            const { data: users, error: userError } = await query
            if (userError) throw userError

            if (!users || users.length === 0) {
                return { success: true, message: 'No users found for this role.' }
            }

            // Create notifications for all these users
            const notifications: NotificationInsert[] = (users as any[]).map(user => ({
                user_id: user.id,
                title,
                message,
                type: 'system',
                metadata: { is_broadcast: true, target_role: targetRole }
            }))

            const { error: notifyError } = await (supabase
                .from('notifications') as any)
                .insert(notifications)

            if (notifyError) throw notifyError

            return { success: true }
        } catch (error) {
            console.error('Broadcast error:', error)
            throw error
        } finally {
            setIsLoading(false)
        }
    }

    return {
        sendBroadcast,
        isLoading
    }
}
