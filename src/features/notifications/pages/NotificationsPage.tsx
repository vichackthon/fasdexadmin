import { useEffect, useMemo, useState } from 'react'
import { Bell, Send, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Input } from '../../../components/ui/input'
import { useAdminCapabilities } from '../../../hooks/useAdminCapabilities'
import {
    AUDIENCE_LABELS,
    PUSH_AUDIENCES,
    fetchAudienceStats,
    fetchPushCampaigns,
    sendBroadcast,
    type AudienceStats,
    type PushAudience,
    type PushCampaignRow,
    type BroadcastResult,
} from '../../../lib/pushBroadcast'

const TITLE_LIMIT = 65
const BODY_LIMIT = 240

export default function NotificationsPage() {
    const { can, isLoading: capsLoading, tier } = useAdminCapabilities()
    const allowed = can('support.broadcast')

    const [audience, setAudience] = useState<PushAudience>('customers')
    const [title, setTitle] = useState('')
    const [body, setBody] = useState('')
    const [deepLink, setDeepLink] = useState('')

    const [stats, setStats] = useState<Record<string, AudienceStats>>({})
    const [statsError, setStatsError] = useState<string | null>(null)
    const [confirming, setConfirming] = useState(false)
    const [sending, setSending] = useState(false)
    const [result, setResult] = useState<BroadcastResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [campaigns, setCampaigns] = useState<PushCampaignRow[]>([])

    const current = stats[audience]

    useEffect(() => {
        if (!allowed) return
        let cancelled = false
        Promise.all(PUSH_AUDIENCES.map(async (a) => [a, await fetchAudienceStats(a)] as const))
            .then((entries) => {
                if (cancelled) return
                setStats(Object.fromEntries(entries))
                setStatsError(null)
            })
            .catch(() => {
                if (!cancelled) setStatsError("Couldn't load audience sizes.")
            })
        return () => { cancelled = true }
    }, [allowed])

    const loadCampaigns = () => {
        if (!allowed) return
        fetchPushCampaigns().then(setCampaigns).catch(() => { /* history is non-critical */ })
    }
    useEffect(loadCampaigns, [allowed])

    const problem = useMemo(() => {
        if (!title.trim()) return 'Add a title'
        if (!body.trim()) return 'Add a message'
        if (title.length > TITLE_LIMIT) return `Title is over ${TITLE_LIMIT} characters`
        if (body.length > BODY_LIMIT) return `Message is over ${BODY_LIMIT} characters`
        if (deepLink.trim() && !deepLink.trim().startsWith('/')) {
            return 'A link must be an in-app route starting with /'
        }
        if (current && current.reachableTotal === 0) return 'Nobody in this audience can receive a push'
        return null
    }, [title, body, deepLink, current])

    const doSend = async () => {
        setConfirming(false)
        setSending(true)
        setError(null)
        setResult(null)
        try {
            const r = await sendBroadcast({
                audience,
                title: title.trim(),
                body: body.trim(),
                deepLink: deepLink.trim() || undefined,
            })
            setResult(r)
            setTitle('')
            setBody('')
            setDeepLink('')
            loadCampaigns()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'The broadcast could not be sent.')
        } finally {
            setSending(false)
        }
    }

    if (capsLoading) {
        return <MainLayout><div className="p-8 text-gray-500">Loading…</div></MainLayout>
    }

    // tier === null is a real state: the RBAC backfill left sub_admins
    // unassigned, and they reach the dashboard but hold no capabilities.
    // Say so rather than showing an empty page.
    if (!allowed) {
        return (
            <MainLayout>
                <div className="p-8">
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-6">
                            <h1 className="text-lg font-semibold text-gray-900">Notifications</h1>
                            <p className="mt-2 text-sm text-gray-500">
                                {tier === null
                                    ? 'Your account has not been assigned an admin tier yet, so it holds no capabilities. Ask a super admin to assign one in Teams.'
                                    : 'Sending broadcasts requires the support.broadcast capability, which your tier does not include.'}
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="p-8 space-y-6">
                <div>
                    <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                        <Bell className="h-6 w-6 text-[#FF6E15]" />
                        Notifications
                    </h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Send one push to a whole audience. Everyone also gets it in their in-app inbox,
                        which is what they see if their device was off or notifications are denied.
                    </p>
                </div>

                {result && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                        <div className="flex items-start gap-2">
                            <CheckCircle2 className="h-5 w-5 shrink-0" />
                            <div>
                                <p className="font-medium">Broadcast sent.</p>
                                <p className="mt-1 text-green-700">
                                    Delivered to {result.sent.toLocaleString()} device
                                    {result.sent === 1 ? '' : 's'} of {result.reachableTotal.toLocaleString()} reachable
                                    {' '}({result.audienceTotal.toLocaleString()} in the audience).
                                    {' '}{result.inappCount.toLocaleString()} inbox message
                                    {result.inappCount === 1 ? '' : 's'} written.
                                    {result.failed > 0 && ` ${result.failed.toLocaleString()} failed.`}
                                    {result.clearedTokens > 0 &&
                                        ` ${result.clearedTokens.toLocaleString()} dead device token${result.clearedTokens === 1 ? '' : 's'} cleared.`}
                                </p>
                                {result.truncated && (
                                    <p className="mt-2 font-medium text-amber-700">
                                        The send hit its time limit before finishing. Everyone still received the
                                        in-app message; send again to reach the remainder by push.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-2">
                        <AlertTriangle className="h-5 w-5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card className="border-none shadow-sm">
                        <CardContent className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Audience</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PUSH_AUDIENCES.map((a) => {
                                        const s = stats[a]
                                        const selected = audience === a
                                        return (
                                            <button
                                                key={a}
                                                type="button"
                                                onClick={() => setAudience(a)}
                                                disabled={sending}
                                                className={`rounded-lg border px-4 py-3 text-left transition-colors ${selected
                                                    ? 'border-[#FF6E15] bg-orange-50'
                                                    : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                            >
                                                <p className="text-sm font-medium text-gray-900">{AUDIENCE_LABELS[a]}</p>
                                                <p className="mt-0.5 text-xs text-gray-500">
                                                    {s
                                                        ? `${s.reachableTotal.toLocaleString()} reachable of ${s.audienceTotal.toLocaleString()}`
                                                        : statsError ?? 'counting…'}
                                                </p>
                                            </button>
                                        )
                                    })}
                                </div>
                                {current && current.audienceTotal > current.reachableTotal && (
                                    <p className="mt-2 text-xs text-gray-500">
                                        {(current.audienceTotal - current.reachableTotal).toLocaleString()} in this
                                        audience have no device token — they will get the in-app message only.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Title <span className="text-gray-400">({title.length}/{TITLE_LIMIT})</span>
                                </label>
                                <Input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Send a parcel with Fasdex"
                                    disabled={sending}
                                    className="bg-white"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Message <span className="text-gray-400">({body.length}/{BODY_LIMIT})</span>
                                </label>
                                <textarea
                                    value={body}
                                    onChange={(e) => setBody(e.target.value)}
                                    placeholder="Get anything moved across town by a Fasdex rider."
                                    disabled={sending}
                                    rows={4}
                                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#FF6E15] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                                    Opens (optional)
                                </label>
                                <Input
                                    value={deepLink}
                                    onChange={(e) => setDeepLink(e.target.value)}
                                    placeholder="/send-parcel"
                                    disabled={sending}
                                    className="bg-white"
                                />
                                <p className="mt-2 text-xs text-gray-500">
                                    An in-app route to open when the notification is tapped. Leave blank to just
                                    open the app.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setConfirming(true)}
                                disabled={sending || !!problem}
                                className="w-full rounded-full bg-[#FF6E15] px-6 py-3 text-sm font-medium text-white disabled:bg-orange-300 flex items-center justify-center gap-2"
                            >
                                {sending
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</>
                                    : <><Send className="h-4 w-4" /> {problem ?? `Send to ${(current?.reachableTotal ?? 0).toLocaleString()}`}</>}
                            </button>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm">
                        <CardContent className="p-6 space-y-4">
                            <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
                            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                <div className="rounded-lg bg-white p-3 shadow-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="h-5 w-5 rounded bg-[#FF6E15]" />
                                        <span className="text-xs font-medium text-gray-500">Fasdex · now</span>
                                    </div>
                                    <p className="mt-2 text-sm font-semibold text-gray-900">
                                        {title.trim() || 'Title'}
                                    </p>
                                    <p className="mt-0.5 text-sm text-gray-600">
                                        {body.trim() || 'Your message appears here.'}
                                    </p>
                                </div>
                            </div>
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                                <p className="font-medium">Before you send</p>
                                <ul className="mt-2 list-disc list-inside space-y-1 text-amber-700">
                                    <li>A broadcast cannot be recalled once it leaves.</li>
                                    <li>Android trims long titles to roughly one line when collapsed.</li>
                                    <li>Everyone in the audience gets an inbox message, even the unreachable.</li>
                                </ul>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card className="border-none shadow-sm">
                    <CardContent className="p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent broadcasts</h2>
                        {campaigns.length === 0 ? (
                            <p className="text-sm text-gray-500">Nothing sent yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-100">
                                            <th className="py-2 pr-4 font-medium text-gray-500">Sent</th>
                                            <th className="py-2 pr-4 font-medium text-gray-500">Audience</th>
                                            <th className="py-2 pr-4 font-medium text-gray-500">Title</th>
                                            <th className="py-2 pr-4 font-medium text-gray-500">Delivered</th>
                                            <th className="py-2 pr-4 font-medium text-gray-500">Failed</th>
                                            <th className="py-2 font-medium text-gray-500">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {campaigns.map((c) => (
                                            <tr key={c.id} className="border-b border-gray-50">
                                                <td className="py-3 pr-4 text-gray-600 whitespace-nowrap">
                                                    {new Date(c.created_at).toLocaleString()}
                                                </td>
                                                <td className="py-3 pr-4 text-gray-600">
                                                    {AUDIENCE_LABELS[c.audience] ?? c.audience}
                                                </td>
                                                <td className="py-3 pr-4 text-gray-900 max-w-[280px]">
                                                    <span className="line-clamp-1">{c.title}</span>
                                                </td>
                                                <td className="py-3 pr-4 text-gray-600">
                                                    {c.sent_count.toLocaleString()} / {c.reachable_total.toLocaleString()}
                                                </td>
                                                <td className="py-3 pr-4 text-gray-600">
                                                    {c.failed_count.toLocaleString()}
                                                </td>
                                                <td className="py-3">
                                                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === 'sent' && !c.error
                                                        ? 'bg-green-50 text-green-700'
                                                        : c.status === 'failed'
                                                            ? 'bg-red-50 text-red-700'
                                                            : 'bg-amber-50 text-amber-700'
                                                        }`}>
                                                        {c.error ? 'partial' : c.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {confirming && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">Send this broadcast?</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            This will push to{' '}
                            <span className="font-semibold">
                                {(current?.reachableTotal ?? 0).toLocaleString()}
                            </span>{' '}
                            device{(current?.reachableTotal ?? 0) === 1 ? '' : 's'} and write{' '}
                            <span className="font-semibold">
                                {(current?.audienceTotal ?? 0).toLocaleString()}
                            </span>{' '}
                            inbox message{(current?.audienceTotal ?? 0) === 1 ? '' : 's'} to{' '}
                            {AUDIENCE_LABELS[audience].toLowerCase()}. It cannot be recalled.
                        </p>
                        <div className="mt-4 rounded-lg bg-gray-50 p-3">
                            <p className="text-sm font-semibold text-gray-900">{title.trim()}</p>
                            <p className="mt-0.5 text-sm text-gray-600">{body.trim()}</p>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setConfirming(false)}
                                className="rounded-full px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={doSend}
                                className="rounded-full bg-[#FF6E15] px-5 py-2 text-sm font-medium text-white"
                            >
                                Send now
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    )
}
