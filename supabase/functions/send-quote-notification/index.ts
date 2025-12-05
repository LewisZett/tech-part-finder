import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuoteNotificationRequest {
  quoteId: string;
  action: "accepted" | "rejected" | "sent";
  proposedPrice: number;
  itemName: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quoteId, action, proposedPrice, itemName }: QuoteNotificationRequest = await req.json();
    
    console.log("Sending quote notification:", { quoteId, action, proposedPrice, itemName });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized: Missing authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("Authentication error:", authError);
      throw new Error("Unauthorized: Invalid token");
    }

    // Fetch the quote details
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) {
      throw new Error("Quote not found");
    }

    // Verify user is part of this quote
    if (user.id !== quote.sender_id && user.id !== quote.receiver_id) {
      throw new Error("Unauthorized: You are not part of this quote");
    }

    // Fetch profiles
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", [quote.sender_id, quote.receiver_id]);

    if (profileError || !profiles) {
      throw new Error("Could not fetch user profiles");
    }

    const sender = profiles.find(p => p.id === quote.sender_id);
    const receiver = profiles.find(p => p.id === quote.receiver_id);

    if (!sender || !receiver) {
      throw new Error("Could not find user profiles");
    }

    console.log("Found profiles:", { sender: sender.email, receiver: receiver.email });

    let emailTo: string | null = null;
    let subject = "";
    let htmlContent = "";

    const appUrl = "https://f7924cab-c4a6-4be9-858a-bd831e301139.lovableproject.com";

    if (action === "accepted") {
      // Notify the quote sender that their quote was accepted
      emailTo = sender.email;
      subject = `Your quote for "${itemName}" was accepted!`;
      htmlContent = `
        <h1>Quote Accepted!</h1>
        <p>Hi ${sender.full_name || "there"},</p>
        <p>Great news! ${receiver.full_name || "The other party"} has accepted your quote of <strong>$${proposedPrice.toFixed(2)}</strong> for "${itemName}".</p>
        <p>You can now proceed to create an order and finalize the transaction.</p>
        <p><a href="${appUrl}/matches" style="background-color: #22C55E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">View Match & Create Order</a></p>
        <p>Best regards,<br>Parts Connect Pro Team</p>
      `;
    } else if (action === "rejected") {
      // Notify the quote sender that their quote was rejected
      emailTo = sender.email;
      subject = `Your quote for "${itemName}" was not accepted`;
      htmlContent = `
        <h1>Quote Update</h1>
        <p>Hi ${sender.full_name || "there"},</p>
        <p>${receiver.full_name || "The other party"} has declined your quote of <strong>$${proposedPrice.toFixed(2)}</strong> for "${itemName}".</p>
        <p>You can send a new quote or continue negotiating through messages.</p>
        <p><a href="${appUrl}/matches" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">View Match</a></p>
        <p>Best regards,<br>Parts Connect Pro Team</p>
      `;
    } else if (action === "sent") {
      // Notify the receiver about a new quote
      emailTo = receiver.email;
      subject = `New quote received for "${itemName}"`;
      htmlContent = `
        <h1>New Quote Received!</h1>
        <p>Hi ${receiver.full_name || "there"},</p>
        <p>${sender.full_name || "Someone"} has sent you a quote of <strong>$${proposedPrice.toFixed(2)}</strong> for "${itemName}".</p>
        <p>Review the quote and respond to continue the negotiation.</p>
        <p><a href="${appUrl}/matches" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">View & Respond to Quote</a></p>
        <p>Best regards,<br>Parts Connect Pro Team</p>
      `;
    }

    if (emailTo) {
      const emailResponse = await resend.emails.send({
        from: "Parts Connect Pro <onboarding@resend.dev>",
        to: [emailTo],
        subject,
        html: htmlContent,
      });

      console.log("Email sent successfully:", emailResponse);
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-quote-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
