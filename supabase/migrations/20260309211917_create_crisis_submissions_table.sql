/*
  # Crisis Response Submissions Schema

  1. New Tables
    - `crisis_submissions`
      - `id` (uuid, primary key) - Unique identifier for each submission
      - `photo_url` (text) - URL to the uploaded photo
      - `description` (text) - Damage description provided by community member
      - `damage_level` (text) - Classification: 'minimal', 'partial', or 'destroyed'
      - `infrastructure_type` (text) - Type of infrastructure affected (hospital, school, road, bridge, etc.)
      - `latitude` (decimal) - Geographic latitude coordinate
      - `longitude` (decimal) - Geographic longitude coordinate
      - `location_name` (text, nullable) - Human-readable location name
      - `submitted_by` (text, nullable) - Optional contact information
      - `created_at` (timestamptz) - Timestamp of submission
      
  2. Security
    - Enable RLS on `crisis_submissions` table
    - Add policy for public read access (anyone can view submissions)
    - Add policy for public write access (anyone can submit in crisis situations)
    
  3. Important Notes
    - Public access is intentional for crisis response scenarios
    - Data should be accessible to all response actors
    - No authentication required to ensure maximum accessibility during emergencies
*/

CREATE TABLE IF NOT EXISTS crisis_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_url text NOT NULL,
  description text NOT NULL,
  damage_level text NOT NULL CHECK (damage_level IN ('minimal', 'partial', 'destroyed')),
  infrastructure_type text NOT NULL,
  latitude decimal(10, 8) NOT NULL,
  longitude decimal(11, 8) NOT NULL,
  location_name text,
  submitted_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crisis_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view crisis submissions"
  ON crisis_submissions
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can create crisis submissions"
  ON crisis_submissions
  FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_crisis_submissions_created_at ON crisis_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crisis_submissions_damage_level ON crisis_submissions(damage_level);
CREATE INDEX IF NOT EXISTS idx_crisis_submissions_location ON crisis_submissions(latitude, longitude);