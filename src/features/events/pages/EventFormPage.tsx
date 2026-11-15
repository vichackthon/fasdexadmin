import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Upload } from 'lucide-react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { supabase } from '../../../lib/supabase'

type TierDraft = {
    // Existing tiers carry their DB id; new ones are null until saved.
    id: string | null
    name: string
    description: string
    perks: string
    price: string
    quantity_total: string
    max_per_order: string
    is_active: boolean
}

// event_type and status are the same literal unions the DB CHECK
// constraints enforce, so a typo here fails the build instead of failing an
// insert at runtime.
type EventType = 'physical' | 'online'
type EventStatus = 'draft' | 'published' | 'cancelled' | 'archived'

type EventForm = {
    title: string
    description: string
    category: string
    poster_url: string
    host_name: string
    host_logo_url: string
    venue_name: string
    address: string
    city: string
    event_type: EventType
    timezone: string
    starts_at: string
    ends_at: string
    sales_end_at: string
    status: EventStatus
    is_featured: boolean
    capacity: string
}

const EMPTY_FORM: EventForm = {
    title: '',
    description: '',
    category: '',
    poster_url: '',
    host_name: '',
    host_logo_url: '',
    venue_name: '',
    address: '',
    city: '',
    event_type: 'physical',
    timezone: 'Africa/Lagos',
    starts_at: '',
    ends_at: '',
    sales_end_at: '',
    status: 'draft',
    is_featured: false,
    capacity: '',
}

const EMPTY_TIER: TierDraft = {
    id: null,
    name: '',
    description: '',
    perks: '',
    price: '',
    quantity_total: '',
    max_per_order: '10',
    is_active: true,
}

// A few zones rather than the full IANA list: these are the ones Fasdex
// plausibly sells into, and a 400-entry dropdown is worse than a short one.
const TIMEZONES = [
    'Africa/Lagos',
    'Africa/Accra',
    'Africa/Abidjan',
    'Africa/Johannesburg',
    'Africa/Nairobi',
    'Europe/London',
    'America/New_York',
]

/// The stored value is UTC; the input edits wall-clock time in the EVENT's
/// zone. Without this pair of converters an admin in London scheduling a
/// Lagos event would silently shift it by an hour.
const utcToZonedInput = (iso: string | null, timezone: string) => {
    if (!iso) return ''
    try {
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).formatToParts(new Date(iso))
        const get = (type: string) => parts.find(p => p.type === type)?.value ?? '00'
        // Intl can emit hour "24" at midnight for some locales/zones.
        const hour = get('hour') === '24' ? '00' : get('hour')
        return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
    } catch {
        return ''
    }
}

const zonedInputToUtc = (local: string, timezone: string): string | null => {
    if (!local) return null
    try {
        // Read the naive wall-clock string as if it were UTC, then measure how
        // far that instant is from the same wall clock in the target zone and
        // correct by the difference. Handles DST because the offset is taken
        // at the actual date, not a fixed constant.
        const asUtc = new Date(`${local}:00Z`)
        const zoned = new Date(asUtc.toLocaleString('en-US', { timeZone: timezone }))
        const utc = new Date(asUtc.toLocaleString('en-US', { timeZone: 'UTC' }))
        const offset = zoned.getTime() - utc.getTime()
        return new Date(asUtc.getTime() - offset).toISOString()
    } catch {
        return null
    }
}

