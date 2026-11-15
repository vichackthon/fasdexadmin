import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * The signed-in staffer's capability set, from public.admin_capabilities().
 *
 * One round trip for the whole grid, so `can()` is a local lookup rather
 * than a query per rendered button.
 *
 * `tier === null` is a real state, not an error. The RBAC backfill
 * (20260816120000) promoted `profiles.role = 'admin'` to super_admin but
 * deliberately left every sub_admin unassigned, because silently mapping
 * them to a tier would have been either a privilege grant or a surprise
 * revocation. Those accounts still reach the dashboard — ProtectedRoute
 * gates on profiles.role — but hold no capabilities, so callers should
 * explain that rather than just hiding the buttons.
 */
export interface AdminCapabilities {
    tier: string | null
    capabilities: string[]
}

export function useAdminCapabilities() {
    const query = useQuery<AdminCapabilities>({
        queryKey: ['admin-capabilities'],
        // The grid only changes when a super admin edits the roster.
        staleTime: 5 * 60 * 1000,
        queryFn: async () => {
            const { data, error } = await supabase.rpc('admin_capabilities')
            if (error) throw error

            const rows = (data ?? []) as Array<{ tier: string | null; capability: string }>
            return {
                tier: rows[0]?.tier ?? null,
                capabilities: rows.map((r) => r.capability),
            }
        },
    })

    const capabilities = query.data?.capabilities ?? []

    return {
        ...query,
        tier: query.data?.tier ?? null,
        capabilities,
        can: (capability: string) => capabilities.includes(capability),
        /** On the dashboard, but not on the admin roster — needs a tier assigned. */
        isUnassigned: !query.isLoading && !query.isError && query.data?.tier == null,
    }
}
