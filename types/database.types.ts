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
    };
    Views: {
      [_ in never]: never;
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
