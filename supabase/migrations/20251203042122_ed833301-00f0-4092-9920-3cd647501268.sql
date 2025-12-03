-- 1. Add unique constraint on matches to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS matches_unique_part_idx 
ON public.matches (part_id, requester_id) 
WHERE part_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS matches_unique_request_idx 
ON public.matches (request_id, supplier_id) 
WHERE request_id IS NOT NULL;

-- 2. Add DELETE policy on matches table
CREATE POLICY "Users can delete own matches" 
ON public.matches 
FOR DELETE 
USING ((auth.uid() = supplier_id) OR (auth.uid() = requester_id));

-- 3. Enhance ratings table with additional fields
ALTER TABLE public.ratings 
ADD COLUMN IF NOT EXISTS rating_type text DEFAULT 'general',
ADD COLUMN IF NOT EXISTS seller_response text,
ADD COLUMN IF NOT EXISTS verified_purchase boolean DEFAULT false;

-- 4. Add policy to only allow ratings on completed matches
DROP POLICY IF EXISTS "Users can insert ratings for completed matches" ON public.ratings;
CREATE POLICY "Users can insert ratings for completed matches" 
ON public.ratings 
FOR INSERT 
WITH CHECK (
  auth.uid() = rater_id 
  AND EXISTS (
    SELECT 1 FROM matches 
    WHERE matches.id = ratings.match_id 
    AND matches.status = 'both_agreed'
    AND (matches.supplier_id = auth.uid() OR matches.requester_id = auth.uid())
  )
);

-- 5. Add index for faster browse queries
CREATE INDEX IF NOT EXISTS idx_parts_status_category ON public.parts (status, category);
CREATE INDEX IF NOT EXISTS idx_part_requests_status_category ON public.part_requests (status, category);