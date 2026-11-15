import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ImagePlus, Link2, Loader2, Trash2 } from 'lucide-react'
import MainLayout from '../../../components/layout/MainLayout'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Input } from '../../../components/ui/input'
import { supabase } from '../../../lib/supabase'
import type { Json } from '../../../lib/database.types'

type TabKey = 'profile' | 'security' | 'commission' | 'marketing' | 'referral' | 'parcel'

type BannerSlideForm = {
    enabled: boolean
    imageUrl: string
    title: string
    subtitle: string
    ctaLabel: string
    target: string
}

type SettingsFormState = {
    restaurantCommissionRate: string
    riderCommissionRate: string
    minDeliveryFee: string
    deliveryFeePerKm: string
    serviceChargeFlat: string
    takeawayPackFee: string
    maxDeliveryRadiusKm: string
    businessName: string
    businessEmail: string
    businessPhone: string
    businessAddress: string
    customerHomeBannerEnabled: boolean
    customerHomeBannerAutoSlideSeconds: string
    customerHomeBanners: BannerSlideForm[]
    referralEnabled: boolean
    referralReferrerReward: string
    referralRefereeBonus: string
    referralMinOrderValue: string
    parcelDeliveryEnabled: boolean
    parcelBaseFee: string
    parcelFeePerKm: string
    parcelMinFee: string
    parcelSizeMultiplierSm: string
    parcelSizeMultiplierMd: string
    parcelSizeMultiplierLg: string
    parcelMaxDistanceKm: string
}

const DEFAULT_BANNER_SLIDES: BannerSlideForm[] = [
    {
        enabled: true,
        imageUrl: '',
        title: 'Get 10% off on orders above',
        subtitle: 'N50,000',
        ctaLabel: 'Order now',
        target: '/all-restaurants',
    },
    {
        enabled: false,
        imageUrl: '',
        title: 'Free delivery on selected orders',
        subtitle: 'Limited time offer',
        ctaLabel: 'View deals',
        target: '/search',
    },
    {
        enabled: false,
        imageUrl: '',
        title: 'Discover top restaurants near you',
        subtitle: 'Fresh picks around you',
        ctaLabel: 'Browse now',
        target: '/all-restaurants',
    },
]

const createDefaultBannerSlides = () => DEFAULT_BANNER_SLIDES.map(slide => ({ ...slide }))

const normalizeAutoSlideSeconds = (value: string, fallback = 2) => {
    const parsed = Math.trunc(parseNumberInput(value, fallback))
    return Math.min(30, Math.max(1, parsed))
}

const buildDefaultForm = (): SettingsFormState => ({
    restaurantCommissionRate: '15',
    riderCommissionRate: '80',
    minDeliveryFee: '500',
    deliveryFeePerKm: '300',
    serviceChargeFlat: '300',
    takeawayPackFee: '200',
    maxDeliveryRadiusKm: '20',
    businessName: 'Foodnest Nigeria',
    businessEmail: 'hello@foodnest.com',
    businessPhone: '08160670199',
    businessAddress: '1, Enugu state',
    customerHomeBannerEnabled: true,
    customerHomeBannerAutoSlideSeconds: '2',
    customerHomeBanners: createDefaultBannerSlides(),
    referralEnabled: true,
    referralReferrerReward: '500',
    referralRefereeBonus: '300',
    referralMinOrderValue: '1000',
    // Mirrors the column defaults in 20260925120000_parcel_delivery.sql.
    parcelDeliveryEnabled: true,
    parcelBaseFee: '700',
    parcelFeePerKm: '300',
    parcelMinFee: '700',
    parcelSizeMultiplierSm: '1',
    parcelSizeMultiplierMd: '1.3',
    parcelSizeMultiplierLg: '1.7',
    parcelMaxDistanceKm: '30',
})

const parseNumberInput = (value: string, fallback: number) => {
    const parsed = Number(value.replace(/,/g, '').trim())
    return Number.isFinite(parsed) ? parsed : fallback
}

const normalizeOptionalText = (value: string) => {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

const parseBannerSlide = (value: unknown, fallback: BannerSlideForm): BannerSlideForm => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ...fallback }
    }

    const source = value as Record<string, unknown>
    const readString = (...keys: string[]) => {
        for (const key of keys) {
            const candidate = source[key]
            if (typeof candidate === 'string') {
                return candidate
            }
        }
        return undefined
    }

    return {
        enabled: typeof source.enabled === 'boolean' ? source.enabled : fallback.enabled,
        imageUrl: readString('imageUrl', 'image_url') ?? fallback.imageUrl,
        title: readString('title') ?? fallback.title,
        subtitle: readString('subtitle') ?? fallback.subtitle,
        ctaLabel: readString('ctaLabel', 'cta_label') ?? fallback.ctaLabel,
        target: readString('target') ?? fallback.target,
    }
}

