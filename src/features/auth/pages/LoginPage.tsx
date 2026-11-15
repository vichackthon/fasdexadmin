import { useState } from 'react'
import { Eye, EyeOff, AlertCircle, ShieldCheck } from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { Card, CardContent, CardHeader } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { Label } from '../../../components/ui/label'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'

export default function LoginPage() {
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [verificationCode, setVerificationCode] = useState('')
    const [needsVerification, setNeedsVerification] = useState(false)
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isVerifying, setIsVerifying] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const normalizedEmail = email.trim().toLowerCase()

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setNotice(null)

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
            })

            if (authError) {
                if (authError.message.toLowerCase().includes('email not confirmed')) {
                    setNeedsVerification(true)
                    setNotice('Enter the verification code Supabase sent to this email to activate the account.')
                    return
                }

                throw authError
            }

            // Successful login
            navigate('/dashboard')
        } catch (err: any) {
            console.error('Login failed:', err)
            setError(err.message || 'Invalid email or password')
        } finally {
            setIsLoading(false)
        }
    }

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsVerifying(true)
        setError(null)
        setNotice(null)

        try {
            const token = verificationCode.trim()

            if (!normalizedEmail) {
                throw new Error('Enter the email address for this sub admin.')
            }

            if (token.length !== 6) {
                throw new Error('Enter the 6-digit verification code from Supabase.')
            }

            const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
                email: normalizedEmail,
                token,
                type: 'signup',
            })

            if (verifyError) throw verifyError

            if (verifyData.session) {
                navigate('/dashboard')
                return
            }

            if (!password) {
                setNeedsVerification(false)
                setVerificationCode('')
                setNotice('Account verified. Enter the temporary password to log in.')
                return
            }

            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
            })

            if (signInError) throw signInError

            navigate('/dashboard')
        } catch (err: any) {
            console.error('Verification failed:', err)
            setError(err.message || 'Could not verify this account.')
        } finally {
            setIsVerifying(false)
        }
    }

    const handleResendCode = async () => {
        setIsVerifying(true)
        setError(null)
        setNotice(null)

        try {
            if (!normalizedEmail) {
                throw new Error('Enter the email address for this sub admin.')
            }

            const { error: resendError } = await supabase.auth.resend({
                type: 'signup',
                email: normalizedEmail,
            })

            if (resendError) throw resendError

            setNeedsVerification(true)
            setNotice('A fresh verification code has been sent.')
        } catch (err: any) {
            console.error('Resend verification failed:', err)
            setError(err.message || 'Could not resend the verification code.')
        } finally {
            setIsVerifying(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gray-50/50 p-4">
            <Card className="w-full max-w-[480px] border-gray-100 shadow-xl shadow-gray-200/50">
                <CardHeader className="flex flex-col items-center pt-10 pb-2">
                    <div className="w-[120px] h-auto mb-4">
                        {/* Replace with your actual logo path */}
                        <img
                            src="/logo.png"
                            alt="Fasdex Logo"
                            className="w-full h-full object-contain"
                            // Fallback if image fails (for development)
                            onError={(e) => {
                                e.currentTarget.src = "https://placehold.co/120x40?text=Fasdex"
                            }}
                        />
                    </div>
                    <h1 className="text-[28px] font-bold text-gray-900">Admin Login</h1>
                    <p className="text-gray-500 text-center text-[15px] mt-2">
                        Restricted access. Authorized personnel only.
                    </p>
                </CardHeader>

                <CardContent className="p-8 pt-4">
                    <form onSubmit={needsVerification ? handleVerifyCode : handleLogin} className="space-y-6">
                        {error && (
                            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md flex items-center gap-2 text-sm">
                                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        {notice && (
                            <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-md flex items-center gap-2 text-sm">
                                <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                                <p>{notice}</p>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="admin@fasdex.com"
                                className="h-[50px] bg-white"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isLoading || isVerifying}
                            />
                        </div>

                        {!needsVerification ? (
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="********"
                                        className="h-[50px] pr-10 bg-white"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={isLoading}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-5 w-5" />
                                        ) : (
                                            <Eye className="h-5 w-5" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="verification-code">Verification Code</Label>
                                <Input
                                    id="verification-code"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    placeholder="000000"
                                    className="h-[50px] bg-white text-center text-[22px] font-semibold tracking-[0.4em]"
                                    required
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    disabled={isVerifying}
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => {
                                    setNeedsVerification(false)
                                    setVerificationCode('')
                                    setNotice(null)
                                    setError(null)
                                }}
                                className="text-sm font-medium text-gray-600 hover:text-gray-900"
                            >
                                {needsVerification ? 'Back to password login' : 'Forgot Password?'}
                            </button>

                            <button
                                type="button"
                                onClick={needsVerification ? handleResendCode : () => {
                                    setNeedsVerification(true)
                                    setError(null)
                                    setNotice('Enter the verification code Supabase sent to this email to activate the account.')
                                }}
                                disabled={isVerifying || isLoading || !email}
                                className="text-sm font-medium text-[#FF6E15] hover:text-[#FF6E15]/80 disabled:text-gray-300"
                            >
                                {needsVerification ? 'Resend code' : 'I have a code'}
                            </button>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-[52px] text-[16px] font-semibold mt-4 bg-[#FF6E15] hover:bg-[#FF6E15]/90 text-white"
                            disabled={isLoading || isVerifying}
                        >
                            {needsVerification
                                ? (isVerifying ? "Verifying..." : "Verify and login")
                                : (isLoading ? "Logging in..." : "Login")}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
