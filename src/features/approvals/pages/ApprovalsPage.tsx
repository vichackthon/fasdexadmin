import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { User, Bike, Store, ChevronRight } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

export default function ApprovalsPage() {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<'riders' | 'restaurants'>('riders')
    const [riderApps, setRiderApps] = useState<any[]>([])
    const [restaurantApps, setRestaurantApps] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchRiders()
        fetchRestaurants()

        const riderChannel = supabase
            .channel('approvals-riders')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rider_verifications' }, () => {
                fetchRiders()
            })
            .subscribe()

        const restaurantChannel = supabase
            .channel('approvals-restaurants')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurants' }, () => {
                fetchRestaurants()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(riderChannel)
            supabase.removeChannel(restaurantChannel)
        }
    }, [])

    useEffect(() => {
        if (activeTab === 'riders') {
            fetchRiders()
        } else {
            fetchRestaurants()
        }
    }, [activeTab])

    const fetchRiders = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('rider_verifications')
                .select(`
                    *,
                    rider:profiles!rider_verifications_rider_id_fkey(full_name, phone_number)
                `)
                .eq('status', 'pending')
                .order('submitted_at', { ascending: false })

            if (error) {
                console.error('Error fetching rider verifications:', error)
            } else {
                setRiderApps(data || [])
            }
        } catch (error) {
            console.error('Error fetching rider verifications:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchRestaurants = async () => {
        setLoading(true)
        try {
            // Fetch restaurants that are not active (pending approval)
            const { data, error } = await supabase
                .from('restaurants')
                .select('*')
                .eq('verification_status', 'pending')
                .order('created_at', { ascending: false })

            if (error) {
                console.error('Error fetching restaurants:', error)
            } else {
                setRestaurantApps(data || [])
            }
        } catch (error) {
            console.error('Error fetching restaurants:', error)
        } finally {
            setLoading(false)
        }
    }

    const applications = activeTab === 'riders'
        ? riderApps.map(r => ({
            id: r.id,
            name: (r.rider as any)?.full_name || 'Unknown Rider',
            type: 'Rider',
            date: new Date(r.submitted_at).toLocaleDateString('en-GB'),
            vehicleType: r.vehicle_type,
            plateNumber: r.plate_number
        }))
        : restaurantApps.map(r => ({
            id: r.id,
            name: r.name,
            type: 'Restaurant',
            date: new Date(r.created_at).toLocaleDateString('en-GB'),
            ...r
        }))

    const stats = [
        { title: 'Total Pending', value: (riderApps.length + restaurantApps.length).toString(), trend: `${riderApps.length + restaurantApps.length} pending`, icon: User, iconBg: 'bg-orange-50', iconColor: 'text-[#FF6E15]' },
        { title: 'Riders', value: riderApps.length.toString(), icon: Bike, iconBg: 'bg-orange-50', iconColor: 'text-[#FF6E15]' },
        { title: 'Restaurant', value: restaurantApps.length.toString(), icon: Store, iconBg: 'bg-orange-50', iconColor: 'text-[#FF6E15]' },
    ]

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Approval</h1>
                    <p className="text-gray-500 text-sm">Review and approve pending applications</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {stats.map((stat, i) => (
                        <Card key={i} className="border-none shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-gray-500 text-sm font-medium">{stat.title}</span>
                                    <div className={`h-8 w-8 rounded-full ${stat.iconBg} flex items-center justify-center`}>
                                        <stat.icon className={`h-4 w-4 ${stat.iconColor}`} />
                                    </div>
                                </div>
                                <h2 className="text-[28px] font-bold text-gray-900 mb-1">{stat.value}</h2>
                                {stat.trend && (
                                    <p className="text-sm text-green-600">{stat.trend}</p>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Tabs */}
                <div className="bg-gray-100 p-1 rounded-lg inline-flex">
                    <button
                        onClick={() => setActiveTab('riders')}
                        className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'riders'
                            ? 'bg-[#FF6E15] text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Riders
                    </button>
                    <button
                        onClick={() => setActiveTab('restaurants')}
                        className={`px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'restaurants'
                            ? 'bg-[#FF6E15] text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Restaurants
                    </button>
                </div>

                {/* Application List */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">Loading...</div>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {applications.length === 0 ? (
                                    <div className="p-8 text-center text-gray-500">No pending applications</div>
                                ) : (
                                    applications.map((app) => (
                                        <div
                                            key={app.id}
                                            onClick={() => navigate(`/approvals/${app.id}?type=${activeTab === 'riders' ? 'rider' : 'restaurant'}`)}
                                            className="p-4 hover:bg-gray-50 transition-colors cursor-pointer flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`h-2.5 w-2.5 rounded-full bg-[#FF6E15]`} />
                                                <div>
                                                    <p className="font-semibold text-gray-900 mb-0.5">
                                                        {app.name}
                                                        <span className="text-xs text-gray-500 font-normal ml-1">
                                                            ({app.type})
                                                        </span>
                                                    </p>
                                                    <p className="text-xs text-gray-400">Registered on {app.date}</p>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-500" />
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
