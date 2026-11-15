export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    full_name: string | null
                    phone_number: string | null
                    email: string | null
                    address: string | null
                    avatar_url: string | null
                    bank_name: string | null
                    bank_code: string | null
                    account_number: string | null
                    bank_account_name: string | null
                    paystack_recipient_code: string | null
                    role: 'admin' | 'sub_admin' | 'customer' | 'rider' | 'vendor'
                    is_online: boolean | null
                    is_available: boolean | null
                    referral_code: string
                    referred_by: string | null
                    // Server-maintained; a trigger reverts client writes.
                    rider_rating: number | null
                    rider_total_ratings: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    full_name?: string | null
                    phone_number?: string | null
                    email?: string | null
                    address?: string | null
                    avatar_url?: string | null
                    bank_name?: string | null
                    bank_code?: string | null
                    account_number?: string | null
                    bank_account_name?: string | null
                    paystack_recipient_code?: string | null
                    role?: 'admin' | 'sub_admin' | 'customer' | 'rider' | 'vendor'
                    is_online?: boolean | null
                    is_available?: boolean | null
                    referral_code?: string
                    referred_by?: string | null
                    rider_rating?: number | null
                    rider_total_ratings?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    full_name?: string | null
                    phone_number?: string | null
                    email?: string | null
                    address?: string | null
                    avatar_url?: string | null
                    bank_name?: string | null
                    bank_code?: string | null
                    account_number?: string | null
                    bank_account_name?: string | null
                    paystack_recipient_code?: string | null
                    role?: 'admin' | 'sub_admin' | 'customer' | 'rider' | 'vendor'
                    is_online?: boolean | null
                    is_available?: boolean | null
                    referral_code?: string
                    referred_by?: string | null
                    rider_rating?: number | null
                    rider_total_ratings?: number
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'notifications_user_id_fkey'
                        columns: ['id']
                        referencedRelation: 'notifications'
                        referencedColumns: ['user_id']
                    },
                    {
                        foreignKeyName: 'orders_customer_id_fkey'
                        columns: ['id']
                        referencedRelation: 'orders'
                        referencedColumns: ['customer_id']
                    },
                    {
                        foreignKeyName: 'orders_rider_id_fkey'
                        columns: ['id']
                        referencedRelation: 'orders'
                        referencedColumns: ['rider_id']
                    },
                    {
                        foreignKeyName: 'payouts_recipient_id_fkey'
                        columns: ['id']
                        referencedRelation: 'payouts'
                        referencedColumns: ['recipient_id']
                    },
                    {
                        foreignKeyName: 'restaurants_owner_id_fkey'
                        columns: ['id']
                        referencedRelation: 'restaurants'
                        referencedColumns: ['owner_id']
                    },
                    {
                        foreignKeyName: 'rider_verifications_rider_id_fkey'
                        columns: ['id']
                        referencedRelation: 'rider_verifications'
                        referencedColumns: ['rider_id']
                    },
                    {
                        foreignKeyName: 'support_tickets_user_id_fkey'
                        columns: ['id']
                        referencedRelation: 'support_tickets'
                        referencedColumns: ['user_id']
                    }
                ]
            }
            notifications: {
                Row: {
                    id: string
                    user_id: string | null
                    title: string
                    message: string
                    type: string
                    is_read: boolean
                    metadata: Json
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    title: string
                    message: string
                    type: string
                    is_read?: boolean
                    metadata?: Json
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    title?: string
                    message?: string
                    type?: string
                    is_read?: boolean
                    metadata?: Json
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'notifications_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            restaurants: {
                Row: {
                    id: string
                    owner_id: string | null
                    name: string
                    description: string | null
                    image_url: string | null
                    rating: number | null
                    total_ratings: number | null
                    address: string | null
                    is_active: boolean
                    commission_rate: number | null
                    bank_name: string | null
                    account_number: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    owner_id?: string | null
                    name: string
                    description?: string | null
                    image_url?: string | null
                    rating?: number | null
                    total_ratings?: number | null
                    address?: string | null
                    is_active?: boolean
                    commission_rate?: number | null
                    bank_name?: string | null
                    account_number?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    owner_id?: string | null
                    name?: string
                    description?: string | null
                    image_url?: string | null
                    rating?: number | null
                    total_ratings?: number | null
                    address?: string | null
                    is_active?: boolean
                    commission_rate?: number | null
                    bank_name?: string | null
                    account_number?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'menu_items_restaurant_id_fkey'
                        columns: ['id']
                        referencedRelation: 'menu_items'
                        referencedColumns: ['restaurant_id']
                    },
                    {
                        foreignKeyName: 'orders_restaurant_id_fkey'
                        columns: ['id']
                        referencedRelation: 'orders'
                        referencedColumns: ['restaurant_id']
                    },
                    {
                        foreignKeyName: 'payouts_restaurant_id_fkey'
                        columns: ['id']
                        referencedRelation: 'payouts'
                        referencedColumns: ['restaurant_id']
                    },
                    {
                        foreignKeyName: 'restaurants_owner_id_fkey'
                        columns: ['owner_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            menu_items: {
                Row: {
                    id: string
                    restaurant_id: string | null
                    name: string
                    description: string | null
                    price: number
                    discount_price: number | null
                    image_url: string | null
                    category: string | null
                    is_available: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    restaurant_id?: string | null
                    name: string
                    description?: string | null
                    price: number
                    discount_price?: number | null
                    image_url?: string | null
                    category?: string | null
                    is_available?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    restaurant_id?: string | null
                    name?: string
                    description?: string | null
                    price?: number
                    discount_price?: number | null
                    image_url?: string | null
                    category?: string | null
                    is_available?: boolean
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'menu_items_restaurant_id_fkey'
                        columns: ['restaurant_id']
                        referencedRelation: 'restaurants'
                        referencedColumns: ['id']
                    }
                ]
            }
            orders: {
                Row: {
                    id: string
                    order_number: string | null
                    customer_id: string | null
                    restaurant_id: string | null
                    rider_id: string | null
                    status: 'pending' | 'pending_acceptance' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'picked_up' | 'delivered' | 'cancelled'
                    subtotal: number
                    takeaway_pack_fee: number | null
                    delivery_fee: number | null
                    service_charge_amount: number | null
                    total_amount: number
                    delivery_address: string | null
                    special_instructions: string | null
                    payout_status: 'pending' | 'requested' | 'paid'
                    rider_payout_status: string | null
                    payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | null
                    // Delivery-leg milestones. Stamped from the server clock
                    // on each status transition
                    // (20260925160000_order_milestone_server_clock.sql) and
                    // read by the stalled-delivery watchdog and the
                    // delivery-time figures in lib/orderTimings.ts.
                    accepted_at: string | null
                    picked_up_at: string | null
                    delivered_at: string | null
                    delivery_latitude: number | null
                    delivery_longitude: number | null
                    stall_warned_at: string | null
                    stall_escalated_at: string | null
                    // Parcel delivery (20260925120000_parcel_delivery.sql).
                    // A parcel is a row in this table with restaurant_id NULL;
                    // delivery_kind is the discriminator. pickup_* is set for
                    // BOTH kinds — the database snapshots the restaurant's
                    // address there for food orders — so admin surfaces can
                    // read one pickup field instead of joining restaurants.
                    delivery_kind: 'food' | 'parcel'
                    pickup_address: string | null
                    pickup_latitude: number | null
                    pickup_longitude: number | null
                    pickup_contact_name: string | null
                    pickup_contact_phone: string | null
                    parcel_description: string | null
                    parcel_size: 'small' | 'medium' | 'large' | null
                    recipient_name: string | null
                    recipient_phone: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    order_number?: string | null
                    customer_id?: string | null
                    restaurant_id?: string | null
                    rider_id?: string | null
                    status?: 'pending' | 'pending_acceptance' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'picked_up' | 'delivered' | 'cancelled'
                    subtotal: number
                    takeaway_pack_fee?: number | null
                    delivery_fee?: number | null
                    service_charge_amount?: number | null
                    total_amount: number
                    delivery_address?: string | null
                    special_instructions?: string | null
                    payout_status?: 'pending' | 'requested' | 'paid'
                    rider_payout_status?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    order_number?: string | null
                    customer_id?: string | null
                    restaurant_id?: string | null
                    rider_id?: string | null
                    status?: 'pending' | 'pending_acceptance' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'picked_up' | 'delivered' | 'cancelled'
                    subtotal?: number
                    takeaway_pack_fee?: number | null
                    delivery_fee?: number | null
                    service_charge_amount?: number | null
                    total_amount?: number
                    delivery_address?: string | null
                    special_instructions?: string | null
                    payout_status?: 'pending' | 'requested' | 'paid'
                    rider_payout_status?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'orders_customer_id_fkey'
                        columns: ['customer_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'orders_restaurant_id_fkey'
                        columns: ['restaurant_id']
                        referencedRelation: 'restaurants'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'orders_rider_id_fkey'
                        columns: ['rider_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            courier_locations: {
                Row: {
                    rider_id: string
                    location: Json | null
                    latitude: number | null
                    longitude: number | null
                    is_online: boolean | null
                    last_updated: string
                }
                Insert: {
                    rider_id: string
                    location?: Json | null
                    latitude?: number | null
                    longitude?: number | null
                    is_online?: boolean | null
                    last_updated?: string
                }
                Update: {
                    rider_id?: string
                    location?: Json | null
                    latitude?: number | null
                    longitude?: number | null
                    is_online?: boolean | null
                    last_updated?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'courier_locations_rider_id_fkey'
                        columns: ['rider_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            rider_verifications: {
                Row: {
                    id: string
                    rider_id: string | null
                    license_number: string | null
                    license_image_url: string | null
                    vehicle_type: string | null
                    plate_number: string | null
                    date_of_birth: string | null
                    guarantor_name: string | null
                    guarantor_phone: string | null
                    guarantor_address: string | null
                    guarantor_relationship: string | null
                    document_url: string | null
                    status: 'pending' | 'approved' | 'rejected'
                    submitted_at: string
                    reviewed_at: string | null
                    rejection_reason: string | null
                }
                Insert: {
                    id?: string
                    rider_id?: string | null
                    license_number?: string | null
                    license_image_url?: string | null
                    vehicle_type?: string | null
                    plate_number?: string | null
                    date_of_birth?: string | null
                    guarantor_name?: string | null
                    guarantor_phone?: string | null
                    guarantor_address?: string | null
                    guarantor_relationship?: string | null
                    document_url?: string | null
                    status?: 'pending' | 'approved' | 'rejected'
                    submitted_at?: string
                    reviewed_at?: string | null
                    rejection_reason?: string | null
                }
                Update: {
                    id?: string
                    rider_id?: string | null
                    license_number?: string | null
                    license_image_url?: string | null
                    vehicle_type?: string | null
                    plate_number?: string | null
                    date_of_birth?: string | null
                    guarantor_name?: string | null
                    guarantor_phone?: string | null
                    guarantor_address?: string | null
                    guarantor_relationship?: string | null
                    document_url?: string | null
                    status?: 'pending' | 'approved' | 'rejected'
                    submitted_at?: string
                    reviewed_at?: string | null
                    rejection_reason?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: 'rider_verifications_rider_id_fkey'
                        columns: ['rider_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            rider_ratings: {
                // Read-only from the dashboard. Every write goes through
                // submit_rider_rating(); the table has no INSERT/UPDATE policy
                // on purpose. Admins with `riders.view` can SELECT all rows.
                Row: {
                    id: string
                    order_id: string
                    rider_id: string
                    customer_id: string
                    rating: number
                    comment: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: never
                Update: never
                Relationships: [
                    {
                        foreignKeyName: 'rider_ratings_rider_id_fkey'
                        columns: ['rider_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'rider_ratings_customer_id_fkey'
                        columns: ['customer_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'rider_ratings_order_id_fkey'
                        columns: ['order_id']
                        referencedRelation: 'orders'
                        referencedColumns: ['id']
                    }
                ]
            }
            rider_payouts: {
                Row: {
                    id: string
                    rider_id: string
                    amount: number
                    status: 'pending' | 'processing' | 'paid' | 'failed'
                    reference: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    rider_id: string
                    amount: number
                    status?: 'pending' | 'processing' | 'paid' | 'failed'
                    reference?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    rider_id?: string
                    amount?: number
                    status?: 'pending' | 'processing' | 'paid' | 'failed'
                    reference?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'rider_payouts_rider_id_fkey'
                        columns: ['rider_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            payouts: {
                Row: {
                    id: string
                    recipient_id: string | null
                    restaurant_id: string | null
                    amount: number
                    status: 'pending' | 'processed' | 'paid' | 'failed'
                    bank_name: string | null
                    account_number: string | null
                    reference_code: string | null
                    created_at: string
                    processed_at: string | null
                }
                Insert: {
                    id?: string
                    recipient_id?: string | null
                    restaurant_id?: string | null
                    amount: number
                    status?: 'pending' | 'processed' | 'paid' | 'failed'
                    bank_name?: string | null
                    account_number?: string | null
                    reference_code?: string | null
                    created_at?: string
                    processed_at?: string | null
                }
                Update: {
                    id?: string
                    recipient_id?: string | null
                    restaurant_id?: string | null
                    amount?: number
                    status?: 'pending' | 'processed' | 'paid' | 'failed'
                    bank_name?: string | null
                    account_number?: string | null
                    reference_code?: string | null
                    created_at?: string
                    processed_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: 'payouts_recipient_id_fkey'
                        columns: ['recipient_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'payouts_restaurant_id_fkey'
                        columns: ['restaurant_id']
                        referencedRelation: 'restaurants'
                        referencedColumns: ['id']
                    }
                ]
            }
            ticket_messages: {
                Row: {
                    id: string
                    ticket_id: string
                    sender_type: 'customer' | 'admin'
                    sender_id: string | null
                    message: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    ticket_id: string
                    sender_type: 'customer' | 'admin'
                    sender_id?: string | null
                    message: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    ticket_id?: string
                    sender_type?: 'customer' | 'admin'
                    sender_id?: string | null
                    message?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'ticket_messages_ticket_id_fkey'
                        columns: ['ticket_id']
                        referencedRelation: 'support_tickets'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'ticket_messages_sender_id_fkey'
                        columns: ['sender_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            support_tickets: {
                Row: {
                    id: string
                    user_id: string | null
                    subject: string
                    message: string
                    related_order_id: string | null
                    status: 'open' | 'in_progress' | 'resolved' | 'closed'
                    admin_response: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id?: string | null
                    subject: string
                    message: string
                    related_order_id?: string | null
                    status?: 'open' | 'in_progress' | 'resolved' | 'closed'
                    admin_response?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string | null
                    subject?: string
                    message?: string
                    related_order_id?: string | null
                    status?: 'open' | 'in_progress' | 'resolved' | 'closed'
                    admin_response?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'support_tickets_related_order_id_fkey'
                        columns: ['related_order_id']
                        referencedRelation: 'orders'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'support_tickets_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            // Push broadcast campaigns (20260926120000_push_broadcast.sql).
            // Written only by the broadcast-push Edge Function with the service
            // role; RLS grants staff holding support.broadcast SELECT and
            // nothing else, so there is no Insert/Update shape here.
            push_campaigns: {
                Row: {
                    id: string
                    created_by: string | null
                    audience: 'customers' | 'riders' | 'vendors' | 'everyone'
                    title: string
                    body: string
                    deep_link: string | null
                    status: 'sending' | 'sent' | 'failed'
                    audience_total: number
                    reachable_total: number
                    sent_count: number
                    failed_count: number
                    cleared_token_count: number
                    inapp_count: number
                    error: string | null
                    created_at: string
                    completed_at: string | null
                }
                Insert: never
                Update: never
                Relationships: []
            }
            system_settings: {
                Row: {
                    id: number
                    restaurant_commission_rate: number | null
                    rider_commission_rate: number | null
                    min_delivery_fee: number | null
                    delivery_fee_per_km: number | null
                    service_charge_flat: number | null
                    takeaway_pack_fee: number | null
                    max_delivery_radius_km: number | null
                    business_name: string | null
                    business_email: string | null
                    business_phone: string | null
                    business_address: string | null
                    customer_home_banner_enabled: boolean | null
                    customer_home_banner_image_url: string | null
                    customer_home_banner_title: string | null
                    customer_home_banner_subtitle: string | null
                    customer_home_banner_cta_label: string | null
                    customer_home_banner_target: string | null
                    customer_home_banner_auto_slide_seconds: number | null
                    customer_home_banners: Json | null
                    referral_enabled: boolean | null
                    referral_referrer_reward: number | null
                    referral_referee_bonus: number | null
                    referral_min_order_value: number | null
                    // Parcel delivery (20260925120000_parcel_delivery.sql).
                    // Priced separately from food: a parcel is a two-leg job
                    // (the rider travels to the pickup first), so it does not
                    // reuse min_delivery_fee / delivery_fee_per_km.
                    parcel_delivery_enabled: boolean | null
                    parcel_base_fee: number | null
                    parcel_fee_per_km: number | null
                    parcel_min_fee: number | null
                    parcel_size_multiplier_sm: number | null
                    parcel_size_multiplier_md: number | null
                    parcel_size_multiplier_lg: number | null
                    parcel_max_distance_km: number | null
                }
                Insert: {
                    id?: number
                    restaurant_commission_rate?: number | null
                    rider_commission_rate?: number | null
                    min_delivery_fee?: number | null
                    delivery_fee_per_km?: number | null
                    service_charge_flat?: number | null
                    takeaway_pack_fee?: number | null
                    max_delivery_radius_km?: number | null
                    business_name?: string | null
                    business_email?: string | null
                    business_phone?: string | null
                    business_address?: string | null
                    customer_home_banner_enabled?: boolean | null
                    customer_home_banner_image_url?: string | null
                    customer_home_banner_title?: string | null
                    customer_home_banner_subtitle?: string | null
                    customer_home_banner_cta_label?: string | null
                    customer_home_banner_target?: string | null
                    customer_home_banner_auto_slide_seconds?: number | null
                    customer_home_banners?: Json | null
                    referral_enabled?: boolean | null
                    referral_referrer_reward?: number | null
                    referral_referee_bonus?: number | null
                    referral_min_order_value?: number | null
                    parcel_delivery_enabled?: boolean | null
                    parcel_base_fee?: number | null
                    parcel_fee_per_km?: number | null
                    parcel_min_fee?: number | null
                    parcel_size_multiplier_sm?: number | null
                    parcel_size_multiplier_md?: number | null
                    parcel_size_multiplier_lg?: number | null
                    parcel_max_distance_km?: number | null
                }
                Update: {
                    id?: number
                    restaurant_commission_rate?: number | null
                    rider_commission_rate?: number | null
                    min_delivery_fee?: number | null
                    delivery_fee_per_km?: number | null
                    service_charge_flat?: number | null
                    takeaway_pack_fee?: number | null
                    max_delivery_radius_km?: number | null
                    business_name?: string | null
                    business_email?: string | null
                    business_phone?: string | null
                    business_address?: string | null
                    customer_home_banner_enabled?: boolean | null
                    customer_home_banner_image_url?: string | null
                    customer_home_banner_title?: string | null
                    customer_home_banner_subtitle?: string | null
                    customer_home_banner_cta_label?: string | null
                    customer_home_banner_target?: string | null
                    customer_home_banner_auto_slide_seconds?: number | null
                    customer_home_banners?: Json | null
                    referral_enabled?: boolean | null
                    referral_referrer_reward?: number | null
                    referral_referee_bonus?: number | null
                    referral_min_order_value?: number | null
                    parcel_delivery_enabled?: boolean | null
                    parcel_base_fee?: number | null
                    parcel_fee_per_km?: number | null
                    parcel_min_fee?: number | null
                    parcel_size_multiplier_sm?: number | null
                    parcel_size_multiplier_md?: number | null
                    parcel_size_multiplier_lg?: number | null
                    parcel_max_distance_km?: number | null
                }
                Relationships: []
            }
            wallets: {
                Row: {
                    id: string
                    user_id: string
                    balance: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    balance?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    balance?: number
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'wallets_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            wallet_transactions: {
                Row: {
                    id: string
                    wallet_id: string
                    amount: number
                    type: 'credit' | 'debit'
                    source: 'referral_reward' | 'referral_bonus' | 'order_payment' | 'manual_adjustment'
                    reference: string | null
                    description: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    wallet_id: string
                    amount: number
                    type: 'credit' | 'debit'
                    source: 'referral_reward' | 'referral_bonus' | 'order_payment' | 'manual_adjustment'
                    reference?: string | null
                    description?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    wallet_id?: string
                    amount?: number
                    type?: 'credit' | 'debit'
                    source?: 'referral_reward' | 'referral_bonus' | 'order_payment' | 'manual_adjustment'
                    reference?: string | null
                    description?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'wallet_transactions_wallet_id_fkey'
                        columns: ['wallet_id']
                        referencedRelation: 'wallets'
                        referencedColumns: ['id']
                    }
                ]
            }
            referrals: {
                Row: {
                    id: string
                    referrer_id: string
                    referred_id: string
                    status: 'pending' | 'rewarded' | 'expired'
                    referrer_reward: number | null
                    referee_bonus: number | null
                    rewarded_at: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    referrer_id: string
                    referred_id: string
                    status?: 'pending' | 'rewarded' | 'expired'
                    referrer_reward?: number | null
                    referee_bonus?: number | null
                    rewarded_at?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    referrer_id?: string
                    referred_id?: string
                    status?: 'pending' | 'rewarded' | 'expired'
                    referrer_reward?: number | null
                    referee_bonus?: number | null
                    rewarded_at?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'referrals_referrer_id_fkey'
                        columns: ['referrer_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'referrals_referred_id_fkey'
                        columns: ['referred_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            city_waitlist: {
                Row: {
                    id: string
                    user_id: string
                    city: string | null
                    address: string | null
                    latitude: number
                    longitude: number
                    distance_km: number | null
                    full_name: string | null
                    phone: string | null
                    email: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    city?: string | null
                    address?: string | null
                    latitude: number
                    longitude: number
                    distance_km?: number | null
                    full_name?: string | null
                    phone?: string | null
                    email?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    city?: string | null
                    address?: string | null
                    latitude?: number
                    longitude?: number
                    distance_km?: number | null
                    full_name?: string | null
                    phone?: string | null
                    email?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'city_waitlist_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            events: {
                Row: {
                    id: string
                    title: string
                    description: string | null
                    category: string | null
                    poster_url: string | null
                    host_name: string | null
                    host_logo_url: string | null
                    venue_name: string | null
                    address: string | null
                    city: string | null
                    latitude: number | null
                    longitude: number | null
                    event_type: 'physical' | 'online'
                    timezone: string
                    starts_at: string
                    ends_at: string | null
                    sales_start_at: string | null
                    sales_end_at: string | null
                    status: 'draft' | 'published' | 'cancelled' | 'archived'
                    is_featured: boolean
                    capacity: number | null
                    created_by: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    title: string
                    description?: string | null
                    category?: string | null
                    poster_url?: string | null
                    host_name?: string | null
                    host_logo_url?: string | null
                    venue_name?: string | null
                    address?: string | null
                    city?: string | null
                    latitude?: number | null
                    longitude?: number | null
                    event_type?: 'physical' | 'online'
                    timezone?: string
                    starts_at: string
                    ends_at?: string | null
                    sales_start_at?: string | null
                    sales_end_at?: string | null
                    status?: 'draft' | 'published' | 'cancelled' | 'archived'
                    is_featured?: boolean
                    capacity?: number | null
                    created_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    title?: string
                    description?: string | null
                    category?: string | null
                    poster_url?: string | null
                    host_name?: string | null
                    host_logo_url?: string | null
                    venue_name?: string | null
                    address?: string | null
                    city?: string | null
                    latitude?: number | null
                    longitude?: number | null
                    event_type?: 'physical' | 'online'
                    timezone?: string
                    starts_at?: string
                    ends_at?: string | null
                    sales_start_at?: string | null
                    sales_end_at?: string | null
                    status?: 'draft' | 'published' | 'cancelled' | 'archived'
                    is_featured?: boolean
                    capacity?: number | null
                    created_by?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'events_created_by_fkey'
                        columns: ['created_by']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            event_ticket_tiers: {
                Row: {
                    id: string
                    event_id: string
                    name: string
                    description: string | null
                    perks: string[]
                    price: number
                    fee: number
                    quantity_total: number | null
                    quantity_sold: number
                    max_per_order: number
                    sort_order: number
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    event_id: string
                    name: string
                    description?: string | null
                    perks?: string[]
                    price?: number
                    fee?: number
                    quantity_total?: number | null
                    quantity_sold?: number
                    max_per_order?: number
                    sort_order?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    event_id?: string
                    name?: string
                    description?: string | null
                    perks?: string[]
                    price?: number
                    fee?: number
                    quantity_total?: number | null
                    quantity_sold?: number
                    max_per_order?: number
                    sort_order?: number
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'event_ticket_tiers_event_id_fkey'
                        columns: ['event_id']
                        referencedRelation: 'events'
                        referencedColumns: ['id']
                    }
                ]
            }
            event_ticket_orders: {
                Row: {
                    id: string
                    event_id: string
                    customer_id: string
                    reference: string
                    payment_status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'
                    quantity: number
                    subtotal: number
                    fees_total: number
                    total_amount: number
                    amount_due: number
                    wallet_applied: number
                    customer_name: string | null
                    customer_email: string | null
                    customer_phone: string | null
                    reserved_until: string | null
                    paid_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    event_id: string
                    customer_id: string
                    reference: string
                    payment_status?: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'
                    quantity?: number
                    subtotal?: number
                    fees_total?: number
                    total_amount?: number
                    amount_due?: number
                    wallet_applied?: number
                    customer_name?: string | null
                    customer_email?: string | null
                    customer_phone?: string | null
                    reserved_until?: string | null
                    paid_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    event_id?: string
                    customer_id?: string
                    reference?: string
                    payment_status?: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded'
                    quantity?: number
                    subtotal?: number
                    fees_total?: number
                    total_amount?: number
                    amount_due?: number
                    wallet_applied?: number
                    customer_name?: string | null
                    customer_email?: string | null
                    customer_phone?: string | null
                    reserved_until?: string | null
                    paid_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'event_ticket_orders_event_id_fkey'
                        columns: ['event_id']
                        referencedRelation: 'events'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'event_ticket_orders_customer_id_fkey'
                        columns: ['customer_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
            event_ticket_order_items: {
                Row: {
                    id: string
                    order_id: string
                    tier_id: string | null
                    tier_name: string
                    unit_price: number
                    unit_fee: number
                    quantity: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    order_id: string
                    tier_id?: string | null
                    tier_name: string
                    unit_price?: number
                    unit_fee?: number
                    quantity: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    order_id?: string
                    tier_id?: string | null
                    tier_name?: string
                    unit_price?: number
                    unit_fee?: number
                    quantity?: number
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'event_ticket_order_items_order_id_fkey'
                        columns: ['order_id']
                        referencedRelation: 'event_ticket_orders'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'event_ticket_order_items_tier_id_fkey'
                        columns: ['tier_id']
                        referencedRelation: 'event_ticket_tiers'
                        referencedColumns: ['id']
                    }
                ]
            }
            event_tickets: {
                Row: {
                    id: string
                    order_id: string
                    order_item_id: string
                    event_id: string
                    tier_id: string | null
                    customer_id: string
                    ticket_code: string
                    serial: number
                    status: 'valid' | 'used' | 'refunded' | 'void'
                    price_paid: number
                    fee_paid: number
                    attendee_name: string | null
                    used_at: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    order_id: string
                    order_item_id: string
                    event_id: string
                    tier_id?: string | null
                    customer_id: string
                    ticket_code: string
                    serial: number
                    status?: 'valid' | 'used' | 'refunded' | 'void'
                    price_paid?: number
                    fee_paid?: number
                    attendee_name?: string | null
                    used_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    order_id?: string
                    order_item_id?: string
                    event_id?: string
                    tier_id?: string | null
                    customer_id?: string
                    ticket_code?: string
                    serial?: number
                    status?: 'valid' | 'used' | 'refunded' | 'void'
                    price_paid?: number
                    fee_paid?: number
                    attendee_name?: string | null
                    used_at?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'event_tickets_event_id_fkey'
                        columns: ['event_id']
                        referencedRelation: 'events'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'event_tickets_order_id_fkey'
                        columns: ['order_id']
                        referencedRelation: 'event_ticket_orders'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'event_tickets_tier_id_fkey'
                        columns: ['tier_id']
                        referencedRelation: 'event_ticket_tiers'
                        referencedColumns: ['id']
                    }
                ]
            }
            event_favorites: {
                Row: {
                    id: string
                    user_id: string
                    event_id: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    event_id: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    event_id?: string
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: 'event_favorites_event_id_fkey'
                        columns: ['event_id']
                        referencedRelation: 'events'
                        referencedColumns: ['id']
                    },
                    {
                        foreignKeyName: 'event_favorites_user_id_fkey'
                        columns: ['user_id']
                        referencedRelation: 'profiles'
                        referencedColumns: ['id']
                    }
                ]
            }
        }
        Views: {}
        Functions: {
            parcel_quote: {
                Args: { p_pickup_latitude: number; p_pickup_longitude: number; p_dropoff_latitude: number; p_dropoff_longitude: number; p_parcel_size?: string }
                Returns: { ok: boolean; reason: string | null; distance_km: number | null; fee: number | null; max_distance_km: number | null }[]
            }
            admin_create_logistics_quote: {
                Args: { p_details: Json; p_fee_override?: number; p_adjustment_reason?: string; p_valid_hours?: number }
                Returns: Json
            }
            admin_list_logistics_quotes: { Args: { p_search?: string }; Returns: Json }
            admin_cancel_logistics_quote: { Args: { p_id: string }; Returns: Json }
            get_popular_menu_items: {
                Args: {
                    limit_count?: number
                }
                Returns: {
                    id: string
                    restaurant_id: string
                    name: string
                    description: string | null
                    price: number
                    image_url: string | null
                    category: string | null
                    is_available: boolean
                    created_at: string
                    popularity_score: number
                }[]
            }
            admin_capabilities: {
                Args: Record<string, never>
                Returns: {
                    tier: string | null
                    capability: string
                }[]
            }
            // Audience size for a push broadcast. Derived from the same SQL
            // function the send resolves recipients through, so the number in
            // the confirm dialog is the number that actually gets notified.
            // Raises if the caller lacks support.broadcast.
            push_audience_stats: {
                Args: {
                    p_audience: 'customers' | 'riders' | 'vendors' | 'everyone'
                }
                Returns: {
                    audience_total: number
                    reachable_total: number
                }[]
            }
            admin_assignable_riders: {
                Args: {
                    p_order_id: string
                }
                Returns: {
                    rider_id: string
                    full_name: string | null
                    phone_number: string | null
                    is_online: boolean
                    is_available: boolean
                    active_deliveries: number
                    distance_m: number | null
                    last_seen: string | null
                }[]
            }
            admin_release_order_rider: {
                Args: {
                    p_order_id: string
                    p_reason?: string | null
                }
                Returns: {
                    ok: boolean
                    error?: string
                    released_rider_id?: string
                    message?: string
                }
            }
            admin_assign_order_rider: {
                Args: {
                    p_order_id: string
                    p_rider_id: string
                    p_reason?: string | null
                }
                Returns: {
                    ok: boolean
                    error?: string
                    rider_id?: string
                    message?: string
                }
            }
            admin_cancel_order: {
                Args: {
                    p_order_id: string
                    p_reason: string
                }
                Returns: {
                    ok: boolean
                    error?: string
                    payment_status?: string
                    refund_owed?: boolean
                    total_amount?: number
                    message?: string
                }
            }
        }
        Enums: {
            order_status: 'pending' | 'pending_acceptance' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'picked_up' | 'delivered' | 'cancelled'
        }
        CompositeTypes: {}
    }
}
