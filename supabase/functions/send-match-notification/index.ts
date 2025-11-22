import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  matchId: string;
  supplierId: string;
  requesterId: string;
  itemName: string;
  itemType: "part" | "request";
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { matchId, supplierId, requesterId, itemName, itemType }: NotificationRequest = await req.json();
    
    console.log("Sending match notifications:", { matchId, supplierId, requesterId, itemName, itemType });

    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized: Missing authorization header");
    }

    // Create Supabase client with the user's JWT for authorization
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Authentication error:", authError);
      throw new Error("Unauthorized: Invalid token");
    }

    // Verify user is part of this match
    if (user.id !== supplierId && user.id !== requesterId) {
      console.error("Authorization failed: User not part of match", { 
        userId: user.id, 
        supplierId, 
        requesterId 
      });
      throw new Error("Unauthorized: You are not part of this match");
    }

    console.log("Authorization successful:", { userId: user.id });

    // Fetch both users' profiles
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name, phone_number")
      .in("id", [supplierId, requesterId]);

    if (profileError) {
      console.error("Error fetching profiles:", profileError);
      throw profileError;
    }

    const supplier = profiles?.find(p => p.id === supplierId);
    const requester = profiles?.find(p => p.id === requesterId);

    if (!supplier || !requester) {
      throw new Error("Could not find user profiles");
    }

    console.log("Found profiles:", { 
      supplier: supplier.email, 
      requester: requester.email 
    });

    // Create WhatsApp links
    const createWhatsAppLink = (phoneNumber: string | null, message: string) => {
      if (!phoneNumber) return null;
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    };

    const supplierWhatsAppMessage = `Hi! I found a match for "${itemName}" on Parts Connect Pro. Someone is interested in your ${itemType}. Check your matches to connect!`;
    const requesterWhatsAppMessage = `Hi! I found a match for "${itemName}" on Parts Connect Pro. A supplier has what you're looking for. Check your matches to connect!`;

    const supplierWhatsAppLink = createWhatsAppLink(supplier.phone_number, supplierWhatsAppMessage);
    const requesterWhatsAppLink = createWhatsAppLink(requester.phone_number, requesterWhatsAppMessage);

    // Send email to supplier
    const supplierEmailHtml = `
      <h1>New Match Found!</h1>
      <p>Hi ${supplier.full_name},</p>
      <p>Good news! Someone is interested in your ${itemType}: <strong>"${itemName}"</strong></p>
      <p>A ${requester.full_name} wants to connect with you about this ${itemType}.</p>
      <p><a href="${supabaseUrl.replace('hxbemcmmnbxsvnmyzoee.supabase.co', 'f7924cab-c4a6-4be9-858a-bd831e301139.lovableproject.com')}/matches" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">View Match</a></p>
      ${supplierWhatsAppLink ? `<p>Or connect via WhatsApp: <a href="${supplierWhatsAppLink}">Click here to open WhatsApp</a></p>` : ''}
      <p>Best regards,<br>Parts Connect Pro Team</p>
    `;

    // Send email to requester
    const requesterEmailHtml = `
      <h1>New Match Found!</h1>
      <p>Hi ${requester.full_name},</p>
      <p>Great news! We found a supplier for "${itemName}"</p>
      <p>${supplier.full_name} has the ${itemType} you're looking for.</p>
      <p><a href="${supabaseUrl.replace('hxbemcmmnbxsvnmyzoee.supabase.co', 'f7924cab-c4a6-4be9-858a-bd831e301139.lovableproject.com')}/matches" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">View Match</a></p>
      ${requesterWhatsAppLink ? `<p>Or connect via WhatsApp: <a href="${requesterWhatsAppLink}">Click here to open WhatsApp</a></p>` : ''}
      <p>Best regards,<br>Parts Connect Pro Team</p>
    `;

    // Send both emails
    const emailPromises = [];

    if (supplier.email) {
      emailPromises.push(
        resend.emails.send({
          from: "Parts Connect Pro <onboarding@resend.dev>",
          to: [supplier.email],
          subject: `New Match: Someone wants "${itemName}"!`,
          html: supplierEmailHtml,
        })
      );
    }

    if (requester.email) {
      emailPromises.push(
        resend.emails.send({
          from: "Parts Connect Pro <onboarding@resend.dev>",
          to: [requester.email],
          subject: `New Match: We found "${itemName}" for you!`,
          html: requesterEmailHtml,
        })
      );
    }

    const results = await Promise.allSettled(emailPromises);
    
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        console.log(`Email ${index + 1} sent successfully:`, result.value);
      } else {
        console.error(`Email ${index + 1} failed:`, result.reason);
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        whatsAppLinks: {
          supplier: supplierWhatsAppLink,
          requester: requesterWhatsAppLink
        }
      }), 
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-match-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
