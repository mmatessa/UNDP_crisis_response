/*
  # Create Storage Bucket for Crisis Images

  1. New Storage Bucket
    - `crisis-images` - Public bucket for storing crisis report photos
    
  2. Security
    - Enable public access for reading images
    - Allow public uploads (no authentication required for crisis situations)
    
  3. Important Notes
    - Public access is intentional for maximum accessibility during emergencies
    - Images should be accessible to all response actors
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('crisis-images', 'crisis-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public Access for Crisis Images'
  ) THEN
    CREATE POLICY "Public Access for Crisis Images"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'crisis-images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects' 
    AND policyname = 'Public Upload for Crisis Images'
  ) THEN
    CREATE POLICY "Public Upload for Crisis Images"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'crisis-images');
  END IF;
END $$;