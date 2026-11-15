import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Search } from 'lucide-react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { supabase } from '../../../lib/supabase'
import type { Database } from '../../../lib/database.types'

type MenuItem = Database['public']['Tables']['menu_items']['Row']

export default function RestaurantMenuPage() {
    const navigate = useNavigate()
    const { id } = useParams()
    const [menuItems, setMenuItems] = useState<MenuItem[]>([])
    const [loading, setLoading] = useState(true)
    const [restaurantName, setRestaurantName] = useState('')
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        if (id) {
            fetchRestaurantAndMenu(id)
        }
    }, [id])

    const fetchRestaurantAndMenu = async (restaurantId: string) => {
        try {
            setLoading(true)

            // Fetch restaurant name
            const { data: restaurant, error: restaurantError } = await supabase
                .from('restaurants')
                .select('name')
                .eq('id', restaurantId)
                .single()

            if (restaurantError) throw restaurantError
            if (restaurant) setRestaurantName((restaurant as any).name)

            // Fetch menu items
            const { data: items, error: menuError } = await supabase
                .from('menu_items')
                .select('*')
                .eq('restaurant_id', restaurantId)

            if (menuError) throw menuError
            if (items) setMenuItems(items)

        } catch (error) {
            console.error('Error fetching menu details:', error)
        } finally {
            setLoading(false)
        }
    }

    const filteredItems = menuItems.filter(item =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center h-screen">
                    <p className="text-gray-500">Loading menu...</p>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Restaurant Menu</h1>
                        <p className="text-gray-500 text-sm">View and manage menu items</p>
                    </div>
                </div>

                {/* Back Button & Title */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate(`/restaurants/${id}`)}
                            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ArrowLeft className="h-6 w-6 text-gray-600" />
                        </button>
                        <h2 className="text-xl font-bold text-gray-900">{restaurantName} - Menu</h2>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search menu items..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF6E15] focus:border-transparent w-full sm:w-64"
                        />
                    </div>
                </div>

                {/* Menu Items Grid */}
                {filteredItems.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
                        <p className="text-gray-500">No menu items found.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredItems.map((item) => (
                            <Card key={item.id} className="overflow-hidden shadow-sm border-gray-100">
                                <div className="h-48 w-full bg-gray-100 relative">
                                    {item.image_url ? (
                                        <img
                                            src={item.image_url}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50">
                                            No Image
                                        </div>
                                    )}
                                    <div className="absolute top-3 right-3">
                                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${item.is_available
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                            }`}>
                                            {item.is_available ? 'Available' : 'Unavailable'}
                                        </span>
                                    </div>
                                </div>
                                <CardContent className="p-5">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-900 line-clamp-1">{item.name}</h3>
                                            {item.category && (
                                                <span className="text-xs text-gray-500 font-medium">{item.category}</span>
                                            )}
                                        </div>
                                        {item.discount_price != null && item.discount_price < item.price ? (
                                            <span className="flex flex-col items-end whitespace-nowrap">
                                                <span className="text-xs text-gray-400 line-through">
                                                    ₦{item.price.toLocaleString()}
                                                </span>
                                                <span className="text-green-600 font-bold">
                                                    ₦{item.discount_price.toLocaleString()}
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="text-[#FF6E15] font-bold whitespace-nowrap">
                                                ₦{item.price.toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 line-clamp-2 mt-2">
                                        {item.description || 'No description provided.'}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </MainLayout>
    )
}
