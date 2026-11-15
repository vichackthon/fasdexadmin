import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Loader2, Store } from 'lucide-react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { formatDateOfBirth } from '../../../lib/formatters'
import { supabase } from '../../../lib/supabase'

export default function ReviewApplicationPage() {
    const navigate = useNavigate()
    const { id } = useParams()
    const [searchParams] = useSearchParams()
    const type = searchParams.get('type') || 'rider'

    const [data, setData] = useState<any>(null)
    const [loading, setLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState(false)

    useEffect(() => {
        if (id) {
            fetchDetails()
        }
    }, [id, type])

    const fetchDetails = async () => {
        if (!id) {
            console.error('No ID provided')
            setLoading(false)
            return
        }

        setLoading(true)
        try {
            if (type === 'restaurant') {
                const { data, error } = await supabase
                    .from('restaurants')
                    .select(`
                        *,
                        owner:profiles!restaurants_owner_id_fkey(
                            full_name,
                            email,
                            phone_number,
                            address,
                            avatar_url
                        )
                    `)
                    .eq('id', id!)
                    .single()

                if (error) console.error('Error fetching restaurant:', error)
                else {
                    const owner = (data as any)?.owner
                    setData({
                        ...data,
                        owner_name: owner?.full_name || 'N/A',
                        owner_email: owner?.email || 'N/A',
                        owner_phone: owner?.phone_number || 'N/A',
                        owner_address: owner?.address || 'N/A',
                        avatar_url: owner?.avatar_url || null,
                    })
                }
            } else {
                // Fetch real rider verification data
                const { data, error } = await supabase
                    .from('rider_verifications')
                    .select(`
                        *,
                        rider:profiles!rider_verifications_rider_id_fkey(full_name, phone_number, email, address, avatar_url)
                    `)
                    .eq('id', id!)
                    .single()

                if (error) {
                    console.error('Error fetching rider verification:', error)
                } else {
                    // Transform the data to match the expected format
                    const riderInfo = data.rider as any
                    setData({
                        ...data,
                        name: riderInfo?.full_name || 'Unknown Rider',
                        email: riderInfo?.email || 'N/A',
                        phone: riderInfo?.phone_number || 'N/A',
                        address: riderInfo?.address || 'N/A',
                        avatar_url: riderInfo?.avatar_url || null,
                        document_url: data.document_url || data.license_image_url || null,
                        created_at: data.submitted_at
                    })
                }
            }
        } catch (error) {
            console.error('Error in fetchDetails:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleAction = async (status: 'approved' | 'rejected') => {
        if (!id) {
            alert('Invalid application ID')
            return
        }

        setActionLoading(true)
        try {
            if (type === 'restaurant') {
                // For restaurants, update verification status AND active status
                const updates: any = {
                    verification_status: status,
                    updated_at: new Date().toISOString()
                }

                // If approved, also activate the restaurant immediately
                if (status === 'approved') {
                    updates.is_active = true
                } else if (status === 'rejected') {
                    updates.is_active = false
                }

                const { error } = await supabase
                    .from('restaurants')
                    .update(updates)
                    .eq('id', id!)

                if (error) {
                    console.error('Error updating restaurant:', error)
                    alert('Error updating status: ' + error.message)
                } else {
                    navigate('/approvals')
                }
            } else {
                // For riders, update the rider_verifications table
                const { error } = await supabase
                    .from('rider_verifications')
                    .update({
                        status: status,
                        reviewed_at: new Date().toISOString()
                    } as any)
                    .eq('id', id)

                if (error) {
                    alert('Error updating status: ' + error.message)
                } else {
                    navigate('/approvals')
                }
            }
        } catch (error) {
            console.error('Error in handleAction:', error)
            alert('An error occurred while processing the application')
        } finally {
            setActionLoading(false)
        }
    }

    if (loading) {
        return (
            <MainLayout>
                <div className="flex justify-center items-center h-screen">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
            </MainLayout>
        )
    }

    if (!data) {
        return (
            <MainLayout>
                <div className="p-8 text-center text-gray-500">Applicant not found</div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Review {data.name} application</h1>
                </div>

                {/* Back Button */}
                <button
                    onClick={() => navigate('/approvals')}
                    className="flex items-center gap-2 text-gray-900 font-medium hover:underline"
                >
                    <ArrowLeft className="h-5 w-5" />
                    Go back to approval list
                </button>

                {/* Personal Information */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-8">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">
                            {type === 'restaurant' ? 'Business Information' : 'Personal Information'}
                        </h3>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100">
                                {data.image_url || data.cac_certificate_url || data.avatar_url ? (
                                    <img
                                        src={
                                            type === 'restaurant'
                                                ? (data.image_url || 'https://via.placeholder.com/100?text=Logo')
                                                : (data.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'R')}&background=FF6E15&color=fff`)
                                        }
                                        alt="Applicant"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <div className="h-full w-full bg-gray-200 flex items-center justify-center text-gray-400">
                                        <Store className="h-8 w-8" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <h4 className="text-lg font-bold text-gray-900">{data.name}</h4>
                                <p className="text-sm text-gray-500">Registered on {new Date(data.created_at || Date.now()).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                            {type === 'restaurant' ? (
                                <>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Business Name</p>
                                        <p className="text-gray-900 font-medium break-words">{data.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Owner name</p>
                                        <p className="text-gray-900 font-medium">{data.owner_name || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Owner email</p>
                                        <p className="text-gray-900 font-medium break-words">{data.owner_email || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Owner phone</p>
                                        <p className="text-gray-900 font-medium">{data.owner_phone || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Business address</p>
                                        <p className="text-gray-900 font-medium">{data.address || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Owner address</p>
                                        <p className="text-gray-900 font-medium">{data.owner_address || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Tax ID</p>
                                        <p className="text-gray-900 font-medium">{data.tax_id || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Verification status</p>
                                        <p className="text-gray-900 font-medium capitalize">{data.verification_status || 'pending'}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Email address</p>
                                        <p className="text-gray-900 font-medium break-words">{data.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Phone number</p>
                                        <p className="text-gray-900 font-medium">{data.phone}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Address</p>
                                        <p className="text-gray-900 font-medium">{data.address}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Vehicle</p>
                                        <p className="text-gray-900 font-medium">{data.vehicle_type || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Plate number</p>
                                        <p className="text-gray-900 font-medium">{data.plate_number || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Date of birth</p>
                                        <p className="text-gray-900 font-medium">{formatDateOfBirth(data.date_of_birth)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 mb-1">Application status</p>
                                        <p className="text-gray-900 font-medium capitalize">{data.status || 'pending'}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {type === 'rider' && (
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-8">
                            <h3 className="text-xl font-bold text-gray-900 mb-6">Guarantor information</h3>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Full name</p>
                                    <p className="text-gray-900 font-medium">{data.guarantor_name || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Phone number</p>
                                    <p className="text-gray-900 font-medium">{data.guarantor_phone || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Relationship</p>
                                    <p className="text-gray-900 font-medium">{data.guarantor_relationship || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Address</p>
                                    <p className="text-gray-900 font-medium">{data.guarantor_address || 'N/A'}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Documents */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-8">
                        <h3 className="text-xl font-bold text-gray-900 mb-6">Document submitted</h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {type === 'restaurant' ? (
                                <div>
                                    <p className="text-sm font-medium text-gray-900 mb-3">CAC Certificate</p>
                                    {data.cac_certificate_url ? (
                                        <a href={data.cac_certificate_url} target="_blank" rel="noreferrer" className="block aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden border border-gray-100 relative group">
                                            {/* Preview if image, or generic icon */}
                                            <img src={data.cac_certificate_url} alt="CAC" className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Document'
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-white font-medium">View Document</span>
                                            </div>
                                        </a>
                                    ) : (
                                        <div className="text-gray-500 italic">No document uploaded</div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <p className="text-sm font-medium text-gray-900 mb-3">Rider document</p>
                                    {data.document_url ? (
                                        <a
                                            href={data.document_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="block aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden border border-gray-100 relative group"
                                        >
                                            <img
                                                src={data.document_url}
                                                alt="Rider document"
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Document'
                                                }}
                                            />
                                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span className="text-white font-medium">View document</span>
                                                <ExternalLink className="h-4 w-4 text-white" />
                                            </div>
                                        </a>
                                    ) : (
                                        <div className="text-gray-500 italic">No document uploaded</div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="mt-8">
                            <p className="text-xs text-gray-500 mb-6 uppercase tracking-wide">
                                • REVIEW ALL DOCUMENTS CAREFULLY BEFORE MAKING YOUR DECISION. APPROVED APPLICANTS WILL BE ABLE TO START ACCEPTING ORDERS IMMEDIATELY.
                            </p>

                            <div className="flex items-center gap-4">
                                <Button
                                    onClick={() => handleAction('rejected')}
                                    disabled={actionLoading}
                                    className="bg-red-600 hover:bg-red-700 text-white min-w-[140px]"
                                >
                                    {actionLoading ? 'Processing...' : 'Reject applicant'}
                                </Button>
                                <Button
                                    onClick={() => handleAction('approved')}
                                    disabled={actionLoading}
                                    className="bg-green-600 hover:bg-green-700 text-white min-w-[140px]"
                                >
                                    {actionLoading ? 'Processing...' : 'Approve applicant'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    )
}
