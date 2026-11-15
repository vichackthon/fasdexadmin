import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const env = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) continue;

    const withoutPrefix = part.slice(2);
    const eqIndex = withoutPrefix.indexOf('=');
    if (eqIndex !== -1) {
      const key = withoutPrefix.slice(0, eqIndex);
      const value = withoutPrefix.slice(eqIndex + 1);
      args[key] = value;
      continue;
    }

    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[withoutPrefix] = true;
      continue;
    }

    args[withoutPrefix] = next;
    i += 1;
  }
  return args;
}

function usage() {
  console.log(`
FoodNest order-flow E2E simulator

Usage:
  npm run e2e:order-flow -- \\
    --customer-email you@example.com \\
    --customer-password secret \\
    --restaurant-email vendor@example.com \\
    --restaurant-password secret \\
    --rider-email rider@example.com \\
    --rider-password secret

Optional:
  --restaurant-id <uuid>        Use a specific restaurant instead of auto-detecting by owner
  --menu-item-id <uuid>         Use a specific menu item instead of auto-picking the first available one
  --quantity <n>                Default: 1
  --delivery-address <text>     Override customer profile address
  --rider-lat <num>             Override rider latitude
  --rider-lng <num>             Override rider longitude
  --decline-first               Make rider decline first offer, then accept the next one
  --dispatch-timeout-ms <ms>    Default: 60000
  --poll-interval-ms <ms>       Default: 2000

What it simulates:
  1. Customer signs in and creates an order + order_items
  2. Payment success is simulated by updating the order to paid/confirmed
  3. Restaurant moves the order to preparing and ready_for_pickup
  4. Rider goes online, gets offered the order, optionally declines once, then accepts
  5. Rider marks picked_up and delivered using the generated delivery_code
`);
}

function required(args, key) {
  const value = args[key];
  if (!value) {
    throw new Error(`Missing required argument: --${key}`);
  }
  return value;
}

function asNumber(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Expected a number but got "${value}"`);
  }
  return parsed;
}

function paymentReference() {
  return `foodnest_e2e_${Date.now()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function point(longitude, latitude) {
  return `POINT(${longitude} ${latitude})`;
}

function log(step, message, extra) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${step}] ${message}`);
  if (extra !== undefined) {
    console.log(JSON.stringify(extra, null, 2));
  }
}

async function signInClient(url, anonKey, email, password) {
  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Failed to sign in ${email}: ${error.message}`);
  if (!data.user) throw new Error(`No user returned for ${email}`);
  return { client, user: data.user };
}

