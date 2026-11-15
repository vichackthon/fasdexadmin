import { useState } from 'react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { supabase } from '../../../lib/supabase'
import { Trash2, Users, Bike, UtensilsCrossed, AlertTriangle } from 'lucide-react'

type ClearTarget = 'customers' | 'riders' | 'restaurants' | 'all'

interface ClearState {
    loading: boolean
    success: string | null
    error: string | null
}

interface ConfirmZoneProps {
    title: string
    description: string
    icon: React.ReactNode
    iconBg: string
    onClear: () => void
    loading: boolean
    result: { success: string | null; error: string | null }
    dangerous?: boolean
}

function ClearZone({ title, description, icon, iconBg, onClear, loading, result, dangerous }: ConfirmZoneProps) {
    const [confirmText, setConfirmText] = useState('')
    const required = 'DELETE'
    const canConfirm = confirmText === required

    return (
        <Card className={`border ${dangerous ? 'border-red-200 bg-red-50/30' : 'border-gray-100'} shadow-sm`}>
            <CardContent className="p-6">
                <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 h-10 w-10 rounded-full ${iconBg} flex items-center justify-center`}>
                        {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className={`font-semibold ${dangerous ? 'text-red-700' : 'text-gray-900'}`}>{title}</h3>
                        <p className="mt-1 text-sm text-gray-500">{description}</p>

                        <div className="mt-4 space-y-3">
                            <p className="text-xs text-gray-400">
                                Type <span className="font-mono font-semibold text-gray-700">{required}</span> to confirm
                            </p>
                            <div className="flex items-center gap-3">
                                <input
                                    type="text"
                                    value={confirmText}
                                    onChange={(e) => setConfirmText(e.target.value)}
                                    placeholder={required}
                                    className="h-9 px-3 text-sm border border-gray-200 rounded-lg bg-white w-32 font-mono focus:outline-none focus:ring-2 focus:ring-red-200"
                                />
                                <Button
                                    onClick={() => {
                                        onClear()
                                        setConfirmText('')
                                    }}
                                    disabled={!canConfirm || loading}
                                    className="h-9 px-4 bg-red-600 hover:bg-red-700 text-white text-sm disabled:opacity-40"
                                >
                                    {loading ? 'Clearing...' : 'Clear data'}
                                </Button>
                            </div>
                        </div>

                        {result.success && (
                            <p className="mt-3 text-sm text-green-600 font-medium">{result.success}</p>
                        )}
                        {result.error && (
                            <p className="mt-3 text-sm text-red-600">{result.error}</p>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

export default function DataManagementPage() {
    const [states, setStates] = useState<Record<ClearTarget, ClearState>>({
        customers: { loading: false, success: null, error: null },
        riders: { loading: false, success: null, error: null },
        restaurants: { loading: false, success: null, error: null },
        all: { loading: false, success: null, error: null },
    })

    const setTargetState = (target: ClearTarget, update: Partial<ClearState>) => {
        setStates(prev => ({ ...prev, [target]: { ...prev[target], ...update } }))
    }

    const clearCustomers = async () => {
        setTargetState('customers', { loading: true, success: null, error: null })
        try {
            // Delete orders placed by customers first
            await supabase.from('orders').delete().not('customer_id', 'is', null)
            const { error } = await supabase.from('profiles').delete().eq('role', 'customer')
            if (error) throw error
            setTargetState('customers', { loading: false, success: 'All customer profiles and orders cleared.' })
        } catch (err: any) {
            setTargetState('customers', { loading: false, error: err?.message || 'Failed to clear customers.' })
        }
    }

    const clearRiders = async () => {
        setTargetState('riders', { loading: true, success: null, error: null })
        try {
            // Unassign riders from orders
            await supabase.from('orders').update({ rider_id: null }).not('rider_id', 'is', null)
            // Delete verifications
            await supabase.from('rider_verifications').delete().not('id', 'is', null)
            const { error } = await supabase.from('profiles').delete().eq('role', 'rider')
            if (error) throw error
            setTargetState('riders', { loading: false, success: 'All rider profiles and verifications cleared.' })
        } catch (err: any) {
            setTargetState('riders', { loading: false, error: err?.message || 'Failed to clear riders.' })
        }
    }

    const clearRestaurants = async () => {
        setTargetState('restaurants', { loading: true, success: null, error: null })
        try {
            // support_tickets → orders → payouts/menu_items → restaurants → profiles
            await supabase.from('support_tickets').delete().not('related_order_id', 'is', null)
            await supabase.from('payouts').delete().not('restaurant_id', 'is', null)
            await supabase.from('menu_items').delete().not('restaurant_id', 'is', null)
            await supabase.from('orders').delete().not('restaurant_id', 'is', null)
            const { error } = await supabase.from('restaurants').delete().not('id', 'is', null)
            if (error) throw error
            await supabase.from('profiles').delete().eq('role', 'vendor')
            setTargetState('restaurants', { loading: false, success: 'All restaurants, orders, and vendor profiles cleared.' })
        } catch (err: any) {
            setTargetState('restaurants', { loading: false, error: err?.message || 'Failed to clear restaurants.' })
        }
    }

    const clearAll = async () => {
        setTargetState('all', { loading: true, success: null, error: null })
        try {
            // Clear in dependency order
            await supabase.from('orders').delete().not('id', 'is', null)
            await supabase.from('rider_verifications').delete().not('id', 'is', null)
            await supabase.from('restaurants').delete().not('id', 'is', null)
            await supabase.from('profiles').delete().in('role', ['customer', 'rider', 'vendor'])
            setTargetState('all', { loading: false, success: 'All seed data cleared. Platform is fresh and ready.' })
        } catch (err: any) {
            setTargetState('all', { loading: false, error: err?.message || 'Failed to clear all data.' })
        }
    }

    return (
        <MainLayout>
            <div className="space-y-6 max-w-3xl">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Data Management</h1>
                    <p className="text-gray-500 text-sm">Remove seed and test data to start fresh across all apps</p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-amber-800">Destructive operations</p>
                        <p className="text-xs text-amber-700 mt-0.5">
                            These actions permanently delete data from the database and cannot be undone.
                            Admin accounts are preserved. Only use this to clear seed or test data.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Clear by type</h2>

                    <ClearZone
                        title="Clear all customers"
                        description="Deletes all customer profiles and their order history from the database."
                        icon={<Users className="h-5 w-5 text-blue-600" />}
                        iconBg="bg-blue-100"
                        onClear={clearCustomers}
                        loading={states.customers.loading}
                        result={states.customers}
                    />

                    <ClearZone
                        title="Clear all riders"
                        description="Deletes all rider profiles, verification records, and unassigns them from any orders."
                        icon={<Bike className="h-5 w-5 text-purple-600" />}
                        iconBg="bg-purple-100"
                        onClear={clearRiders}
                        loading={states.riders.loading}
                        result={states.riders}
                    />

                    <ClearZone
                        title="Clear all restaurants"
                        description="Deletes all restaurants, their menus, all orders, and vendor profiles."
                        icon={<UtensilsCrossed className="h-5 w-5 text-orange-600" />}
                        iconBg="bg-orange-100"
                        onClear={clearRestaurants}
                        loading={states.restaurants.loading}
                        result={states.restaurants}
                    />
                </div>

                <div className="space-y-4 pt-2">
                    <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Nuclear option</h2>

                    <ClearZone
                        title="Clear ALL data"
                        description="Deletes all customers, riders, restaurants, orders, and verifications in one go. Admin accounts are kept. This gives you a completely fresh platform."
                        icon={<Trash2 className="h-5 w-5 text-red-600" />}
                        iconBg="bg-red-100"
                        onClear={clearAll}
                        loading={states.all.loading}
                        result={states.all}
                        dangerous
                    />
                </div>
            </div>
        </MainLayout>
    )
}
