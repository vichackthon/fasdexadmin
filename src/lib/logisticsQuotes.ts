import { supabase } from './supabase'
import type { Json } from './database.types'
import type { LogisticsQuote } from './logisticsQuoteDocuments'
export type { LogisticsQuote } from './logisticsQuoteDocuments'

export interface QuoteDetails {
    customer_name: string
    customer_phone: string
    pickup_address: string
    pickup_latitude: number
    pickup_longitude: number
    dropoff_address: string
    dropoff_latitude: number
    dropoff_longitude: number
    parcel_size: 'small' | 'medium' | 'large'
    parcel_description: string
    pickup_contact_name: string
    pickup_contact_phone: string
    recipient_name: string
    recipient_phone: string
    special_instructions: string
}

function unwrap(data: Json | null, error: { message: string } | null): LogisticsQuote {
    if (error) throw new Error(error.message)
    const result = data as { ok?: boolean; error?: string; quote?: LogisticsQuote } | null
    if (!result?.ok || !result.quote) throw new Error(result?.error || 'Unable to save quotation.')
    return result.quote
}

export async function listLogisticsQuotes(search: string): Promise<LogisticsQuote[]> {
    const { data, error } = await supabase.rpc('admin_list_logistics_quotes', { p_search: search })
    if (error) throw new Error(error.message)
    return data as unknown as LogisticsQuote[]
}

export async function calculateLogisticsQuote(details: QuoteDetails) {
    const { data, error } = await supabase.rpc('parcel_quote', {
        p_pickup_latitude: details.pickup_latitude,
        p_pickup_longitude: details.pickup_longitude,
        p_dropoff_latitude: details.dropoff_latitude,
        p_dropoff_longitude: details.dropoff_longitude,
        p_parcel_size: details.parcel_size,
    })
    if (error) throw new Error(error.message)
    const row = data?.[0]
    if (!row?.ok || row.fee == null) throw new Error(row?.reason || 'This trip is unavailable.')
    return { fee: Number(row.fee), distance: Number(row.distance_km) }
}

export async function saveLogisticsQuote(details: QuoteDetails, feeOverride: number | null, reason: string, hours: number) {
    const { data, error } = await supabase.rpc('admin_create_logistics_quote', {
        p_details: details as unknown as Json,
        p_fee_override: feeOverride ?? undefined,
        p_adjustment_reason: reason || undefined,
        p_valid_hours: hours,
    })
    return unwrap(data, error)
}

export async function cancelLogisticsQuote(id: string) {
    const { data, error } = await supabase.rpc('admin_cancel_logistics_quote', { p_id: id })
    return unwrap(data, error)
}
