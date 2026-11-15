import { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { supabase } from '../../../lib/supabase'

interface AdminMember {
    id: string
    full_name: string | null
    email: string | null
    phone_number: string | null
    role: 'admin' | 'sub_admin'
    created_at: string
}

interface EditAdminModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    member: AdminMember | null
}

export default function EditAdminModal({ isOpen, onClose, onSuccess, member }: EditAdminModalProps) {
    const [fullName, setFullName] = useState('')
    const [phone, setPhone] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        if (member) {
            setFullName(member.full_name || '')
            setPhone(member.phone_number || '')
            setError(null)
            setSuccess(false)
        }
    }, [member, isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!member) return

        setLoading(true)
        setError(null)

        try {
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    full_name: fullName || null,
                    phone_number: phone || null,
                })
                .eq('id', member.id)

            if (updateError) throw updateError

            setSuccess(true)
            setTimeout(() => {
                onSuccess()
                onClose()
            }, 1200)
        } catch (err: any) {
            setError(err.message || 'Failed to update admin. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen || !member) return null

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-[460px]">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 pb-2">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Edit Admin</h2>
                            <p className="text-sm text-gray-500">Update {member.full_name || 'admin'}'s details</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {success ? (
                            <div className="flex flex-col items-center py-8 gap-3">
                                <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                                    <CheckCircle className="h-7 w-7 text-green-600" />
                                </div>
                                <p className="text-lg font-semibold text-gray-900">Details Updated!</p>
                            </div>
                        ) : (
                            <>
                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md flex items-center gap-2 text-sm">
                                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Full name</label>
                                    <Input
                                        placeholder="Enter full name"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Email address</label>
                                    <Input
                                        type="email"
                                        value={member.email || ''}
                                        disabled
                                        className="bg-gray-50 text-gray-400 cursor-not-allowed"
                                    />
                                    <p className="text-xs text-gray-400">Email cannot be changed here</p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Phone number</label>
                                    <Input
                                        type="tel"
                                        placeholder="Enter phone number"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        disabled={loading}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Role</label>
                                    <div className="h-10 px-3 flex items-center bg-gray-50 rounded-md border border-gray-200">
                                        <span className="text-sm text-gray-500">
                                            {member.role === 'admin' ? 'Super Admin' : 'Sub Admin'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-400">Role can only be changed from the Supabase dashboard</p>
                                </div>

                                <div className="flex items-center gap-4 pt-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        className="flex-1 bg-orange-100 hover:bg-orange-200 text-gray-900 border-none"
                                        onClick={onClose}
                                        disabled={loading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="flex-1 bg-[#FF6E15] hover:bg-[#FF6E15]/90"
                                        disabled={loading}
                                    >
                                        {loading ? 'Saving...' : 'Save changes'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </form>
                </div>
            </div>
        </>
    )
}
