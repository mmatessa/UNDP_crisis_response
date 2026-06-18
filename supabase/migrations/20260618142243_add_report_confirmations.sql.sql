/*
  # Report Confirmations (Verified Witness badge)

  1. New Tables
    - `report_confirmations`
      - `id` (uuid, primary key)
      - `submission_id` (uuid, FK to crisis_submissions) - the report being confirmed
      - `confirmed_by` (text, nullable) - name/alias of the confirming user (anonymous allowed)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `report_confirmations`.
    - Public read (community transparency) + public insert (crisis context, no auth).

  3. Notes
    - A report counts as "verified" when it has 1+ confirmation from ANOTHER user.
    - Self-confirmations (same submitted_by) are excluded at query time so a user
      cannot verify their own report to earn the Verified Witness badge.
    - Anonymous confirmations are welcome and counted.
*/

CREATE TABLE IF NOT EXISTS report_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES crisis_submissions(id) ON DELETE CASCADE,
  confirmed_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE report_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view report confirmations" ON report_confirmations;
CREATE POLICY "Anyone can view report confirmations"
  ON report_confirmations
  FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can create report confirmations" ON report_confirmations;
CREATE POLICY "Anyone can create report confirmations"
  ON report_confirmations
  FOR INSERT
  TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_report_confirmations_submission_id ON report_confirmations(submission_id);
CREATE INDEX IF NOT EXISTS idx_report_confirmations_confirmed_by ON report_confirmations(confirmed_by);
