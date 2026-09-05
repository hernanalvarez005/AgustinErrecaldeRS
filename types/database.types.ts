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
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          body: string;
          contact_id?: string | null;
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
          priority: TaskPriority;
          due_at: string | null;
          status: TaskStatus;
          assigned_to: string | null;
          completed_at: string | null;
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
          priority?: TaskPriority;
          due_at?: string | null;
          status?: TaskStatus;
          assigned_to?: string | null;
          completed_at?: string | null;
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
