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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target?: string | null
        }
        Relationships: []
      }
      consents: {
        Row: {
          accepted_at: string
          consent_type: string
          consent_version: string
          event_id: string
          id: string
          participant_id: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          consent_version: string
          event_id: string
          id?: string
          participant_id: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          consent_version?: string
          event_id?: string
          id?: string
          participant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consents_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_partners: {
        Row: {
          event_id: string
          partner_id: string
        }
        Insert: {
          event_id: string
          partner_id: string
        }
        Update: {
          event_id?: string
          partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_partners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_partners_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          activities: Json
          confirmation_message: string | null
          consent_text: string | null
          consent_version: string
          cover_image_url: string | null
          created_at: string
          date: string | null
          description: string | null
          end_time: string | null
          faq: Json
          food_rule_text: string | null
          how_to_participate: string | null
          id: string
          location: string | null
          logo_url: string | null
          name: string
          registration_limit: number | null
          registration_open: boolean
          rules: Json
          slogan: string | null
          slug: string
          start_time: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activities?: Json
          confirmation_message?: string | null
          consent_text?: string | null
          consent_version?: string
          cover_image_url?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          end_time?: string | null
          faq?: Json
          food_rule_text?: string | null
          how_to_participate?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name: string
          registration_limit?: number | null
          registration_open?: boolean
          rules?: Json
          slogan?: string | null
          slug: string
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activities?: Json
          confirmation_message?: string | null
          consent_text?: string | null
          consent_version?: string
          cover_image_url?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          end_time?: string | null
          faq?: Json
          food_rule_text?: string | null
          how_to_participate?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name?: string
          registration_limit?: number | null
          registration_open?: boolean
          rules?: Json
          slogan?: string | null
          slug?: string
          start_time?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      participants: {
        Row: {
          birth_date: string
          cpf: string
          created_at: string
          first_name: string
          id: string
          last_name: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          birth_date: string
          cpf: string
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          birth_date?: string
          cpf?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      partners: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          website: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          website?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          website?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          id: string
          name: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          id: string
          name?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          hits: number
          key: string
          window_start: string
        }
        Insert: {
          hits?: number
          key: string
          window_start: string
        }
        Update: {
          hits?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      registrations: {
        Row: {
          checked_in_at: string | null
          checked_in_by: string | null
          event_id: string
          food_item: string | null
          id: string
          participant_id: string
          registered_at: string
          registration_code: string
          registration_status: Database["public"]["Enums"]["registration_status"]
        }
        Insert: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          event_id: string
          food_item?: string | null
          id?: string
          participant_id: string
          registered_at?: string
          registration_code: string
          registration_status?: Database["public"]["Enums"]["registration_status"]
        }
        Update: {
          checked_in_at?: string | null
          checked_in_by?: string | null
          event_id?: string
          food_item?: string | null
          id?: string
          participant_id?: string
          registered_at?: string
          registration_code?: string
          registration_status?: Database["public"]["Enums"]["registration_status"]
        }
        Relationships: [
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          name: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          send_count: number
          status: string
          token_hash: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string
          name?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["app_role"]
          send_count?: number
          status?: string
          token_hash?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          name?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          send_count?: number
          status?: string
          token_hash?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_checkin: { Args: { _registration_id: string }; Returns: string }
      get_registration_confirmation: {
        Args: { _code: string }
        Returns: {
          event_slug: string
          first_name: string
          food_item: string
          last_name: string
          registration_code: string
          registration_status: Database["public"]["Enums"]["registration_status"]
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hit_rate_limit: {
        Args: { _max: number; _scope: string; _window_seconds: number }
        Returns: undefined
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
      is_team: { Args: { _user_id: string }; Returns: boolean }
      is_valid_cpf: { Args: { _cpf: string }; Returns: boolean }
      log_export: { Args: { _kind: string; _rows: number }; Returns: undefined }
      register_for_event: {
        Args: {
          _birth_date: string
          _consent: boolean
          _cpf: string
          _event_id: string
          _first_name: string
          _food_item: string
          _last_name: string
          _whatsapp: string
        }
        Returns: string
      }
      write_audit: {
        Args: { _action: string; _details: Json; _target: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "checkin"
      registration_status: "inscrito" | "cancelado" | "checkin" | "ausente"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff", "checkin"],
      registration_status: ["inscrito", "cancelado", "checkin", "ausente"],
    },
  },
} as const
