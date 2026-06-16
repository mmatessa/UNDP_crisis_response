export type DamageLevel = 'minimal' | 'partial' | 'destroyed';

export type InfrastructureType =
  | 'residential_infrastructure'
  | 'commercial_infrastructure'
  | 'government_building'
  | 'utility_infrastructure'
  | 'transport_communication_infrastructure'
  | 'community_infrastructure'
  | 'public_spaces_recreation_infrastructure'
  | 'other';

export type CrisisNature =
  | 'earthquake'
  | 'flood'
  | 'tsunami'
  | 'hurricane_cyclone'
  | 'wildfire'
  | 'explosion'
  | 'chemical_incident'
  | 'conflict'
  | 'civil_unrest';

export interface CrisisSubmission {
  id: string;
  photo_url: string;
  description: string;
  damage_level: DamageLevel;
  infrastructure_type: InfrastructureType | string;
  infrastructure_name: string | null;
  crisis_nature: CrisisNature[] | null;
  debris_clearance_required: boolean;
  latitude: number;
  longitude: number;
  location_name: string | null;
  submitted_by: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      crisis_submissions: {
        Row: CrisisSubmission;
        Insert: Omit<CrisisSubmission, 'id' | 'created_at'>;
        Update: Partial<Omit<CrisisSubmission, 'id' | 'created_at'>>;
      };
    };
  };
}
