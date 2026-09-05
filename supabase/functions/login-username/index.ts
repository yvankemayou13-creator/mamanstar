import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { username, password, expectedRole } = body;

    if (!username || !password) {
      return new Response(JSON.stringify({ error: "Nom d'utilisateur et mot de passe requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up profile by username (case-insensitive)
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, email, role, username, full_name")
      .ilike("username", username)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: "Nom d'utilisateur introuvable" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user's role matches the expected role
    if (expectedRole && profile.role !== expectedRole) {
      return new Response(JSON.stringify({
        error: `Ce compte n'est pas un compte ${expectedRole}. Veuillez sélectionner le bon profil.`,
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sign in with the email associated with this username
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: signInData, error: signInError } = await userClient.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    if (signInError || !signInData.session) {
      return new Response(JSON.stringify({ error: "Mot de passe incorrect" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      session: signInData.session,
      profile: {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        full_name: profile.full_name,
        role: profile.role,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
