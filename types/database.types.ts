/**
 * Hand-written Supabase types for Phase 0.
 *
 * Once this project is linked to a real Supabase project (`supabase link`),
 * regenerate this file from the actual schema instead of hand-editing it:
 *
 *   npm run db:types
 *
 * That script runs `supabase gen types typescript --local`, which requires
 * `supabase start` (Docker) to be running against the local migrations.
 *
 * Note: `Insert`/`Update` types below are typed permissively (matching what
 * the columns would accept), but the actual write protection is enforced by
 * Postgres RLS, not by these types — see supabase/migrations for the real
 * guard (organizations/memberships have no INSERT policy; writes only
 * happen through the create_organization() RPC).
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type ContactSource =
  | "whatsapp"
  | "instagram"
  | "zonaprop"
  | "argenprop"
  | "mercadolibre"
  | "remax"
  | "referral"
  | "sign"
  | "web"
  | "own_database"
  | "other";

export type ContactRole =
  | "buyer"
  | "seller"
  | "owner"
  | "investor"
  | "tenant"
  | "landlord"
  | "referrer"
  | "past_client"
  | "other";

export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
export type TaskCategory =
  "follow_up_postventa" | "follow_up_anniversary" | "follow_up_birthday";

export type ActivityType =
  | "call"
  | "whatsapp"
  | "email"
  | "meeting"
  | "virtual_meeting"
  | "property_visit"
  | "acquisition_visit"
  | "valuation"
  | "notary_meeting"
  | "reservation"
  | "contract_signing"
  | "closing"
  | "follow_up"
  | "other";

export type ActivityStatus = "scheduled" | "completed" | "cancelled";

export type PropertyType =
  | "apartment"
  | "house"
  | "ph"
  | "land"
  | "office"
  | "commercial"
  | "warehouse"
  | "other";

export type OperationType = "sale" | "rent" | "temporary_rent";

export type PropertyStatus =
  | "draft"
  | "valuation"
  | "capturing"
  | "active"
  | "reserved"
  | "sold"
  | "rented"
  | "paused"
  | "lost"
  | "archived";

export type AcquisitionStatus =
  | "new_lead"
  | "contacted"
  | "meeting_scheduled"
  | "meeting_completed"
  | "valuation"
  | "proposal_sent"
  | "follow_up"
  | "won"
  | "lost";

export type SearchStatus =
  | "new"
  | "qualified"
  | "searching"
  | "options_sent"
  | "visiting"
  | "negotiating"
  | "reserved"
  | "closed"
  | "paused"
  | "lost";

export type SearchObjective =
  | "primary_residence"
  | "investment"
  | "traditional_rent"
  | "temporary_rent"
  | "relocation"
  | "liquidity_need"
  | "inheritance"
  | "separation"
  | "city_change"
  | "portfolio_expansion"
  | "other";

export type SearchUrgency = "high" | "medium" | "low";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "not_interested"
  | "unresponsive"
  | "lost";

export type DealStatus =
  | "negotiation"
  | "offer"
  | "reservation"
  | "documentation"
  | "contract"
  | "closing"
  | "closed"
  | "cancelled";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          currency: "ARS" | "USD";
          timezone: string;
          main_area: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          currency?: "ARS" | "USD";
          timezone?: string;
          main_area?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          currency?: "ARS" | "USD";
          timezone?: string;
          main_area?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string | null;
          last_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: "owner" | "admin" | "member";
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role?: "owner" | "admin" | "member";
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: "owner" | "admin" | "member";
          created_at?: string;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          phone: string | null;
          whatsapp: string | null;
          email: string | null;
          dni: string | null;
          birth_date: string | null;
          address: string | null;
          profession: string | null;
          source: ContactSource | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          phone?: string | null;
          whatsapp?: string | null;
          email?: string | null;
          dni?: string | null;
          birth_date?: string | null;
          address?: string | null;
          profession?: string | null;
          source?: ContactSource | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Insert"]>;
        Relationships: [];
      };
      contact_roles: {
        Row: {
          id: string;
          contact_id: string;
          role: ContactRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          contact_id: string;
          role: ContactRole;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["contact_roles"]["Insert"]
        >;
        Relationships: [];
      };
      notes: {
        Row: {
          id: string;
          organization_id: string;
          body: string;
          contact_id: string | null;
          property_id: string | null;
          acquisition_id: string | null;
          search_id: string | null;
          lead_id: string | null;
          deal_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          body: string;
          contact_id?: string | null;
          property_id?: string | null;
          acquisition_id?: string | null;
          search_id?: string | null;
          lead_id?: string | null;
          deal_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notes"]["Insert"]>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          description: string | null;
          contact_id: string | null;
          property_id: string | null;
          acquisition_id: string | null;
          search_id: string | null;
          lead_id: string | null;
          deal_id: string | null;
          priority: TaskPriority;
          due_at: string | null;
          status: TaskStatus;
          assigned_to: string | null;
          completed_at: string | null;
          category: TaskCategory | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          description?: string | null;
          contact_id?: string | null;
          property_id?: string | null;
          acquisition_id?: string | null;
          search_id?: string | null;
          lead_id?: string | null;
          deal_id?: string | null;
          priority?: TaskPriority;
          due_at?: string | null;
          status?: TaskStatus;
          assigned_to?: string | null;
          completed_at?: string | null;
          category?: TaskCategory | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: [];
      };
      activities: {
        Row: {
          id: string;
          organization_id: string;
          type: ActivityType;
          title: string | null;
          description: string | null;
          contact_id: string | null;
          property_id: string | null;
          acquisition_id: string | null;
          search_id: string | null;
          lead_id: string | null;
          deal_id: string | null;
          starts_at: string;
          ends_at: string | null;
          status: ActivityStatus;
          location: string | null;
          meeting_url: string | null;
          google_event_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          type: ActivityType;
          title?: string | null;
          description?: string | null;
          contact_id?: string | null;
          property_id?: string | null;
          acquisition_id?: string | null;
          search_id?: string | null;
          lead_id?: string | null;
          deal_id?: string | null;
          starts_at?: string;
          ends_at?: string | null;
          status?: ActivityStatus;
          location?: string | null;
          meeting_url?: string | null;
          google_event_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
        Relationships: [];
      };
      properties: {
        Row: {
          id: string;
          organization_id: string;
          title: string;
          property_type: PropertyType;
          operation_type: OperationType;
          street: string | null;
          street_number: string | null;
          floor: string | null;
          unit: string | null;
          city: string | null;
          neighborhood: string | null;
          province: string | null;
          country: string;
          latitude: number | null;
          longitude: number | null;
          price: number | null;
          currency: "ARS" | "USD" | null;
          bedrooms: number | null;
          bathrooms: number | null;
          garage_spaces: number | null;
          total_area: number | null;
          covered_area: number | null;
          uncovered_area: number | null;
          lot_area: number | null;
          expenses: number | null;
          age_years: number | null;
          description: string | null;
          internal_notes: string | null;
          status: PropertyStatus;
          publication_url: string | null;
          external_reference: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          title: string;
          property_type: PropertyType;
          operation_type: OperationType;
          street?: string | null;
          street_number?: string | null;
          floor?: string | null;
          unit?: string | null;
          city?: string | null;
          neighborhood?: string | null;
          province?: string | null;
          country?: string;
          latitude?: number | null;
          longitude?: number | null;
          price?: number | null;
          currency?: "ARS" | "USD" | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          garage_spaces?: number | null;
          total_area?: number | null;
          covered_area?: number | null;
          uncovered_area?: number | null;
          lot_area?: number | null;
          expenses?: number | null;
          age_years?: number | null;
          description?: string | null;
          internal_notes?: string | null;
          status?: PropertyStatus;
          publication_url?: string | null;
          external_reference?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["properties"]["Insert"]>;
        Relationships: [];
      };
      property_owners: {
        Row: {
          property_id: string;
          contact_id: string;
          ownership_percentage: number | null;
          is_primary_contact: boolean;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          property_id: string;
          contact_id: string;
          ownership_percentage?: number | null;
          is_primary_contact?: boolean;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["property_owners"]["Insert"]
        >;
        Relationships: [];
      };
      property_acquisitions: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          primary_owner_contact_id: string;
          status: AcquisitionStatus;
          origin: ContactSource | null;
          estimated_value: number | null;
          proposed_listing_price: number | null;
          valuation_date: string | null;
          meeting_date: string | null;
          lost_reason: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          property_id: string;
          primary_owner_contact_id: string;
          status?: AcquisitionStatus;
          origin?: ContactSource | null;
          estimated_value?: number | null;
          proposed_listing_price?: number | null;
          valuation_date?: string | null;
          meeting_date?: string | null;
          lost_reason?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["property_acquisitions"]["Insert"]
        >;
        Relationships: [];
      };
      valuations: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          acquisition_id: string | null;
          estimated_min_value: number | null;
          estimated_value: number | null;
          estimated_max_value: number | null;
          currency: "ARS" | "USD" | null;
          recommended_listing_price: number | null;
          valuation_date: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          property_id: string;
          acquisition_id?: string | null;
          estimated_min_value?: number | null;
          estimated_value?: number | null;
          estimated_max_value?: number | null;
          currency?: "ARS" | "USD" | null;
          recommended_listing_price?: number | null;
          valuation_date?: string;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["valuations"]["Insert"]>;
        Relationships: [];
      };
      property_searches: {
        Row: {
          id: string;
          organization_id: string;
          contact_id: string;
          operation_type: OperationType;
          property_types: PropertyType[];
          min_price: number | null;
          max_price: number | null;
          currency: "ARS" | "USD" | null;
          cities: string[];
          neighborhoods: string[];
          min_bedrooms: number | null;
          max_bedrooms: number | null;
          min_total_area: number | null;
          min_covered_area: number | null;
          requires_garage: boolean;
          requires_balcony: boolean;
          requires_patio: boolean;
          requires_elevator: boolean;
          must_have: string | null;
          nice_to_have: string | null;
          objective: SearchObjective | null;
          urgency: SearchUrgency | null;
          expected_decision_date: string | null;
          financing_required: boolean;
          status: SearchStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          contact_id: string;
          operation_type?: OperationType;
          property_types?: PropertyType[];
          min_price?: number | null;
          max_price?: number | null;
          currency?: "ARS" | "USD" | null;
          cities?: string[];
          neighborhoods?: string[];
          min_bedrooms?: number | null;
          max_bedrooms?: number | null;
          min_total_area?: number | null;
          min_covered_area?: number | null;
          requires_garage?: boolean;
          requires_balcony?: boolean;
          requires_patio?: boolean;
          requires_elevator?: boolean;
          must_have?: string | null;
          nice_to_have?: string | null;
          objective?: SearchObjective | null;
          urgency?: SearchUrgency | null;
          expected_decision_date?: string | null;
          financing_required?: boolean;
          status?: SearchStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["property_searches"]["Insert"]
        >;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string | null;
          phone: string | null;
          email: string | null;
          message: string | null;
          source: ContactSource | null;
          property_id: string | null;
          status: LeadStatus;
          assigned_to: string | null;
          contact_id: string | null;
          search_id: string | null;
          notes: string | null;
          first_contact_at: string | null;
          converted_at: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          first_name: string;
          last_name?: string | null;
          phone?: string | null;
          email?: string | null;
          message?: string | null;
          source?: ContactSource | null;
          property_id?: string | null;
          status?: LeadStatus;
          assigned_to?: string | null;
          contact_id?: string | null;
          search_id?: string | null;
          notes?: string | null;
          first_contact_at?: string | null;
          converted_at?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      deals: {
        Row: {
          id: string;
          organization_id: string;
          property_id: string;
          buyer_contact_id: string;
          seller_contact_id: string;
          deal_type: OperationType;
          status: DealStatus;
          asking_price: number | null;
          offer_price: number | null;
          agreed_price: number | null;
          currency: "ARS" | "USD" | null;
          reservation_date: string | null;
          contract_date: string | null;
          closing_date: string | null;
          estimated_commission: number | null;
          commission_currency: "ARS" | "USD" | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          property_id: string;
          buyer_contact_id: string;
          seller_contact_id: string;
          deal_type?: OperationType;
          status?: DealStatus;
          asking_price?: number | null;
          offer_price?: number | null;
          agreed_price?: number | null;
          currency?: "ARS" | "USD" | null;
          reservation_date?: string | null;
          contract_date?: string | null;
          closing_date?: string | null;
          estimated_commission?: number | null;
          commission_currency?: "ARS" | "USD" | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["deals"]["Insert"]>;
        Relationships: [];
      };
      google_calendar_connections: {
        Row: {
          user_id: string;
          google_email: string | null;
          access_token: string;
          refresh_token: string;
          token_expiry: string;
          calendar_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          google_email?: string | null;
          access_token: string;
          refresh_token: string;
          token_expiry: string;
          calendar_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["google_calendar_connections"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: {
      contact_overview: {
        Row: Database["public"]["Tables"]["contacts"]["Row"] & {
          roles: ContactRole[] | null;
          last_interaction_at: string | null;
          next_action_at: string | null;
        };
        Relationships: [];
      };
      property_overview: {
        Row: Database["public"]["Tables"]["properties"]["Row"] & {
          primary_owner_name: string | null;
        };
        Relationships: [];
      };
      search_overview: {
        Row: Database["public"]["Tables"]["property_searches"]["Row"] & {
          contact_first_name: string;
          contact_last_name: string;
          last_interaction_at: string | null;
          next_action_at: string | null;
        };
        Relationships: [];
      };
      lead_overview: {
        Row: Database["public"]["Tables"]["leads"]["Row"] & {
          last_interaction_at: string | null;
          next_action_at: string | null;
        };
        Relationships: [];
      };
      acquisition_overview: {
        Row: Database["public"]["Tables"]["property_acquisitions"]["Row"] & {
          next_action_at: string | null;
          // V2 bloque B: brought in line with search_overview/deal_overview,
          // which already had last_interaction_at — see docs/DATABASE.md.
          last_interaction_at: string | null;
          pending_tasks_count: number;
        };
        Relationships: [];
      };
      deal_overview: {
        Row: Database["public"]["Tables"]["deals"]["Row"] & {
          last_interaction_at: string | null;
          next_action_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_organization: {
        Args: {
          p_name: string;
          p_slug: string;
          p_timezone?: string;
          p_currency?: string;
          p_main_area?: string | null;
          p_first_name?: string | null;
          p_last_name?: string | null;
          p_phone?: string | null;
        };
        Returns: string;
      };
    };
  };
}

// Convenience aliases for app code — avoids repeating the full generic path.
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
export type ContactOverview =
  Database["public"]["Views"]["contact_overview"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Activity = Database["public"]["Tables"]["activities"]["Row"];
export type Property = Database["public"]["Tables"]["properties"]["Row"];
export type PropertyOverview =
  Database["public"]["Views"]["property_overview"]["Row"];
export type PropertyOwner =
  Database["public"]["Tables"]["property_owners"]["Row"];
export type Acquisition =
  Database["public"]["Tables"]["property_acquisitions"]["Row"];
export type AcquisitionOverview =
  Database["public"]["Views"]["acquisition_overview"]["Row"];
export type Valuation = Database["public"]["Tables"]["valuations"]["Row"];
export type PropertySearch =
  Database["public"]["Tables"]["property_searches"]["Row"];
export type SearchOverview =
  Database["public"]["Views"]["search_overview"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type LeadOverview = Database["public"]["Views"]["lead_overview"]["Row"];
export type Deal = Database["public"]["Tables"]["deals"]["Row"];
export type DealOverview = Database["public"]["Views"]["deal_overview"]["Row"];
export type GoogleCalendarConnection =
  Database["public"]["Tables"]["google_calendar_connections"]["Row"];