async function expectSingle(query, label) {
  const { data, error } = await query.single();
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function maybeSingle(query, label) {
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function waitFor(label, fn, { timeoutMs, intervalMs }) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  if (lastError) {
    throw new Error(`${label} timed out. Last error: ${lastError.message}`);
  }
  throw new Error(`${label} timed out.`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    usage();
    process.exit(0);
  }

  const envFile = path.join(projectRoot, '.env.local');
  const env = { ...parseEnvFile(envFile), ...process.env };
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(`Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in ${envFile}`);
  }

  const quantity = Math.max(1, Math.trunc(asNumber(args.quantity, 1)));
  const deliveryFee = asNumber(args['delivery-fee'], 500);
  const takeawayPack = asNumber(args['takeaway-pack'], 200);
  const serviceFee = asNumber(args['service-fee'], 500);
  const dispatchTimeoutMs = asNumber(args['dispatch-timeout-ms'], 60000);
  const pollIntervalMs = asNumber(args['poll-interval-ms'], 2000);

  const customerCreds = {
    email: required(args, 'customer-email'),
    password: required(args, 'customer-password'),
  };
  const restaurantCreds = {
    email: required(args, 'restaurant-email'),
    password: required(args, 'restaurant-password'),
  };
  const riderCreds = {
    email: required(args, 'rider-email'),
    password: required(args, 'rider-password'),
  };

  log('setup', 'Signing in customer, restaurant, and rider test users');
  const [{ client: customer, user: customerUser }, { client: restaurant, user: restaurantUser }, { client: rider, user: riderUser }] =
    await Promise.all([
      signInClient(supabaseUrl, supabaseAnonKey, customerCreds.email, customerCreds.password),
      signInClient(supabaseUrl, supabaseAnonKey, restaurantCreds.email, restaurantCreds.password),
      signInClient(supabaseUrl, supabaseAnonKey, riderCreds.email, riderCreds.password),
    ]);

  const customerProfile = await maybeSingle(
    customer.from('profiles').select('id, full_name, address, delivery_latitude, delivery_longitude').eq('id', customerUser.id),
    'Load customer profile',
  );

  const restaurantRow =
    args['restaurant-id']
      ? await expectSingle(
          restaurant
            .from('restaurants')
            .select('id, owner_id, name, address, latitude, longitude, auto_accept, is_online')
            .eq('id', args['restaurant-id']),
          'Load restaurant by id',
        )
      : await expectSingle(
          restaurant
            .from('restaurants')
            .select('id, owner_id, name, address, latitude, longitude, auto_accept, is_online')
            .eq('owner_id', restaurantUser.id),
          'Load restaurant by owner',
        );

  if (restaurantRow.latitude == null || restaurantRow.longitude == null) {
    throw new Error(
      `Restaurant "${restaurantRow.name}" is missing latitude/longitude. Set restaurant location before running dispatch simulation.`,
    );
  }

  const menuItem =
    args['menu-item-id']
      ? await expectSingle(
          restaurant
            .from('menu_items')
            .select('id, name, price, is_available, restaurant_id')
            .eq('id', args['menu-item-id']),
          'Load menu item by id',
        )
      : await expectSingle(
          restaurant
            .from('menu_items')
            .select('id, name, price, is_available, restaurant_id')
            .eq('restaurant_id', restaurantRow.id)
            .eq('is_available', true)
            .limit(1),
          'Load first available menu item',
        );

  if (menuItem.restaurant_id !== restaurantRow.id) {
    throw new Error('Chosen menu item does not belong to the selected restaurant.');
  }

  const riderLat = asNumber(args['rider-lat'], restaurantRow.latitude);
  const riderLng = asNumber(args['rider-lng'], restaurantRow.longitude);

  log('setup', 'Putting rider online and seeding rider location');
  {
    const { error: riderStatusError } = await rider
      .from('profiles')
      .update({
        is_online: true,
        is_available: true,
        updated_at: nowIso(),
      })
      .eq('id', riderUser.id);
    if (riderStatusError) {
      throw new Error(`Failed to mark rider online: ${riderStatusError.message}`);
    }

    const { error: locationError } = await rider.from('courier_locations').upsert({
      rider_id: riderUser.id,
      location: point(riderLng, riderLat),
      is_online: true,
      last_updated: nowIso(),
    });
    if (locationError) {
      throw new Error(`Failed to upsert rider courier location: ${locationError.message}`);
    }
  }

  const subtotal = Number(menuItem.price) * quantity;
  const totalAmount = subtotal + deliveryFee + takeawayPack + serviceFee;
  const reference = paymentReference();
  const deliveryAddress =
    args['delivery-address'] ||
    customerProfile?.address ||
    'FoodNest E2E Test Address';

  log('customer', 'Creating order and order_items as customer');
  const orderInsert = {
    customer_id: customerUser.id,
    restaurant_id: restaurantRow.id,
    restaurant_name: restaurantRow.name,
    status: 'pending',
    payment_status: 'pending',
    payment_reference: reference,
    subtotal,
    takeaway_pack_fee: takeawayPack,
    delivery_fee: deliveryFee,
    service_charge_amount: serviceFee,
    total_amount: totalAmount,
    delivery_address: deliveryAddress,
    delivery_latitude: customerProfile?.delivery_latitude ?? null,
    delivery_longitude: customerProfile?.delivery_longitude ?? null,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  const createdOrder = await expectSingle(
    customer.from('orders').insert(orderInsert).select('id, status, payment_status, delivery_code, order_number'),
    'Create order',
  );

  const { error: orderItemsError } = await customer.from('order_items').insert({
    order_id: createdOrder.id,
    menu_item_id: menuItem.id,
    name: menuItem.name,
    quantity,
    price_at_order: menuItem.price,
  });
  if (orderItemsError) {
    throw new Error(`Create order item: ${orderItemsError.message}`);
  }

  log('customer', 'Simulating successful payment by marking order paid/confirmed', {
    orderId: createdOrder.id,
    reference,
  });
  {
    const { error } = await customer
      .from('orders')
      .update({
        payment_status: 'paid',
        payment_reference: reference,
        status: 'confirmed',
        updated_at: nowIso(),
      })
      .eq('id', createdOrder.id);
    if (error) {
      throw new Error(`Update payment status: ${error.message}`);
    }
  }

  const customerSeesConfirmed = await waitFor(
    'customer to see confirmed order',
    async () => {
      const row = await maybeSingle(
        customer
          .from('orders')
          .select('id, status, payment_status, rider_id')
          .eq('id', createdOrder.id),
        'Customer load order after payment',
      );
      return row?.payment_status === 'paid' ? row : null;
    },
    { timeoutMs: 15000, intervalMs: pollIntervalMs },
  );
  log('customer', 'Customer can see paid order', customerSeesConfirmed);

  if (restaurantRow.auto_accept === false) {
    log('restaurant', 'Restaurant is manual-accept. Moving order to preparing.');
    const { error } = await restaurant
      .from('orders')
      .update({ status: 'preparing', updated_at: nowIso() })
      .eq('id', createdOrder.id);
    if (error) {
      throw new Error(`Restaurant accept order: ${error.message}`);
    }
  } else {
    log('restaurant', 'Restaurant auto_accept is true. Advancing order to preparing for kitchen stage.');
    const { error } = await restaurant
      .from('orders')
      .update({ status: 'preparing', updated_at: nowIso() })
      .eq('id', createdOrder.id);
    if (error) {
      throw new Error(`Restaurant set preparing: ${error.message}`);
    }
  }

  log('restaurant', 'Restaurant marking order ready_for_pickup to trigger dispatch');
  {
    const { error } = await restaurant
      .from('orders')
      .update({ status: 'ready_for_pickup', updated_at: nowIso() })
      .eq('id', createdOrder.id);
    if (error) {
      throw new Error(`Restaurant mark ready_for_pickup: ${error.message}`);
    }
  }

  const waitForOffer = () =>
    waitFor(
      'rider offer',
      async () => {
        const rows = await rider
          .from('order_offers')
          .select('id, order_id, rider_id, status, expires_at, created_at')
          .eq('rider_id', riderUser.id)
          .eq('order_id', createdOrder.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });
        if (rows.error) throw new Error(rows.error.message);
        return rows.data?.[0] ?? null;
      },
      { timeoutMs: dispatchTimeoutMs, intervalMs: pollIntervalMs },
    );

  let currentOffer = await waitForOffer();
  log('dispatch', 'Rider received order offer', currentOffer);

  if (args['decline-first']) {
    log('rider', 'Declining first offer to prove redispatch works');
    const { error } = await rider
      .from('order_offers')
      .update({ status: 'declined' })
      .eq('id', currentOffer.id)
      .eq('status', 'pending');
    if (error) {
      throw new Error(`Decline first offer: ${error.message}`);
    }

    currentOffer = await waitForOffer();
    log('dispatch', 'Rider received re-dispatched offer', currentOffer);
  }

  log('rider', 'Accepting offer and claiming the order');
  {
    const stamp = nowIso();
    const { data, error } = await rider
      .from('orders')
      .update({
        rider_id: riderUser.id,
        status: 'out_for_delivery',
        accepted_at: stamp,
        updated_at: stamp,
      })
      .eq('id', createdOrder.id)
      .is('rider_id', null)
      .in('status', ['confirmed', 'preparing', 'ready_for_pickup'])
      .select('id, rider_id, status')
      .maybeSingle();

    if (error) {
      throw new Error(`Accept offer/order: ${error.message}`);
    }
    if (!data) {
      throw new Error('Order was not claimable. Another rider may have accepted it.');
    }

    const { error: offerError } = await rider
      .from('order_offers')
      .update({ status: 'accepted' })
      .eq('id', currentOffer.id)
      .eq('status', 'pending');
    if (offerError) {
      throw new Error(`Mark offer accepted: ${offerError.message}`);
    }

    const { error: availabilityError } = await rider
      .from('profiles')
      .update({ is_available: false, updated_at: stamp })
      .eq('id', riderUser.id);
    if (availabilityError) {
      throw new Error(`Mark rider unavailable: ${availabilityError.message}`);
    }
  }

  const customerSeesRider = await waitFor(
    'customer to see rider assignment',
    async () => {
      const row = await maybeSingle(
        customer
          .from('orders')
          .select('id, status, payment_status, rider_id')
          .eq('id', createdOrder.id),
        'Customer load order after rider accept',
      );
      return row?.rider_id ? row : null;
    },
    { timeoutMs: 20000, intervalMs: pollIntervalMs },
  );
  log('customer', 'Customer can see assigned rider and active delivery', customerSeesRider);

  log('rider', 'Marking order picked_up');
  {
    const stamp = nowIso();
    const { error } = await rider
      .from('orders')
      .update({
        status: 'picked_up',
        picked_up_at: stamp,
        updated_at: stamp,
      })
      .eq('id', createdOrder.id)
      .eq('rider_id', riderUser.id);
    if (error) {
      throw new Error(`Mark picked_up: ${error.message}`);
    }
  }

  const riderOrder = await waitFor(
    'rider assigned order with delivery code',
    async () => {
      const row = await maybeSingle(
        rider
          .from('orders')
          .select('id, status, rider_id, delivery_code, order_number')
          .eq('id', createdOrder.id),
        'Rider load assigned order',
      );
      return row?.delivery_code ? row : null;
    },
    { timeoutMs: 15000, intervalMs: pollIntervalMs },
  );
  log('rider', 'Loaded delivery code for final handoff', {
    orderId: riderOrder.id,
    orderNumber: riderOrder.order_number,
    deliveryCode: riderOrder.delivery_code,
  });

  log('rider', 'Completing delivery with the generated delivery code');
  {
    const stamp = nowIso();
    const { error } = await rider
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: stamp,
        updated_at: stamp,
      })
      .eq('id', createdOrder.id)
      .eq('rider_id', riderUser.id);
    if (error) {
      throw new Error(`Mark delivered: ${error.message}`);
    }

    const { error: availableError } = await rider
      .from('profiles')
      .update({
        is_available: true,
        updated_at: stamp,
      })
      .eq('id', riderUser.id);
    if (availableError) {
      throw new Error(`Mark rider available after delivery: ${availableError.message}`);
    }
  }

  const finalCustomerView = await waitFor(
    'customer to see delivered order',
    async () => {
      const row = await maybeSingle(
        customer
          .from('orders')
          .select('id, status, payment_status, rider_id, updated_at')
          .eq('id', createdOrder.id),
        'Customer load final order',
      );
      return row?.status === 'delivered' ? row : null;
    },
    { timeoutMs: 20000, intervalMs: pollIntervalMs },
  );

  log('done', 'End-to-end order flow simulation completed successfully', {
    orderId: createdOrder.id,
    finalStatus: finalCustomerView.status,
    paymentStatus: finalCustomerView.payment_status,
    riderId: finalCustomerView.rider_id,
  });
}

main().catch((error) => {
  console.error(`\nE2E order-flow simulation failed:\n${error.stack || error.message}`);
  process.exit(1);
});
