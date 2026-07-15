// Server-side Supabase client
// Add SUPABASE_URL and SUPABASE_SERVICE_KEY to Vercel env vars

export async function getSupabase() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

// Get user by email — used when Stripe webhook provides an email
export async function getUserByEmail(supabase, email) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  return data;
}

// Get user by Stripe customer ID — used by webhooks
export async function getUserByStripeId(supabase, stripeCustomerId) {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('stripe_customer_id', stripeCustomerId)
    .single();
  return data;
}

// Increment generation count and check quota
export async function checkAndIncrementUsage(supabase, userId) {
  // Get current user
  const { data: user } = await supabase
    .from('users')
    .select('generations_used, generations_limit')
    .eq('id', userId)
    .single();
  if (!user) return { allowed: false, reason: 'User not found' };
  if (user.generations_used >= user.generations_limit) {
    return { allowed: false, reason: 'quota_exceeded', used: user.generations_used, limit: user.generations_limit };
  }
  // Increment
  await supabase
    .from('users')
    .update({ generations_used: user.generations_used + 1 })
    .eq('id', userId);
  return { allowed: true, used: user.generations_used + 1, limit: user.generations_limit };
}

// Update user's subscription after Stripe checkout
export async function updateUserSubscription(supabase, email, plan, stripeCustomerId, status) {
  const limitMap = { starter: 50, creator: 200, enterprise: 999999 };
  const generationLimit = limitMap[plan] || 3;
  const { data, error } = await supabase
    .from('users')
    .update({
      subscription_plan: plan,
      subscription_status: status || 'active',
      stripe_customer_id: stripeCustomerId,
      generations_limit: generationLimit,
      generations_used: 0, // Reset monthly counter on new subscription
    })
    .eq('email', email)
    .select()
    .single();
  if (error) console.error('Update subscription error:', error);
  return data;
}

// Create a new user
export async function createUser(supabase, { email, name }) {
  const { data, error } = await supabase
    .from('users')
    .insert({ email, name: name || email.split('@')[0] })
    .select()
    .single();
  if (error) console.error('Create user error:', error);
  return data;
}
