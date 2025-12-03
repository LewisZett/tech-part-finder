export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      matches: {
        Row: {
          created_at: string | null
          id: string
          part_id: string | null
          request_id: string | null
          requester_agreed: boolean | null
          requester_id: string
          status: string | null
          supplier_agreed: boolean | null
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          part_id?: string | null
          request_id?: string | null
          requester_agreed?: boolean | null
          requester_id: string
          status?: string | null
          supplier_agreed?: boolean | null
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          part_id?: string | null
          request_id?: string | null
          requester_agreed?: boolean | null
          requester_id?: string
          status?: string | null
          supplier_agreed?: boolean | null
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_part_id_fkey"
            columns: ["part_id"]
            isOneToOne: false
            referencedRelation: "parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "part_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          match_id: string
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          match_id: string
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          match_id?: string
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      part_requests: {
        Row: {
          category: string
          condition_preference: string | null
          created_at: string | null
          description: string | null
          id: string
          location: string | null
          max_price: number | null
          part_name: string
          requester_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          condition_preference?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string | null
          max_price?: number | null
          part_name: string
          requester_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          condition_preference?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          location?: string | null
          max_price?: number | null
          part_name?: string
          requester_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      parts: {
        Row: {
          category: string
          condition: string
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          location: string | null
          part_name: string
          price: number | null
          status: string | null
          supplier_id: string
          updated_at: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_year_from: number | null
          vehicle_year_to: number | null
        }
        Insert: {
          category: string
          condition: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          part_name: string
          price?: number | null
          status?: string | null
          supplier_id: string
          updated_at?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year_from?: number | null
          vehicle_year_to?: number | null
        }
        Update: {
          category?: string
          condition?: string
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          part_name?: string
          price?: number | null
          status?: string | null
          supplier_id?: string
          updated_at?: string | null
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_year_from?: number | null
          vehicle_year_to?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_verified: boolean | null
          phone_number: string | null
          trade_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_verified?: boolean | null
          phone_number?: string | null
          trade_type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_verified?: boolean | null
          phone_number?: string | null
          trade_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          call_count: number
          created_at: string
          function_name: string
          id: string
          last_call_at: string
          user_id: string
        }
        Insert: {
          call_count?: number
          created_at?: string
          function_name: string
          id?: string
          last_call_at?: string
          user_id: string
        }
        Update: {
          call_count?: number
          created_at?: string
          function_name?: string
          id?: string
          last_call_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          match_id: string
          rated_id: string
          rater_id: string
          rating: number
          rating_type: string | null
          seller_response: string | null
          verified_purchase: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          match_id: string
          rated_id: string
          rater_id: string
          rating: number
          rating_type?: string | null
          seller_response?: string | null
          verified_purchase?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          match_id?: string
          rated_id?: string
          rater_id?: string
          rating?: number
          rating_type?: string | null
          seller_response?: string | null
          verified_purchase?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "ratings_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          details: Json | null
          event_category: string
          event_type: string
          id: string
          ip_address: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_category: string
          event_type: string
          id?: string
          ip_address?: string | null
          severity: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_category?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string | null
          is_verified: boolean | null
          trade_type: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_verified?: boolean | null
          trade_type?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_verified?: boolean | null
          trade_type?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      cleanup_old_rate_limits: { Args: never; Returns: undefined }
      cleanup_old_security_events: { Args: never; Returns: undefined }
      detect_suspicious_login_activity: {
        Args: { p_ip_address: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