export default function EventFormPage() {
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const isNew = !id || id === 'new'

    const [form, setForm] = useState<EventForm>(EMPTY_FORM)
    const [tiers, setTiers] = useState<TierDraft[]>([{ ...EMPTY_TIER }])
    const [deletedTierIds, setDeletedTierIds] = useState<string[]>([])
    const [loading, setLoading] = useState(!isNew)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState<'poster' | 'host' | null>(null)
    const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

    useEffect(() => {
        if (!isNew) void loadEvent()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    const loadEvent = async () => {
        if (!id) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('events')
                .select('*, event_ticket_tiers(*)')
                .eq('id', id)
                .single()

            if (error) throw error

            const timezone = data.timezone ?? 'Africa/Lagos'
            setForm({
                title: data.title ?? '',
                description: data.description ?? '',
                category: data.category ?? '',
                poster_url: data.poster_url ?? '',
                host_name: data.host_name ?? '',
                host_logo_url: data.host_logo_url ?? '',
                venue_name: data.venue_name ?? '',
                address: data.address ?? '',
                city: data.city ?? '',
                event_type: data.event_type ?? 'physical',
                timezone,
                starts_at: utcToZonedInput(data.starts_at, timezone),
                ends_at: utcToZonedInput(data.ends_at, timezone),
                sales_end_at: utcToZonedInput(data.sales_end_at, timezone),
                status: data.status ?? 'draft',
                is_featured: data.is_featured ?? false,
                capacity: data.capacity != null ? String(data.capacity) : '',
            })

            const loadedTiers = (data.event_ticket_tiers ?? []) as Record<string, unknown>[]
            setTiers(
                loadedTiers.length === 0
                    ? [{ ...EMPTY_TIER }]
                    : loadedTiers
                          .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
                          .map(tier => ({
                              id: String(tier.id),
                              name: String(tier.name ?? ''),
                              description: String(tier.description ?? ''),
                              perks: ((tier.perks as string[] | null) ?? []).join('\n'),
                              price: String(tier.price ?? ''),
                              quantity_total: tier.quantity_total != null ? String(tier.quantity_total) : '',
                              max_per_order: String(tier.max_per_order ?? 10),
                              is_active: Boolean(tier.is_active ?? true),
                          }))
            )
        } catch (err) {
            console.error('Error loading event:', err)
            setFeedback({ type: 'error', text: 'Could not load this event.' })
        } finally {
            setLoading(false)
        }
    }

    const setField = <K extends keyof EventForm>(key: K, value: EventForm[K]) =>
        setForm(prev => ({ ...prev, [key]: value }))

    const setTierField = <K extends keyof TierDraft>(index: number, key: K, value: TierDraft[K]) =>
        setTiers(prev => prev.map((tier, i) => (i === index ? { ...tier, [key]: value } : tier)))

    const removeTier = (index: number) => {
        const tier = tiers[index]
        // A saved tier may already have tickets pointing at it, so deletion is
        // deferred to save time and done by id.
        if (tier.id) setDeletedTierIds(prev => [...prev, tier.id as string])
        setTiers(prev => (prev.length === 1 ? [{ ...EMPTY_TIER }] : prev.filter((_, i) => i !== index)))
    }

    const handleUpload = async (file: File, target: 'poster' | 'host') => {
        const maxBytes = 5 * 1024 * 1024
        if (file.size > maxBytes) {
            setFeedback({ type: 'error', text: 'Image must be 5MB or smaller.' })
            return
        }

        setUploading(target)
        setFeedback(null)

        try {
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
            const filePath = `events/${target}-${Date.now()}-${sanitizedName}`

            const { error: uploadError } = await supabase.storage
                .from('public')
                .upload(filePath, file, { cacheControl: '3600', upsert: true })

            if (uploadError) throw uploadError

            const { data } = supabase.storage.from('public').getPublicUrl(filePath)
            setField(target === 'poster' ? 'poster_url' : 'host_logo_url', data.publicUrl)
            setFeedback({ type: 'success', text: 'Image uploaded.' })
        } catch (err) {
            console.error('Error uploading image:', err)
            setFeedback({ type: 'error', text: 'Upload failed. You can still paste an image link.' })
        } finally {
            setUploading(null)
        }
    }

    const validate = (): string | null => {
        if (!form.title.trim()) return 'Give the event a title.'
        if (!form.starts_at) return 'Set a start date and time.'

        const usableTiers = tiers.filter(tier => tier.name.trim())
        if (usableTiers.length === 0) return 'Add at least one ticket type.'
        for (const tier of usableTiers) {
            if (tier.price === '' || Number.isNaN(Number(tier.price)) || Number(tier.price) < 0) {
                return `Set a valid price for "${tier.name}". Use 0 for a free ticket.`
            }
        }
        // Publishing is what makes the event visible to every customer, so
        // the completeness check is applied here rather than on every save.
        if (form.status === 'published' && !form.poster_url.trim()) {
            return 'A published event needs a poster image.'
        }
        return null
    }

    const handleSave = async () => {
        const problem = validate()
        if (problem) {
            setFeedback({ type: 'error', text: problem })
            return
        }

        // validate() already required this, but it also narrows the type for
        // the insert below, where starts_at is NOT NULL.
        const startsAtUtc = zonedInputToUtc(form.starts_at, form.timezone)
        if (!startsAtUtc) {
            setFeedback({ type: 'error', text: 'That start date could not be read. Please re-enter it.' })
            return
        }

        setSaving(true)
        setFeedback(null)

        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim() || null,
                category: form.category.trim() || null,
                poster_url: form.poster_url.trim() || null,
                host_name: form.host_name.trim() || null,
                host_logo_url: form.host_logo_url.trim() || null,
                venue_name: form.venue_name.trim() || null,
                address: form.address.trim() || null,
                city: form.city.trim() || null,
                event_type: form.event_type,
                timezone: form.timezone,
                starts_at: startsAtUtc,
                ends_at: zonedInputToUtc(form.ends_at, form.timezone),
                sales_end_at: zonedInputToUtc(form.sales_end_at, form.timezone),
                status: form.status,
                is_featured: form.is_featured,
                capacity: form.capacity ? Number(form.capacity) : null,
                updated_at: new Date().toISOString(),
            }

            let eventId = id as string

            if (isNew) {
                const { data, error } = await supabase
                    .from('events')
                    .insert(payload)
                    .select('id')
                    .single()
                if (error) throw error
                eventId = data.id
            } else {
                const { error } = await supabase.from('events').update(payload).eq('id', eventId)
                if (error) throw error
            }

            if (deletedTierIds.length > 0) {
                const { error } = await supabase
                    .from('event_ticket_tiers')
                    .delete()
                    .in('id', deletedTierIds)
                if (error) throw error
                setDeletedTierIds([])
            }

            const usable = tiers
                .filter(tier => tier.name.trim())
                .map((tier, index) => ({
                    id: tier.id,
                    body: {
                        event_id: eventId,
                        name: tier.name.trim(),
                        description: tier.description.trim() || null,
                        perks: tier.perks
                            .split('\n')
                            .map(perk => perk.trim())
                            .filter(Boolean),
                        price: Number(tier.price),
                        quantity_total: tier.quantity_total ? Number(tier.quantity_total) : null,
                        max_per_order: Number(tier.max_per_order) || 10,
                        sort_order: index,
                        is_active: tier.is_active,
                        updated_at: new Date().toISOString(),
                    },
                }))

            // Inserts and updates are issued separately, NOT as one upsert.
            // A single bulk upsert would have to carry `id` on saved tiers
            // and omit it on new ones, and PostgREST rejects a bulk payload
            // whose objects do not all share the same keys ("All object keys
            // must match"). That only bites once an event has both -- i.e.
            // the first time somebody adds a ticket type to a live event,
            // which is exactly when it must not fail.
            //
            // Existing tiers are UPDATEd rather than recreated: quantity_sold
            // lives on these rows, and reinserting them would wipe the record
            // of every ticket sold and every live hold.
            const newTiers = usable.filter(tier => !tier.id).map(tier => tier.body)
            if (newTiers.length > 0) {
                const { error } = await supabase.from('event_ticket_tiers').insert(newTiers)
                if (error) throw error
            }

            for (const tier of usable.filter(tier => tier.id)) {
                const { error } = await supabase
                    .from('event_ticket_tiers')
                    .update(tier.body)
                    .eq('id', tier.id as string)
                if (error) throw error
            }

            navigate('/events')
        } catch (err) {
            console.error('Error saving event:', err)
            const message = err instanceof Error ? err.message : 'Unknown error'
            setFeedback({ type: 'error', text: `Could not save: ${message}` })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <MainLayout>
                <div className="flex items-center justify-center py-20 text-sm text-gray-400">
                    Loading event...
                </div>
            </MainLayout>
        )
    }

    const inputClass =
        'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#FF6E15] focus:outline-none'
    const labelClass = 'block text-xs font-semibold text-gray-500 mb-1.5'

    return (
        <MainLayout>
            <div className="space-y-6 max-w-4xl">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/events')}
                        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isNew ? 'New event' : 'Edit event'}
                        </h1>
                        <p className="text-gray-500 text-sm mt-1">
                            Published events appear in the customer app immediately.
                        </p>
                    </div>
                </div>

                {feedback && (
                    <div
                        className={
                            feedback.type === 'error'
                                ? 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
                                : 'rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700'
                        }
                    >
                        {feedback.text}
                    </div>
                )}

                {/* Details */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-6 space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900">Details</h2>

                        <div>
                            <label className={labelClass}>Title</label>
                            <input
                                className={inputClass}
                                value={form.title}
                                onChange={e => setField('title', e.target.value)}
                                placeholder="Sporting Lagos vs Abia Warriors: NPFL"
                            />
                        </div>

                        <div>
                            <label className={labelClass}>Description</label>
                            <textarea
                                className={`${inputClass} min-h-[120px]`}
                                value={form.description}
                                onChange={e => setField('description', e.target.value)}
                                placeholder="What the customer sees under 'About this event'."
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className={labelClass}>Category</label>
                                <input
                                    className={inputClass}
                                    value={form.category}
                                    onChange={e => setField('category', e.target.value)}
                                    placeholder="Sports, Festival, Networking..."
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Type</label>
                                <select
                                    className={inputClass}
                                    value={form.event_type}
                                    onChange={e => setField('event_type', e.target.value as EventType)}
                                >
                                    <option value="physical">Physical</option>
                                    <option value="online">Online</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Poster image</label>
                            <div className="flex flex-wrap items-center gap-3">
                                {form.poster_url && (
                                    <img
                                        src={form.poster_url}
                                        alt=""
                                        className="h-16 w-28 rounded object-cover"
                                    />
                                )}
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                                    <Upload className="h-4 w-4" />
                                    {uploading === 'poster' ? 'Uploading...' : 'Upload'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={e => {
                                            const file = e.target.files?.[0]
                                            if (file) void handleUpload(file, 'poster')
                                        }}
                                    />
                                </label>
                                <input
                                    className={`${inputClass} flex-1 min-w-[200px]`}
                                    value={form.poster_url}
                                    onChange={e => setField('poster_url', e.target.value)}
                                    placeholder="or paste an image URL"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* When and where */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-6 space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900">When &amp; where</h2>

                        <div>
                            <label className={labelClass}>Timezone</label>
                            <select
                                className={inputClass}
                                value={form.timezone}
                                onChange={e => setField('timezone', e.target.value)}
                            >
                                {TIMEZONES.map(zone => (
                                    <option key={zone} value={zone}>
                                        {zone}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-400">
                                All times below are entered and displayed in this zone.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                            <div>
                                <label className={labelClass}>Starts</label>
                                <input
                                    type="datetime-local"
                                    className={inputClass}
                                    value={form.starts_at}
                                    onChange={e => setField('starts_at', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Ends (optional)</label>
                                <input
                                    type="datetime-local"
                                    className={inputClass}
                                    value={form.ends_at}
                                    onChange={e => setField('ends_at', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Sales close (optional)</label>
                                <input
                                    type="datetime-local"
                                    className={inputClass}
                                    value={form.sales_end_at}
                                    onChange={e => setField('sales_end_at', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className={labelClass}>Venue name</label>
                                <input
                                    className={inputClass}
                                    value={form.venue_name}
                                    onChange={e => setField('venue_name', e.target.value)}
                                    placeholder="Onikan Stadium"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>City</label>
                                <input
                                    className={inputClass}
                                    value={form.city}
                                    onChange={e => setField('city', e.target.value)}
                                    placeholder="Lagos"
                                />
                            </div>
                        </div>

                        <div>
                            <label className={labelClass}>Address</label>
                            <input
                                className={inputClass}
                                value={form.address}
                                onChange={e => setField('address', e.target.value)}
                                placeholder="Tafawa Balewa Square, Lagos Island 102273, Lagos, Nigeria"
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className={labelClass}>Host name</label>
                                <input
                                    className={inputClass}
                                    value={form.host_name}
                                    onChange={e => setField('host_name', e.target.value)}
                                    placeholder="Sporting Lagos"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Host logo</label>
                                <div className="flex items-center gap-3">
                                    {form.host_logo_url && (
                                        <img
                                            src={form.host_logo_url}
                                            alt=""
                                            className="h-9 w-9 rounded-full object-cover"
                                        />
                                    )}
                                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">
                                        <Upload className="h-4 w-4" />
                                        {uploading === 'host' ? 'Uploading...' : 'Upload'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={e => {
                                                const file = e.target.files?.[0]
                                                if (file) void handleUpload(file, 'host')
                                            }}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Ticket tiers */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-gray-900">Ticket types</h2>
                            <button
                                onClick={() => setTiers(prev => [...prev, { ...EMPTY_TIER }])}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#FF6E15] hover:underline"
                            >
                                <Plus className="h-4 w-4" />
                                Add type
                            </button>
                        </div>

                        {tiers.map((tier, index) => (
                            <div key={index} className="rounded-lg border border-gray-200 p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                        <label className={labelClass}>Name</label>
                                        <input
                                            className={inputClass}
                                            value={tier.name}
                                            onChange={e => setTierField(index, 'name', e.target.value)}
                                            placeholder="Standard Ticket"
                                        />
                                    </div>
                                    <button
                                        onClick={() => removeTier(index)}
                                        className="mt-6 rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                        title="Remove ticket type"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>

                                <div>
                                    <label className={labelClass}>Description</label>
                                    <input
                                        className={inputClass}
                                        value={tier.description}
                                        onChange={e => setTierField(index, 'description', e.target.value)}
                                        placeholder="Standard seat for the 26/27 season."
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>Perks (one per line)</label>
                                    <textarea
                                        className={`${inputClass} min-h-[70px]`}
                                        value={tier.perks}
                                        onChange={e => setTierField(index, 'perks', e.target.value)}
                                        placeholder={'Complimentary Water & Drinks\nSporting Lagos flags and vuvuzelas'}
                                    />
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                    <div>
                                        <label className={labelClass}>Price (₦)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className={inputClass}
                                            value={tier.price}
                                            onChange={e => setTierField(index, 'price', e.target.value)}
                                            placeholder="1075"
                                        />
                                        <p className="mt-1 text-xs text-gray-400">0 = free ticket</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Quantity</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className={inputClass}
                                            value={tier.quantity_total}
                                            onChange={e => setTierField(index, 'quantity_total', e.target.value)}
                                            placeholder="Unlimited"
                                        />
                                        <p className="mt-1 text-xs text-gray-400">Blank = unlimited</p>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Max per order</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className={inputClass}
                                            value={tier.max_per_order}
                                            onChange={e => setTierField(index, 'max_per_order', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <label className="flex items-center gap-2 text-sm text-gray-600">
                                    <input
                                        type="checkbox"
                                        checked={tier.is_active}
                                        onChange={e => setTierField(index, 'is_active', e.target.checked)}
                                    />
                                    On sale
                                </label>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Publishing */}
                <Card className="border-none shadow-sm">
                    <CardContent className="p-6 space-y-4">
                        <h2 className="text-sm font-semibold text-gray-900">Publishing</h2>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className={labelClass}>Status</label>
                                <select
                                    className={inputClass}
                                    value={form.status}
                                    onChange={e => setField('status', e.target.value as EventStatus)}
                                >
                                    <option value="draft">Draft</option>
                                    <option value="published">Published</option>
                                    <option value="cancelled">Cancelled</option>
                                    <option value="archived">Archived</option>
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>Total capacity (optional)</label>
                                <input
                                    type="number"
                                    min="1"
                                    className={inputClass}
                                    value={form.capacity}
                                    onChange={e => setField('capacity', e.target.value)}
                                    placeholder="Blank = per-type limits only"
                                />
                            </div>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-gray-600">
                            <input
                                type="checkbox"
                                checked={form.is_featured}
                                onChange={e => setField('is_featured', e.target.checked)}
                            />
                            Show in the customer app&apos;s &quot;Featured events&quot; carousel
                        </label>
                    </CardContent>
                </Card>

                <div className="flex items-center gap-3 pb-10">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-lg bg-[#FF6E15] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e56212] disabled:opacity-60"
                    >
                        {saving ? 'Saving...' : isNew ? 'Create event' : 'Save changes'}
                    </button>
                    <button
                        onClick={() => navigate('/events')}
                        className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </MainLayout>
    )
}
