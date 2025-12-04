-- 1. Fix Profile RLS - only show contact info after both parties agree
-- First drop existing policies
DROP POLICY IF EXISTS "Matched users can view contact info" ON public.profiles;

-- Create new policy that only allows viewing contact info when BOTH parties have agreed
CREATE POLICY "Matched users can view contact info after both agree" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = id 
  OR EXISTS (
    SELECT 1 FROM matches
    WHERE matches.status = 'both_agreed'
    AND (
      (matches.supplier_id = auth.uid() AND matches.requester_id = profiles.id)
      OR (matches.requester_id = auth.uid() AND matches.supplier_id = profiles.id)
    )
  )
);

-- 2. Add color/variant field to parts table
ALTER TABLE public.parts ADD COLUMN IF NOT EXISTS color_variant text;

-- 3. Create quotes table for negotiation system
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  proposed_price numeric NOT NULL,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'countered')),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view quotes in their matches"
ON public.quotes FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send quotes in their matches"
ON public.quotes FOR INSERT
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM matches
    WHERE matches.id = match_id
    AND (matches.supplier_id = auth.uid() OR matches.requester_id = auth.uid())
  )
);

CREATE POLICY "Users can update their received quotes"
ON public.quotes FOR UPDATE
USING (auth.uid() = receiver_id);

-- 4. Create orders table for tracking
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  buyer_id uuid NOT NULL,
  seller_id uuid NOT NULL,
  part_id uuid REFERENCES public.parts(id) ON DELETE SET NULL,
  final_price numeric NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  shipping_address text,
  shipping_carrier text,
  tracking_number text,
  estimated_delivery date,
  shipped_at timestamp with time zone,
  delivered_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their orders"
ON public.orders FOR SELECT
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can create orders"
ON public.orders FOR INSERT
WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Sellers can update order status"
ON public.orders FOR UPDATE
USING (auth.uid() = seller_id OR auth.uid() = buyer_id);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_quotes_match_id ON public.quotes(match_id);
CREATE INDEX IF NOT EXISTS idx_quotes_status ON public.quotes(status);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_id ON public.orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- Add updated_at triggers
CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();