import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrderNotificationRequest {
  orderId: string;
  action: "created" | "shipped" | "delivered";
  trackingNumber?: string;
  shippingCarrier?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orderId, action, trackingNumber, shippingCarrier }: OrderNotificationRequest = await req.json();
    
    console.log("Sending order notification:", { orderId, action, trackingNumber, shippingCarrier });

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

    // Fetch order with part details
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        parts(part_name)
      `)
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      throw new Error("Order not found");
    }

    // Verify user is part of this order
    if (user.id !== order.buyer_id && user.id !== order.seller_id) {
      throw new Error("Unauthorized: You are not part of this order");
    }

    // Fetch profiles
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", [order.buyer_id, order.seller_id]);

    if (profileError || !profiles) {
      throw new Error("Could not fetch user profiles");
    }

    const buyer = profiles.find(p => p.id === order.buyer_id);
    const seller = profiles.find(p => p.id === order.seller_id);

    if (!buyer || !seller) {
      throw new Error("Could not find user profiles");
    }

    console.log("Found profiles:", { buyer: buyer.email, seller: seller.email });

    const itemName = order.parts?.part_name || "your item";
    const appUrl = "https://f7924cab-c4a6-4be9-858a-bd831e301139.lovableproject.com";
    const emailPromises = [];

    if (action === "created") {
      // Notify seller about new order
      if (seller.email) {
        emailPromises.push(
          resend.emails.send({
            from: "Parts Connect Pro <onboarding@resend.dev>",
            to: [seller.email],
            subject: `New Order: "${itemName}" has been purchased!`,
            html: `
              <h1>New Order Received!</h1>
              <p>Hi ${seller.full_name || "there"},</p>
              <p>${buyer.full_name || "A buyer"} has placed an order for "<strong>${itemName}</strong>" at <strong>$${order.final_price.toFixed(2)}</strong>.</p>
              <p>Please confirm the order and prepare for shipping.</p>
              <p><a href="${appUrl}/orders" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">View Order Details</a></p>
              <p>Best regards,<br>Parts Connect Pro Team</p>
            `,
          })
        );
      }

      // Notify buyer about order confirmation
      if (buyer.email) {
        emailPromises.push(
          resend.emails.send({
            from: "Parts Connect Pro <onboarding@resend.dev>",
            to: [buyer.email],
            subject: `Order Confirmed: "${itemName}"`,
            html: `
              <h1>Order Confirmed!</h1>
              <p>Hi ${buyer.full_name || "there"},</p>
              <p>Your order for "<strong>${itemName}</strong>" at <strong>$${order.final_price.toFixed(2)}</strong> has been placed successfully.</p>
              <p>The seller will confirm and ship your order soon.</p>
              <p><a href="${appUrl}/orders" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Track Your Order</a></p>
              <p>Best regards,<br>Parts Connect Pro Team</p>
            `,
          })
        );
      }
    } else if (action === "shipped") {
      // Notify buyer that order has shipped
      if (buyer.email) {
        const trackingInfo = trackingNumber && shippingCarrier 
          ? `<p><strong>Carrier:</strong> ${shippingCarrier}<br><strong>Tracking Number:</strong> ${trackingNumber}</p>`
          : "";

        emailPromises.push(
          resend.emails.send({
            from: "Parts Connect Pro <onboarding@resend.dev>",
            to: [buyer.email],
            subject: `Your order for "${itemName}" has shipped!`,
            html: `
              <h1>Order Shipped!</h1>
              <p>Hi ${buyer.full_name || "there"},</p>
              <p>Great news! Your order for "<strong>${itemName}</strong>" has been shipped by ${seller.full_name || "the seller"}.</p>
              ${trackingInfo}
              <p>You'll receive it soon. Once delivered, please confirm delivery on the Orders page.</p>
              <p><a href="${appUrl}/orders" style="background-color: #22C55E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">Track Your Order</a></p>
              <p>Best regards,<br>Parts Connect Pro Team</p>
            `,
          })
        );
      }
    } else if (action === "delivered") {
      // Notify seller that order was delivered
      if (seller.email) {
        emailPromises.push(
          resend.emails.send({
            from: "Parts Connect Pro <onboarding@resend.dev>",
            to: [seller.email],
            subject: `Order delivered: "${itemName}"`,
            html: `
              <h1>Order Delivered!</h1>
              <p>Hi ${seller.full_name || "there"},</p>
              <p>${buyer.full_name || "The buyer"} has confirmed delivery of "<strong>${itemName}</strong>".</p>
              <p>Transaction complete! Thank you for using Parts Connect Pro.</p>
              <p><a href="${appUrl}/orders" style="background-color: #22C55E; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">View Your Sales</a></p>
              <p>Best regards,<br>Parts Connect Pro Team</p>
            `,
          })
        );
      }
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
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error in send-order-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
