export type DamageLevel = 'minimal' | 'partial' | 'destroyed';

export interface CrisisSubmission {
  id: string;
  photo_url: string;
  description: string;
  damage_level: DamageLevel;
  infrastructure_type: string;
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
