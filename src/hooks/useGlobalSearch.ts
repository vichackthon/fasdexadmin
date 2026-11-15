import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export type GlobalSearchResult = {
    id: string
    type: 'rider' | 'customer' | 'restaurant' | 'order'
    title: string
    subtitle: string
    url: string
}

export function useGlobalSearch(query: string) {
    const [results, setResults] = useState<GlobalSearchResult[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!query.trim() || query.length < 2) {
            setResults([])
            setLoading(false)
            return
        }

        const fetchResults = async () => {
            setLoading(true)
            try {
                const searchTxt = `%${query}%`

                const [profilesRes, restaurantsRes, ordersRes] = await Promise.all([
                    supabase
                        .from('profiles')
                        .select('id, full_name, role, phone_number')
                        .or(`full_name.ilike.${searchTxt},phone_number.ilike.${searchTxt},email.ilike.${searchTxt}`)
                        .limit(5),
                    supabase
                        .from('restaurants')
                        .select('id, name, address')
                        .or(`name.ilike.${searchTxt}`)
                        .limit(5),
                    supabase
                        .from('orders')
                        .select('id, order_number, status')
                        .or(`order_number.ilike.${searchTxt},id.eq.${query.length === 36 ? query : '00000000-0000-0000-0000-000000000000'}`)
                        .limit(5)
                ])

                const formattedResults: GlobalSearchResult[] = []

                if (restaurantsRes.data) {
                    formattedResults.push(...restaurantsRes.data.map((r: any) => ({
                        id: r.id,
                        type: 'restaurant' as const,
                        title: r.name,
                        subtitle: r.address || 'Restaurant',
                        url: `/restaurants/${r.id}`
                    })))
                }

                if (profilesRes.data) {
                    profilesRes.data.forEach((p: any) => {
                        if (p.role === 'rider') {
                            formattedResults.push({
                                id: p.id,
                                type: 'rider',
                                title: p.full_name || 'Unknown Rider',
                                subtitle: p.phone_number || 'Rider',
                                url: `/riders`
                            })
                        } else if (p.role === 'customer') {
                            formattedResults.push({
                                id: p.id,
                                type: 'customer',
                                title: p.full_name || 'Unknown Customer',
                                subtitle: p.phone_number || 'Customer',
                                url: `/customers`
                            })
                        }
                    })
                }

                if (ordersRes.data) {
                    formattedResults.push(...ordersRes.data.map((o: any) => ({
                        id: o.id,
                        type: 'order' as const,
                        title: `Order #${o.order_number || o.id.slice(0, 8).toUpperCase()}`,
                        subtitle: `Status: ${o.status || 'Pending'}`,
                        url: `/orders`
                    })))
                }

                setResults(formattedResults)
            } catch (err) {
                console.error('Search error:', err)
            } finally {
                setLoading(false)
            }
        }

        const timer = setTimeout(() => {
            fetchResults()
        }, 300)

        return () => clearTimeout(timer)
    }, [query])

    return { results, loading }
}
