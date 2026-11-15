import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = Object.fromEntries(
    envFile.split('\n').filter(Boolean).map(line => line.split('='))
);

const supabase = createClient(
    envVars['VITE_SUPABASE_URL'],
    envVars['VITE_SUPABASE_ANON_KEY']
);

async function testQuery() {
    const { data, count } = await supabase.from('profiles').select('*', { count: 'exact' });
    console.log('Total Profiles:', count);
    console.log('Roles:', data?.map(d => d.role));
}

testQuery();
