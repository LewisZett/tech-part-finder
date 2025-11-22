-- Create storage bucket for part images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('part-images', 'part-images', true);

-- Allow authenticated users to upload their own part images
CREATE POLICY "Users can upload part images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'part-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow anyone to view part images (public bucket)
CREATE POLICY "Anyone can view part images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'part-images');

-- Allow users to update their own part images
CREATE POLICY "Users can update their own part images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'part-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own part images
CREATE POLICY "Users can delete their own part images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'part-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);