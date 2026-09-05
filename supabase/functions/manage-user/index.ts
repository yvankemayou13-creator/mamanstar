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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: callerData, error: callerError } = await supabase.auth.getUser(token);
    if (callerError || !callerData.user) {
      return new Response(JSON.stringify({ error: "Non autorisé" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerProfile = await supabase
      .from("profiles")
      .select("role")
      .eq("id", callerData.user.id)
      .maybeSingle();

    if (callerProfile.data?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Accès refusé : administrateur uniquement" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, userId, username, password, role, full_name } = body;

    // Update user
    if (action === "update") {
      const updateData: any = {};
      if (password) {
        if (password.length < 6) {
          return new Response(JSON.stringify({ error: "Le mot de passe doit contenir au moins 6 caractères" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        updateData.password = password;
      }

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId, updateData);
        if (updateError) {
          return new Response(JSON.stringify({ error: updateError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      // Update profile fields
      const profileUpdate: any = {};
      if (username) profileUpdate.username = username;
      if (full_name) profileUpdate.full_name = full_name;
      if (role) {
        const validRoles = ["admin", "vendeur", "comptable"];
        if (!validRoles.includes(role)) {
          return new Response(JSON.stringify({ error: "Rôle invalide" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        profileUpdate.role = role;
      }

      if (Object.keys(profileUpdate).length > 0) {
        const { error: profError } = await supabase.from("profiles").update(profileUpdate).eq("id", userId);
        if (profError) {
          return new Response(JSON.stringify({ error: profError.message }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      return new Response(JSON.stringify({ success: true, message: "Utilisateur modifié avec succès" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete user
    if (action === "delete") {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase.from("profiles").delete().eq("id", userId);

      return new Response(JSON.stringify({ success: true, message: "Utilisateur supprimé avec succès" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Action inconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
