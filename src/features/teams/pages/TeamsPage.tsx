import { useState, useEffect } from 'react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { Users, UserCheck, UserX, Shield, Search, Trash2 } from 'lucide-react'
import AddAdminModal from '../components/AddAdminModal'
import EditAdminModal from '../components/EditAdminModal'
import ConfirmRemoveModal from '../components/ConfirmRemoveModal'
import { supabase } from '../../../lib/supabase'

const MAX_SUB_ADMINS = 3

interface AdminMember {
    id: string
    full_name: string | null
    email: string | null
    phone_number: string | null
    role: 'admin' | 'sub_admin'
    created_at: string
    updated_at: string
}

function getInitials(name: string | null) {
    if (!name) return '?'
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
}

function getRelativeTime(dateString: string) {
    const diff = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (mins < 2) return 'just now'
    if (mins < 60) return `${mins} minutes ago`
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    return `${days} day${days > 1 ? 's' : ''} ago`
}

export default function TeamsPage() {
    const [members, setMembers] = useState<AdminMember[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [addModalOpen, setAddModalOpen] = useState(false)
    const [editModalOpen, setEditModalOpen] = useState(false)
    const [removeModalOpen, setRemoveModalOpen] = useState(false)
    const [selectedMember, setSelectedMember] = useState<AdminMember | null>(null)
    const [removingId, setRemovingId] = useState<string | null>(null)

    const subAdmins = members.filter((m) => m.role === 'sub_admin')
    const superAdmins = members.filter((m) => m.role === 'admin')
    const atCapacity = subAdmins.length >= MAX_SUB_ADMINS

    useEffect(() => {
        fetchTeamMembers()

        // Real-time subscription
        const channel = supabase
            .channel('teams-profiles-rt')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
                fetchTeamMembers()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchTeamMembers = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .in('role', ['admin', 'sub_admin'])
                .order('created_at', { ascending: false })

            if (error) throw error
            setMembers((data as AdminMember[]) || [])
        } catch (error) {
            console.error('Error fetching team members:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleEdit = (member: AdminMember) => {
        setSelectedMember(member)
        setEditModalOpen(true)
    }

    const handleRemoveClick = (member: AdminMember) => {
        setSelectedMember(member)
        setRemoveModalOpen(true)
    }

    const handleConfirmRemove = async () => {
        if (!selectedMember) return
        setRemovingId(selectedMember.id)

        try {
            // Downgrade role to 'customer' so they lose dashboard access
            // (Cannot delete auth users from client-side without admin SDK)
            const { error } = await supabase
                .from('profiles')
                .update({ role: 'customer' })
                .eq('id', selectedMember.id)

            if (error) throw error

            setMembers((prev) => prev.filter((m) => m.id !== selectedMember.id))
            setRemoveModalOpen(false)
            setSelectedMember(null)
        } catch (error) {
            console.error('Error removing admin:', error)
        } finally {
            setRemovingId(null)
        }
    }

    const filteredMembers = members.filter((m) => {
        const q = searchQuery.toLowerCase()
        return (
            m.full_name?.toLowerCase().includes(q) ||
            m.email?.toLowerCase().includes(q) ||
            m.phone_number?.includes(q)
        )
    })

    const stats = [
        { title: 'Total Sub Admins', value: subAdmins.length, icon: Users },
        { title: 'Super Admins', value: superAdmins.length, icon: Shield },
        { title: 'Active Team', value: members.length, icon: UserCheck },
        { title: 'Slots Available', value: Math.max(0, MAX_SUB_ADMINS - subAdmins.length), icon: UserX },
    ]

    return (
        <MainLayout>
            <div className="space-y-6">
                {/* Capacity banner */}
                {atCapacity && (
                    <div className="bg-orange-50 border border-orange-200 text-orange-700 text-sm font-medium text-center py-2.5 px-4 rounded-lg">
                        ⚠️ Maximum capacity reached — {MAX_SUB_ADMINS} sub admins allowed. Remove one to add another.
                    </div>
                )}

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Team management</h1>
                        <p className="text-gray-500 text-sm">Manage sub-admins and team members • Live data</p>
                    </div>
                    <Button
                        className="bg-[#FF6E15] hover:bg-[#FF6E15]/90 text-white w-full sm:w-auto"
                        onClick={() => setAddModalOpen(true)}
                        disabled={atCapacity}
                        title={atCapacity ? `Maximum of ${MAX_SUB_ADMINS} sub admins reached` : undefined}
                    >
                        Add sub admin
                    </Button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {stats.map((stat, i) => (
                        <Card key={i} className="border-none shadow-sm">
                            <CardContent className="p-5">
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-gray-500 text-sm font-medium">{stat.title}</span>
                                    <div className="h-8 w-8 rounded-full bg-orange-50 flex items-center justify-center">
                                        <stat.icon className="h-4 w-4 text-[#FF6E15]" />
                                    </div>
                                </div>
                                <h2 className="text-[28px] font-bold text-gray-900">{loading ? '—' : stat.value}</h2>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* List */}
                <div className="bg-white p-6 rounded-lg shadow-sm">
                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <Input
                            placeholder="Search by name, email or phone"
                            className="h-11 pl-10 bg-gray-50 border-transparent w-full"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {loading ? (
                        <div className="text-center text-gray-500 py-12">Loading team members...</div>
                    ) : filteredMembers.length === 0 ? (
                        <div className="text-center text-gray-400 py-12">
                            {searchQuery ? 'No members match your search.' : 'No team members found. Add a sub admin to get started.'}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {filteredMembers.map((member) => (
                                <div
                                    key={member.id}
                                    className="border border-gray-100 rounded-xl p-5 bg-white hover:shadow-md transition-shadow relative group"
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        <div className="h-12 w-12 rounded-full bg-[#FF6E15]/15 flex items-center justify-center flex-shrink-0">
                                            <span className="text-[#FF6E15] font-bold text-base">
                                                {getInitials(member.full_name)}
                                            </span>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <h3 className="font-bold text-gray-900 truncate">
                                                    {member.full_name || 'Unknown'}
                                                </h3>
                                                <button
                                                    onClick={() => handleEdit(member)}
                                                    className="text-[#FF6E15] text-sm font-medium hover:underline ml-2 flex-shrink-0"
                                                >
                                                    Edit
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-400 mb-3">
                                                Last updated: {getRelativeTime(member.updated_at)}
                                            </p>

                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="bg-[#FFEAD7] text-[#FF6E15] px-2.5 py-0.5 rounded text-xs font-medium">
                                                    {member.role === 'admin' ? 'Super Admin' : 'Sub Admin'}
                                                </span>
                                                <span className="bg-green-100 text-green-700 px-2.5 py-0.5 rounded text-xs font-medium">
                                                    Active
                                                </span>
                                            </div>

                                            <div className="space-y-1 text-sm text-gray-600">
                                                <p className="truncate">{member.email || 'No email'}</p>
                                                <p>{member.phone_number || 'No phone'}</p>
                                                <p className="text-gray-400 text-xs">
                                                    Added on {new Date(member.created_at).toLocaleDateString('en-GB')}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Delete — only for sub_admins */}
                                    {member.role === 'sub_admin' && (
                                        <button
                                            onClick={() => handleRemoveClick(member)}
                                            className="absolute bottom-5 right-5 text-red-400 hover:text-red-600 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                                            title="Remove admin"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modals */}
            <AddAdminModal
                isOpen={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onSuccess={fetchTeamMembers}
                currentCount={subAdmins.length}
                maxCount={MAX_SUB_ADMINS}
            />

            <EditAdminModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                onSuccess={fetchTeamMembers}
                member={selectedMember}
            />

            <ConfirmRemoveModal
                isOpen={removeModalOpen}
                onClose={() => setRemoveModalOpen(false)}
                onConfirm={handleConfirmRemove}
                memberName={selectedMember?.full_name || 'this admin'}
                loading={removingId !== null}
            />
        </MainLayout>
    )
}