const normalizeBannerSlides = (value: unknown, legacyPrimaryBanner?: Partial<BannerSlideForm>) => {
    const defaults = createDefaultBannerSlides()

    if (Array.isArray(value) && value.length > 0) {
        return defaults.map((defaultSlide, index) => parseBannerSlide(value[index], defaultSlide))
    }

    if (legacyPrimaryBanner) {
        defaults[0] = {
            ...defaults[0],
            ...legacyPrimaryBanner,
            enabled: legacyPrimaryBanner.enabled ?? defaults[0].enabled,
        }
    }

    return defaults
}

const serializeBannerSlides = (slides: BannerSlideForm[]): Json =>
    slides.map(slide => ({
        enabled: slide.enabled,
        imageUrl: normalizeOptionalText(slide.imageUrl),
        title: normalizeOptionalText(slide.title),
        subtitle: normalizeOptionalText(slide.subtitle),
        ctaLabel: normalizeOptionalText(slide.ctaLabel),
        target: normalizeOptionalText(slide.target),
    }))

const getPrimaryBanner = (slides: BannerSlideForm[]) => {
    return slides.find(slide => slide.enabled) ?? slides[0] ?? DEFAULT_BANNER_SLIDES[0]
}

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('profile')
    const [form, setForm] = useState<SettingsFormState>(buildDefaultForm())
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploadingBannerSlideIndex, setUploadingBannerSlideIndex] = useState<number | null>(null)
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const bannerFileInputRefs = useRef<Array<HTMLInputElement | null>>([])

    useEffect(() => {
        void loadSettings()
    }, [])

    const loadSettings = async () => {
        const defaultForm = buildDefaultForm()
        setLoading(true)
        setFeedback(null)

        try {
            const { data, error } = await supabase
                .from('system_settings')
                .select('*')
                .eq('id', 1)
                .maybeSingle()

            if (error) {
                throw error
            }

            if (!data) {
                setForm(defaultForm)
                return
            }

            setForm({
                restaurantCommissionRate: String(data.restaurant_commission_rate ?? defaultForm.restaurantCommissionRate),
                riderCommissionRate: String(data.rider_commission_rate ?? defaultForm.riderCommissionRate),
                minDeliveryFee: String(data.min_delivery_fee ?? defaultForm.minDeliveryFee),
deliveryFeePerKm: String(data.delivery_fee_per_km ?? defaultForm.deliveryFeePerKm),
                serviceChargeFlat: String(data.service_charge_flat ?? defaultForm.serviceChargeFlat),
                takeawayPackFee: String(data.takeaway_pack_fee ?? defaultForm.takeawayPackFee),
                maxDeliveryRadiusKm: String(data.max_delivery_radius_km ?? defaultForm.maxDeliveryRadiusKm),
                businessName: data.business_name ?? defaultForm.businessName,
                businessEmail: data.business_email ?? defaultForm.businessEmail,
                businessPhone: data.business_phone ?? defaultForm.businessPhone,
                businessAddress: data.business_address ?? defaultForm.businessAddress,
                customerHomeBannerEnabled: data.customer_home_banner_enabled ?? defaultForm.customerHomeBannerEnabled,
                customerHomeBannerAutoSlideSeconds: String(data.customer_home_banner_auto_slide_seconds ?? defaultForm.customerHomeBannerAutoSlideSeconds),
                customerHomeBanners: normalizeBannerSlides(data.customer_home_banners, {
                    enabled: data.customer_home_banner_enabled ?? defaultForm.customerHomeBannerEnabled,
                    imageUrl: data.customer_home_banner_image_url ?? defaultForm.customerHomeBanners[0].imageUrl,
                    title: data.customer_home_banner_title ?? defaultForm.customerHomeBanners[0].title,
                    subtitle: data.customer_home_banner_subtitle ?? defaultForm.customerHomeBanners[0].subtitle,
                    ctaLabel: data.customer_home_banner_cta_label ?? defaultForm.customerHomeBanners[0].ctaLabel,
                    target: data.customer_home_banner_target ?? defaultForm.customerHomeBanners[0].target,
                }),
                referralEnabled: data.referral_enabled ?? defaultForm.referralEnabled,
                referralReferrerReward: String(data.referral_referrer_reward ?? defaultForm.referralReferrerReward),
                referralRefereeBonus: String(data.referral_referee_bonus ?? defaultForm.referralRefereeBonus),
                referralMinOrderValue: String(data.referral_min_order_value ?? defaultForm.referralMinOrderValue),
                parcelDeliveryEnabled: data.parcel_delivery_enabled ?? defaultForm.parcelDeliveryEnabled,
                parcelBaseFee: String(data.parcel_base_fee ?? defaultForm.parcelBaseFee),
                parcelFeePerKm: String(data.parcel_fee_per_km ?? defaultForm.parcelFeePerKm),
                parcelMinFee: String(data.parcel_min_fee ?? defaultForm.parcelMinFee),
                parcelSizeMultiplierSm: String(data.parcel_size_multiplier_sm ?? defaultForm.parcelSizeMultiplierSm),
                parcelSizeMultiplierMd: String(data.parcel_size_multiplier_md ?? defaultForm.parcelSizeMultiplierMd),
                parcelSizeMultiplierLg: String(data.parcel_size_multiplier_lg ?? defaultForm.parcelSizeMultiplierLg),
                parcelMaxDistanceKm: String(data.parcel_max_distance_km ?? defaultForm.parcelMaxDistanceKm),
            })
        } catch (error) {
            console.error('Error loading system settings:', error)
            setFeedback({ type: 'error', text: 'Unable to load system settings right now.' })
        } finally {
            setLoading(false)
        }
    }

    const updateField = <K extends keyof SettingsFormState>(field: K, value: SettingsFormState[K]) => {
        setForm(prev => ({ ...prev, [field]: value }))
        if (feedback) {
            setFeedback(null)
        }
    }

    const updateBannerSlide = <K extends keyof BannerSlideForm>(index: number, field: K, value: BannerSlideForm[K]) => {
        setForm(prev => ({
            ...prev,
            customerHomeBanners: prev.customerHomeBanners.map((slide, slideIndex) =>
                slideIndex === index
                    ? { ...slide, [field]: value }
                    : slide
            ),
        }))

        if (feedback) {
            setFeedback(null)
        }
    }

    const setBannerSlideImage = (index: number, imageUrl: string) => {
        setForm(prev => ({
            ...prev,
            customerHomeBanners: prev.customerHomeBanners.map((slide, slideIndex) => {
                if (slideIndex !== index) {
                    return slide
                }

                const trimmedImageUrl = imageUrl.trim()
                return {
                    ...slide,
                    imageUrl,
                    enabled: trimmedImageUrl ? true : slide.enabled,
                }
            }),
        }))

        if (feedback) {
            setFeedback(null)
        }
    }

    const saveSettings = async () => {
        setSaving(true)
        setFeedback(null)

        try {
            const primaryBanner = getPrimaryBanner(form.customerHomeBanners)
            const bannerAutoSlideSeconds = normalizeAutoSlideSeconds(form.customerHomeBannerAutoSlideSeconds)
            const payload = {
                id: 1,
                restaurant_commission_rate: parseNumberInput(form.restaurantCommissionRate, 15),
                rider_commission_rate: parseNumberInput(form.riderCommissionRate, 80),
                min_delivery_fee: parseNumberInput(form.minDeliveryFee, 500),
                delivery_fee_per_km: parseNumberInput(form.deliveryFeePerKm, 300),
                service_charge_flat: parseNumberInput(form.serviceChargeFlat, 300),
                takeaway_pack_fee: parseNumberInput(form.takeawayPackFee, 200),
                max_delivery_radius_km: Math.max(0, Math.trunc(parseNumberInput(form.maxDeliveryRadiusKm, 20))),
                business_name: form.businessName.trim() || buildDefaultForm().businessName,
                business_email: form.businessEmail.trim() || buildDefaultForm().businessEmail,
                business_phone: form.businessPhone.trim() || buildDefaultForm().businessPhone,
                business_address: form.businessAddress.trim() || buildDefaultForm().businessAddress,
                customer_home_banner_enabled: form.customerHomeBannerEnabled,
                customer_home_banner_image_url: normalizeOptionalText(primaryBanner.imageUrl),
                customer_home_banner_title: normalizeOptionalText(primaryBanner.title),
                customer_home_banner_subtitle: normalizeOptionalText(primaryBanner.subtitle),
                customer_home_banner_cta_label: normalizeOptionalText(primaryBanner.ctaLabel),
                customer_home_banner_target: normalizeOptionalText(primaryBanner.target),
                customer_home_banner_auto_slide_seconds: bannerAutoSlideSeconds,
                customer_home_banners: serializeBannerSlides(form.customerHomeBanners),
                referral_enabled: form.referralEnabled,
                referral_referrer_reward: parseNumberInput(form.referralReferrerReward, 500),
                referral_referee_bonus: parseNumberInput(form.referralRefereeBonus, 300),
                referral_min_order_value: parseNumberInput(form.referralMinOrderValue, 1000),
                parcel_delivery_enabled: form.parcelDeliveryEnabled,
                parcel_base_fee: parseNumberInput(form.parcelBaseFee, 700),
                parcel_fee_per_km: parseNumberInput(form.parcelFeePerKm, 300),
                parcel_min_fee: parseNumberInput(form.parcelMinFee, 700),
                // Multipliers, not fees: 1 means "price this size like distance
                // alone". Floored at 1 so a size band can never make a parcel
                // cheaper than the base trip.
                parcel_size_multiplier_sm: Math.max(1, parseNumberInput(form.parcelSizeMultiplierSm, 1)),
                parcel_size_multiplier_md: Math.max(1, parseNumberInput(form.parcelSizeMultiplierMd, 1.3)),
                parcel_size_multiplier_lg: Math.max(1, parseNumberInput(form.parcelSizeMultiplierLg, 1.7)),
                parcel_max_distance_km: parseNumberInput(form.parcelMaxDistanceKm, 30),
            }

            const { error } = await supabase
                .from('system_settings')
                .upsert(payload, { onConflict: 'id' })

            if (error) {
                throw error
            }

            setFeedback({ type: 'success', text: 'Carousel slides saved successfully.' })
        } catch (error) {
            console.error('Error saving system settings:', error)
            setFeedback({ type: 'error', text: 'Could not save the advert carousel. Check database permissions and try again.' })
        } finally {
            setSaving(false)
        }
    }

    const handleBannerImageUpload = async (slideIndex: number, event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        event.target.value = ''

        if (!file) {
            return
        }

        if (!file.type.startsWith('image/')) {
            setFeedback({ type: 'error', text: 'Please choose an image file for this slide.' })
            return
        }

        const maxBytes = 5 * 1024 * 1024
        if (file.size > maxBytes) {
            setFeedback({ type: 'error', text: 'Banner image must be 5MB or smaller.' })
            return
        }

        setUploadingBannerSlideIndex(slideIndex)
        setFeedback(null)

        try {
            const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
            const filePath = `marketing/customer-home-banner-slide-${slideIndex + 1}-${Date.now()}-${sanitizedName}`

            const { error: uploadError } = await supabase.storage
                .from('public')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: true,
                })

            if (uploadError) {
                throw uploadError
            }

            const { data } = supabase.storage.from('public').getPublicUrl(filePath)
            setBannerSlideImage(slideIndex, data.publicUrl)
            setFeedback({ type: 'success', text: `Slide ${slideIndex + 1} image uploaded. Save settings to publish the carousel.` })
        } catch (error) {
            console.error('Error uploading banner image:', error)
            setFeedback({ type: 'error', text: `Could not upload slide ${slideIndex + 1}. You can still paste an image link manually.` })
        } finally {
            setUploadingBannerSlideIndex(null)
        }
    }

    const enabledSlidesCount = form.customerHomeBanners.filter(slide => slide.enabled).length
    const bannerAutoSlideSeconds = normalizeAutoSlideSeconds(form.customerHomeBannerAutoSlideSeconds)

    return (
        <MainLayout>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">System settings</h1>
                        <p className="text-gray-500 text-sm">Manage payout defaults, delivery rules, service charge pricing, and the customer home advert carousel.</p>
                    </div>
                    <Button
                        className="bg-[#FF6E15] hover:bg-[#FF6E15]/90 text-white w-full sm:w-auto"
                        onClick={saveSettings}
                        disabled={loading || saving}
                    >
                        {saving ? 'Saving...' : 'Save settings'}
                    </Button>
                </div>

                {feedback && (
                    <div
                        className={`rounded-lg border px-4 py-3 text-sm ${feedback.type === 'success'
                            ? 'border-green-200 bg-green-50 text-green-700'
                            : 'border-red-200 bg-red-50 text-red-700'
                            }`}
                    >
                        {feedback.text}
                    </div>
                )}

                <div className="bg-gray-50 rounded-lg p-1.5 inline-flex w-full sm:w-auto">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'profile'
                            ? 'bg-[#FF6E15] text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Profile
                    </button>
                    <button
                        onClick={() => setActiveTab('security')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'security'
                            ? 'bg-[#FF6E15] text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Security
                    </button>
                    <button
                        onClick={() => setActiveTab('commission')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'commission'
                            ? 'bg-[#FF6E15] text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Commission
                    </button>
                    <button
                        onClick={() => setActiveTab('marketing')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'marketing'
                            ? 'bg-[#FF6E15] text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Marketing
                    </button>
                    <button
                        onClick={() => setActiveTab('referral')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'referral'
                            ? 'bg-[#FF6E15] text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Referral
                    </button>
                    <button
                        onClick={() => setActiveTab('parcel')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'parcel'
                            ? 'bg-[#FF6E15] text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        Parcel
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {activeTab === 'parcel' ? (
                        <>
                            <Card className="border-none shadow-sm h-full">
                                <CardContent className="p-6 space-y-6">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">Parcel delivery</h2>
                                        <p className="mt-2 text-sm text-gray-500">
                                            Customers pin a pickup and a drop-off and one of our riders carries the item. No restaurant is involved, so the whole price is the delivery fee and the rider is paid from it at the usual commission rate.
                                        </p>
                                    </div>

                                    <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Enable parcel delivery</p>
                                            <p className="mt-1 text-xs text-gray-500">Turn this off to hide the entry point in the customer app and stop new bookings. Parcels already in progress are unaffected.</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 accent-[#FF6E15]"
                                            checked={form.parcelDeliveryEnabled}
                                            onChange={(event) => updateField('parcelDeliveryEnabled', event.target.checked)}
                                            disabled={loading}
                                        />
                                    </label>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Base fee (naira)</label>
                                        <Input
                                            value={form.parcelBaseFee}
                                            onChange={(event) => updateField('parcelBaseFee', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="50"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Charged before distance. Higher than the food base fee because the rider travels to the pickup first.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Per kilometre (naira)</label>
                                        <Input
                                            value={form.parcelFeePerKm}
                                            onChange={(event) => updateField('parcelFeePerKm', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="50"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Applied to the straight-line distance between the two pins.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Minimum fee (naira)</label>
                                        <Input
                                            value={form.parcelMinFee}
                                            onChange={(event) => updateField('parcelMinFee', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="50"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            No parcel is ever priced below this, however short the trip.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Maximum distance (km)</label>
                                        <Input
                                            value={form.parcelMaxDistanceKm}
                                            onChange={(event) => updateField('parcelMaxDistanceKm', event.target.value)}
                                            type="number"
                                            min="1"
                                            step="1"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Trips longer than this are refused at booking, with the distance shown to the customer.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm h-full">
                                <CardContent className="p-6 space-y-6">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">Size multipliers</h2>
                                        <p className="mt-2 text-sm text-gray-500">
                                            A multiplier on the whole fee, not a flat surcharge — so a long trip with a large parcel scales instead of being swallowed by the distance.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Small (documents, phone, keys)</label>
                                        <Input
                                            value={form.parcelSizeMultiplierSm}
                                            onChange={(event) => updateField('parcelSizeMultiplierSm', event.target.value)}
                                            type="number"
                                            min="1"
                                            step="0.05"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Medium (shoebox, backpack)</label>
                                        <Input
                                            value={form.parcelSizeMultiplierMd}
                                            onChange={(event) => updateField('parcelSizeMultiplierMd', event.target.value)}
                                            type="number"
                                            min="1"
                                            step="0.05"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Large (small appliance, big carton)</label>
                                        <Input
                                            value={form.parcelSizeMultiplierLg}
                                            onChange={(event) => updateField('parcelSizeMultiplierLg', event.target.value)}
                                            type="number"
                                            min="1"
                                            step="0.05"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>

                                    <div className="rounded-lg border border-orange-100 bg-orange-50 p-4 text-sm text-orange-800 space-y-2">
                                        <p className="font-medium">Worked example</p>
                                        <p className="text-orange-700">
                                            A 5 km medium parcel costs{' '}
                                            <span className="font-semibold">
                                                ₦{Math.max(
                                                    parseNumberInput(form.parcelMinFee, 700),
                                                    Math.round(
                                                        (parseNumberInput(form.parcelBaseFee, 700)
                                                            + 5 * parseNumberInput(form.parcelFeePerKm, 300))
                                                        * Math.max(1, parseNumberInput(form.parcelSizeMultiplierMd, 1.3))
                                                    )
                                                ).toLocaleString()}
                                            </span>
                                            . The rider keeps{' '}
                                            <span className="font-semibold">
                                                {parseNumberInput(form.riderCommissionRate, 80)}%
                                            </span>{' '}
                                            of that, as on any delivery.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : activeTab === 'referral' ? (
                        <>
                            <Card className="border-none shadow-sm h-full">
                                <CardContent className="p-6 space-y-6">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">Referral program</h2>
                                        <p className="mt-2 text-sm text-gray-500">
                                            When a referred customer completes their first order, both the referrer and the new customer receive wallet credits.
                                        </p>
                                    </div>

                                    <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Enable referral program</p>
                                            <p className="mt-1 text-xs text-gray-500">Turn this off to pause all new referral rewards. Existing wallets are unaffected.</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 accent-[#FF6E15]"
                                            checked={form.referralEnabled}
                                            onChange={(event) => updateField('referralEnabled', event.target.checked)}
                                            disabled={loading}
                                        />
                                    </label>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Referrer reward (naira)</label>
                                        <Input
                                            value={form.referralReferrerReward}
                                            onChange={(event) => updateField('referralReferrerReward', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="50"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Credited to the referrer's wallet after the new user's first order is delivered.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Referee welcome bonus (naira)</label>
                                        <Input
                                            value={form.referralRefereeBonus}
                                            onChange={(event) => updateField('referralRefereeBonus', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="50"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Credited to the new customer's wallet after their first delivered order.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Minimum qualifying order value (naira)</label>
                                        <Input
                                            value={form.referralMinOrderValue}
                                            onChange={(event) => updateField('referralMinOrderValue', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="100"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Orders below this amount do not trigger referral rewards. Helps prevent abuse with low-value test orders.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm h-full">
                                <CardContent className="p-6 space-y-4">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">How it works</h2>
                                    </div>

                                    <div className="rounded-lg border border-orange-100 bg-orange-50 p-4 text-sm text-orange-800 space-y-2">
                                        <p className="font-medium">Reward flow</p>
                                        <ol className="list-decimal list-inside space-y-1 text-orange-700">
                                            <li>Customer shares their unique referral code.</li>
                                            <li>New user enters the code at signup.</li>
                                            <li>New user places and completes their first order.</li>
                                            <li>Both wallets are credited automatically.</li>
                                        </ol>
                                    </div>

                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 space-y-2">
                                        <p className="font-medium text-gray-900">Current reward summary</p>
                                        <p>Referrer earns <span className="font-semibold text-gray-900">₦{parseNumberInput(form.referralReferrerReward, 500).toLocaleString()}</span> per successful referral.</p>
                                        <p>Referee receives a <span className="font-semibold text-gray-900">₦{parseNumberInput(form.referralRefereeBonus, 300).toLocaleString()}</span> welcome bonus.</p>
                                        <p>Qualifying order minimum: <span className="font-semibold text-gray-900">₦{parseNumberInput(form.referralMinOrderValue, 1000).toLocaleString()}</span>.</p>
                                    </div>

                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                                        <p className="font-medium text-gray-900">View referral activity</p>
                                        <p className="mt-1">Go to the <span className="font-medium text-[#FF6E15]">Referrals</span> page in the sidebar to see all referrals, pending rewards, and total wallet payouts.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : activeTab === 'commission' ? (
                        <>
                            <Card className="border-none shadow-sm h-full">
                                <CardContent className="p-6 space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Restaurant commission %</label>
                                        <Input
                                            value={form.restaurantCommissionRate}
                                            onChange={(event) => updateField('restaurantCommissionRate', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Rider commission %</label>
                                        <Input
                                            value={form.riderCommissionRate}
                                            onChange={(event) => updateField('riderCommissionRate', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Minimum delivery fee (naira)</label>
                                        <Input
                                            value={form.minDeliveryFee}
                                            onChange={(event) => updateField('minDeliveryFee', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            The delivery fee will not go below this amount.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery fee per km (naira)</label>
                                        <Input
                                            value={form.deliveryFeePerKm}
                                            onChange={(event) => updateField('deliveryFeePerKm', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Delivery fee = distance × per-km rate. E.g. 3 km × ₦{form.deliveryFeePerKm || '300'} = ₦{(3 * parseFloat(form.deliveryFeePerKm || '300')).toLocaleString()}.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Service charge (naira, flat)</label>
                                        <Input
                                            value={form.serviceChargeFlat}
                                            onChange={(event) => updateField('serviceChargeFlat', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Customers pay a flat <span className="font-medium">₦{form.serviceChargeFlat || buildDefaultForm().serviceChargeFlat}</span> service charge per order.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Takeaway pack fee (naira, flat)</label>
                                        <Input
                                            value={form.takeawayPackFee}
                                            onChange={(event) => updateField('takeawayPackFee', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Customers pay a flat <span className="font-medium">₦{form.takeawayPackFee || buildDefaultForm().takeawayPackFee}</span> takeaway pack fee per order.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Max delivery radius (km)</label>
                                        <Input
                                            value={form.maxDeliveryRadiusKm}
                                            onChange={(event) => updateField('maxDeliveryRadiusKm', event.target.value)}
                                            type="number"
                                            min="0"
                                            step="1"
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm h-full">
                                <CardContent className="p-6 space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Business name</label>
                                        <Input
                                            value={form.businessName}
                                            onChange={(event) => updateField('businessName', event.target.value)}
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                                        <Input
                                            value={form.businessEmail}
                                            onChange={(event) => updateField('businessEmail', event.target.value)}
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone number</label>
                                        <Input
                                            value={form.businessPhone}
                                            onChange={(event) => updateField('businessPhone', event.target.value)}
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                                        <Input
                                            value={form.businessAddress}
                                            onChange={(event) => updateField('businessAddress', event.target.value)}
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : activeTab === 'marketing' ? (
                        <>
                            <Card className="border-none shadow-sm h-full">
                                <CardContent className="p-6 space-y-6">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">Customer home advert carousel</h2>
                                        <p className="mt-2 text-sm text-gray-500">
                                            Configure up to 3 slides here. The customer app auto-rotates enabled slides every 2 seconds, and each slide can open an in-app route or an external link.
                                        </p>
                                    </div>

                                    <label className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">Show advert carousel on customer home</p>
                                            <p className="mt-1 text-xs text-gray-500">Turn this off to hide the advert section completely.</p>
                                        </div>
                                        <input
                                            type="checkbox"
                                            className="h-5 w-5 accent-[#FF6E15]"
                                            checked={form.customerHomeBannerEnabled}
                                            onChange={(event) => updateField('customerHomeBannerEnabled', event.target.checked)}
                                            disabled={loading}
                                        />
                                    </label>

                                    <div className="rounded-lg border border-orange-100 bg-orange-50 p-4 text-sm text-orange-800">
                                        <p className="font-medium">Carousel behavior</p>
                                        <p className="mt-1">
                                            Enabled slides rotate every {bannerAutoSlideSeconds} second{bannerAutoSlideSeconds === 1 ? '' : 's'}. If only one slide is enabled, the customer app shows a single static card.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Auto-slide interval (seconds)</label>
                                        <Input
                                            type="number"
                                            min="1"
                                            max="30"
                                            value={form.customerHomeBannerAutoSlideSeconds}
                                            onChange={(event) => updateField('customerHomeBannerAutoSlideSeconds', event.target.value)}
                                            className="bg-white"
                                            disabled={loading}
                                            placeholder="2"
                                        />
                                        <p className="mt-2 text-xs text-gray-500">
                                            Set how many seconds the customer app waits before moving to the next enabled slide. Allowed range: 1 to 30 seconds.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        {form.customerHomeBanners.map((slide, index) => {
                                            const isUploadingThisSlide = uploadingBannerSlideIndex === index

                                            return (
                                                <div key={index} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-4">
                                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                        <div>
                                                            <p className="text-sm font-semibold text-gray-900">Slide {index + 1}</p>
                                                            <p className="mt-1 text-xs text-gray-500">Use a clear landscape image. The customer app shows the artwork full-width with no dark overlay.</p>
                                                        </div>
                                                        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 accent-[#FF6E15]"
                                                                checked={slide.enabled}
                                                                onChange={(event) => updateBannerSlide(index, 'enabled', event.target.checked)}
                                                                disabled={loading || uploadingBannerSlideIndex !== null}
                                                            />
                                                            Enable slide
                                                        </label>
                                                    </div>

                                                    <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/60 p-4">
                                                        <input
                                                            ref={(element) => {
                                                                bannerFileInputRefs.current[index] = element
                                                            }}
                                                            type="file"
                                                            accept="image/*"
                                                            className="hidden"
                                                            onChange={(event) => void handleBannerImageUpload(index, event)}
                                                            disabled={loading || uploadingBannerSlideIndex !== null}
                                                        />
                                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                            <div className="flex items-start gap-3">
                                                                <div className="mt-0.5 rounded-full bg-white p-2 text-[#FF6E15] shadow-sm">
                                                                    <ImagePlus size={18} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-medium text-gray-900">Upload slide image</p>
                                                                    <p className="mt-1 text-xs text-gray-500">Landscape image recommended. Max 5MB.</p>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                type="button"
                                                                className="bg-[#FF6E15] hover:bg-[#FF6E15]/90 text-white w-full sm:w-auto"
                                                                onClick={() => bannerFileInputRefs.current[index]?.click()}
                                                                disabled={loading || uploadingBannerSlideIndex !== null}
                                                            >
                                                                {isUploadingThisSlide ? (
                                                                    <span className="inline-flex items-center gap-2">
                                                                        <Loader2 size={16} className="animate-spin" />
                                                                        Uploading...
                                                                    </span>
                                                                ) : (
                                                                    'Choose image'
                                                                )}
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                                                            <Link2 size={14} />
                                                            Or paste image URL manually
                                                        </label>
                                                        <Input
                                                            value={slide.imageUrl}
                                                            onChange={(event) => setBannerSlideImage(index, event.target.value)}
                                                            className="bg-white"
                                                            disabled={loading || uploadingBannerSlideIndex !== null}
                                                            placeholder="https://..."
                                                        />
                                                        <p className="mt-2 text-xs text-gray-500">
                                                            Uploading fills this automatically, but you can still paste a public image link if needed.
                                                        </p>
                                                    </div>

                                                    {slide.imageUrl.trim() && (
                                                        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                                                            <p className="truncate pr-4 text-xs text-gray-600">{slide.imageUrl}</p>
                                                            <button
                                                                type="button"
                                                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700"
                                                                onClick={() => updateBannerSlide(index, 'imageUrl', '')}
                                                                disabled={loading || uploadingBannerSlideIndex !== null}
                                                            >
                                                                <Trash2 size={14} />
                                                                Clear
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 gap-4">
                                                        <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
                                                            On the customer app, uploaded slides display as the image only. The text fields below are fallback content if no image is set.
                                                        </p>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Heading</label>
                                                            <Input
                                                                value={slide.title}
                                                                onChange={(event) => updateBannerSlide(index, 'title', event.target.value)}
                                                                className="bg-white"
                                                                disabled={loading}
                                                                placeholder="Get 10% off on orders above"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Subtext</label>
                                                            <Input
                                                                value={slide.subtitle}
                                                                onChange={(event) => updateBannerSlide(index, 'subtitle', event.target.value)}
                                                                className="bg-white"
                                                                disabled={loading}
                                                                placeholder="N50,000"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">CTA label</label>
                                                            <Input
                                                                value={slide.ctaLabel}
                                                                onChange={(event) => updateBannerSlide(index, 'ctaLabel', event.target.value)}
                                                                className="bg-white"
                                                                disabled={loading}
                                                                placeholder="Order now"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-medium text-gray-700 mb-1.5">Target route or URL</label>
                                                            <Input
                                                                value={slide.target}
                                                                onChange={(event) => updateBannerSlide(index, 'target', event.target.value)}
                                                                className="bg-white"
                                                                disabled={loading}
                                                                placeholder="/all-restaurants or https://..."
                                                            />
                                                            <p className="mt-2 text-xs text-gray-500">
                                                                Internal routes should start with <span className="font-medium">/</span>. External links should start with <span className="font-medium">https://</span>.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm h-full">
                                <CardContent className="p-6 space-y-4">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
                                        <p className="mt-2 text-sm text-gray-500">
                                            Enabled slides will auto-rotate in the customer app every {bannerAutoSlideSeconds} second{bannerAutoSlideSeconds === 1 ? '' : 's'}. Right now, {enabledSlidesCount} of 3 slides are enabled.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        {form.customerHomeBanners.map((slide, index) => {
                                            const hasImage = slide.imageUrl.trim().length > 0

                                            return (
                                                <div key={index} className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
                                                    <div className={`${hasImage ? 'aspect-[16/7] bg-gray-100' : 'min-h-[180px] bg-[#1A1A1A] p-5 text-white'}`}>
                                                        {hasImage ? (
                                                            <img
                                                                src={slide.imageUrl}
                                                                alt={`Slide ${index + 1}`}
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex h-full items-center justify-between gap-4">
                                                                <div className="max-w-xs space-y-3">
                                                                    {slide.title.trim() && (
                                                                        <p className="text-xl font-semibold leading-tight">{slide.title}</p>
                                                                    )}
                                                                    {slide.subtitle.trim() && (
                                                                        <p className="text-sm text-white/85">{slide.subtitle}</p>
                                                                    )}
                                                                    {slide.ctaLabel.trim() && slide.target.trim() && (
                                                                        <span className="inline-flex items-center rounded-full bg-[#FF6E15] px-4 py-2 text-sm font-medium text-white">
                                                                            {slide.ctaLabel}
                                                                        </span>
                                                                    )}
                                                                    {!slide.title.trim() && !slide.subtitle.trim() && !slide.ctaLabel.trim() && (
                                                                        <p className="text-sm text-white/75">No image uploaded for this slide yet.</p>
                                                                    )}
                                                                </div>
                                                                <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white/10 text-white/70">
                                                                    <ImagePlus size={28} />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="space-y-3 p-4">
                                                        <div className="flex items-center justify-between gap-4">
                                                            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${slide.enabled ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'}`}>
                                                                {slide.enabled ? `Slide ${index + 1} enabled` : `Slide ${index + 1} disabled`}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {slide.target.trim() || 'No target set'}
                                                            </span>
                                                        </div>

                                                        <div className="grid gap-2 text-sm text-gray-600">
                                                            <p><span className="font-medium text-gray-900">Heading:</span> {slide.title.trim() || 'Not set'}</p>
                                                            <p><span className="font-medium text-gray-900">Subtext:</span> {slide.subtitle.trim() || 'Not set'}</p>
                                                            <p><span className="font-medium text-gray-900">CTA:</span> {slide.ctaLabel.trim() || 'Not set'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                                        <p className="font-medium text-gray-900">Useful route examples</p>
                                        <p className="mt-2">`/all-restaurants` opens the restaurants list.</p>
                                        <p className="mt-1">`/search` opens the customer search tab.</p>
                                        <p className="mt-1">`https://...` opens an external campaign or partner page.</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <>
                            <Card className="border-none shadow-sm h-full">
                                <CardContent className="p-6 space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Business name</label>
                                        <Input
                                            value={form.businessName}
                                            onChange={(event) => updateField('businessName', event.target.value)}
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
                                        <Input
                                            value={form.businessEmail}
                                            onChange={(event) => updateField('businessEmail', event.target.value)}
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone number</label>
                                        <Input
                                            value={form.businessPhone}
                                            onChange={(event) => updateField('businessPhone', event.target.value)}
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                                        <Input
                                            value={form.businessAddress}
                                            onChange={(event) => updateField('businessAddress', event.target.value)}
                                            className="bg-white"
                                            disabled={loading}
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-none shadow-sm h-full">
                                <CardContent className="p-6 space-y-4">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900">
                                            {activeTab === 'profile' ? 'Business profile' : 'Security notes'}
                                        </h2>
                                        <p className="mt-2 text-sm text-gray-500">
                                            {activeTab === 'profile'
                                                ? 'These values are shared across the admin tools and customer-facing receipts where relevant.'
                                                : 'Security controls are still managed separately. This page now persists system-level pricing and business metadata.'}
                                        </p>
                                    </div>

                                    <div className="rounded-lg border border-orange-100 bg-orange-50 p-4 text-sm text-orange-800">
                                        <p className="font-medium">Current service charge rule</p>
                                        <p className="mt-1">
                                            Flat ₦{form.serviceChargeFlat || buildDefaultForm().serviceChargeFlat} per order.
                                        </p>
                                    </div>

                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                                        <p className="font-medium text-gray-900">Need to change payout defaults too?</p>
                                        <p className="mt-1">
                                            Use the Commission tab to adjust restaurant commission, rider commission, minimum delivery fee, delivery radius, and the capped service charge rule together.
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>
        </MainLayout>
    )
}
