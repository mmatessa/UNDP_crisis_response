/*
  # Add UNDP Required Fields

  1. New Columns
    - `infrastructure_name` (text) - Name/details of the specific infrastructure
    - `crisis_nature` (text[]) - Array of crisis types (natural, technological, human-made)
    - `debris_clearance_required` (boolean) - Whether debris clearance is needed

  2. Notes
    - infrastructure_type values will now use new categories:
      - residential_infrastructure
      - commercial_infrastructure  
      - government_building
      - utility_infrastructure
      - transport_communication_infrastructure
      - community_infrastructure
      - public_spaces_recreation_infrastructure
      - other
*/

ALTER TABLE crisis_submissions
ADD COLUMN IF NOT EXISTS infrastructure_name text,
ADD COLUMN IF NOT EXISTS crisis_nature text[],
ADD COLUMN IF NOT EXISTS debris_clearance_required boolean DEFAULT false;