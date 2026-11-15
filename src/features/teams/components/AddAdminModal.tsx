import { useState, useEffect } from 'react'
import { X, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { supabase } from '../../../lib/supabase'

interface AddAdminModalProps {
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
    currentCount: number
    maxCount: number
}

export default function AddAdminModal({ isOpen, onClose, onSuccess, currentCount, maxCount }: AddAdminModalProps) {
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const atCapacity = currentCount >= maxCount

    useEffect(() => {
        if (!isOpen) {
            // Reset form on close
            setFullName('')
            setEmail('')
            setPhone('')
            setPassword('')
            setError(null)
            setSuccess(false)
        }
    }, [isOpen])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (atCapacity) return

        setLoading(true)
        setError(null)

        try {
            // Create Auth user
            const { data: authData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        role: 'sub_admin'
                    }
                }
            })

            if (signUpError) throw signUpError
            if (!authData.user) throw new Error('Failed to create user account')

            // Upsert profile with sub_admin role
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    id: authData.user.id,
                    full_name: fullName,
                    email,
                    phone_number: phone || null,
                    role: 'sub_admin',
                })

            if (profileError) throw profileError

            setSuccess(true)
            setTimeout(() => {
                onSuccess()
                onClose()
            }, 1500)
        } catch (err: any) {
            setError(err.message || 'Failed to add sub admin. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-[500px]">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 pb-2">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Add Sub Admin</h2>
                            <p className="text-sm text-gray-500">
                                Add a new sub-admin to the dashboard ({currentCount}/{maxCount} used)
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                        >
                            <X className="h-5 w-5 text-gray-500" />
                        </button>
                    </div>

                    {/* Content */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {success ? (
                            <div className="flex flex-col items-center py-8 gap-3">
                                <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center">
                                    <CheckCircle className="h-7 w-7 text-green-600" />
                                </div>
                                <p className="text-lg font-semibold text-gray-900">Sub Admin Added!</p>
                                <p className="text-sm text-gray-500 text-center">
                                    {fullName} has been added. They'll receive an email to confirm their account.
                                </p>
                            </div>
                        ) : (
                            <>
                                {atCapacity && (
                                    <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-md text-sm">
                                        Maximum of {maxCount} sub admins reached. Remove one before adding another.
                                    </div>
                                )}

                                {error && (
                                    <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md flex items-center gap-2 text-sm">
                                        <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                        {error}
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Full name *</label>
                                    <Input
                                        placeholder="Enter full name"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        required
                                        disabled={atCapacity || loading}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Email address *</label>
                                    <Input
                                        type="email"
                                        placeholder="Enter email address"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={atCapacity || loading}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Phone number</label>
                                    <Input
                                        type="tel"
                                        placeholder="Enter phone number"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        disabled={atCapacity || loading}
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium text-gray-700">Temporary password *</label>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Set a temporary password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            minLength={6}
                                            disabled={atCapacity || loading}
                                            className="pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400">Min. 6 characters. They can change this after logging in.</p>
                                </div>

                                <p className="text-sm font-medium text-gray-900 pt-1">
                                    This person will be added as a <span className="font-bold text-[#FF6E15]">Sub Admin</span>
                                </p>

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
                                        disabled={atCapacity || loading}
                                    >
                                        {loading ? 'Adding...' : 'Add sub admin'}
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
