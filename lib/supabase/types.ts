export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          slug: string;
          name: string;
          category: string;
          description: string | null;
          address: string | null;
          city: string | null;
          logo_url: string | null;
          qr_code_url: string | null;
          owner_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          category: string;
          description?: string | null;
          address?: string | null;
          city?: string | null;
          logo_url?: string | null;
          qr_code_url?: string | null;
          owner_user_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["businesses"]["Insert"]>;
      };
      customer_profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          email: string | null;
          wallet_address: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone?: string | null;
          email?: string | null;
          wallet_address?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_profiles"]["Insert"]>;
      };
      business_memberships: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          points_balance: number;
          credit_balance_cents: number;
          tier: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          points_balance?: number;
          credit_balance_cents?: number;
          tier?: string;
          joined_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["business_memberships"]["Insert"]>;
      };
      rewards: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          type: string;
          description: string | null;
          points_required: number | null;
          credit_amount_cents: number | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          type: string;
          description?: string | null;
          points_required?: number | null;
          credit_amount_cents?: number | null;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rewards"]["Insert"]>;
      };
      missions: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          category: string;
          description: string | null;
          goal: number;
          reward_points: number;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          category: string;
          description?: string | null;
          goal?: number;
          reward_points?: number;
          active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["missions"]["Insert"]>;
      };
      customer_missions: {
        Row: {
          id: string;
          mission_id: string;
          customer_id: string;
          progress: number;
          completed_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          mission_id: string;
          customer_id: string;
          progress?: number;
          completed_at?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["customer_missions"]["Insert"]>;
      };
      stamp_cards: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          reward_name: string;
          current_stamps: number;
          required_stamps: number;
          active: boolean;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          reward_name: string;
          current_stamps?: number;
          required_stamps?: number;
          active?: boolean;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stamp_cards"]["Insert"]>;
      };
      loyalty_events: {
        Row: {
          id: string;
          business_id: string;
          customer_id: string;
          event_type: string;
          points_delta: number;
          credit_delta_cents: number;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          customer_id: string;
          event_type: string;
          points_delta?: number;
          credit_delta_cents?: number;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["loyalty_events"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
