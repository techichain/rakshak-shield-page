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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          meta: Json
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          meta?: Json
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      hotspots: {
        Row: {
          city: Database["public"]["Enums"]["hotspot_city"]
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          sort_order: number
          sublabel: string | null
          updated_at: string
        }
        Insert: {
          city: Database["public"]["Enums"]["hotspot_city"]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          sort_order?: number
          sublabel?: string | null
          updated_at?: string
        }
        Update: {
          city?: Database["public"]["Enums"]["hotspot_city"]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          sort_order?: number
          sublabel?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      observation_photos: {
        Row: {
          file_name: string
          id: string
          mime_type: string
          observation_id: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          id?: string
          mime_type: string
          observation_id: string
          size_bytes?: number
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          id?: string
          mime_type?: string
          observation_id?: string
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "observation_photos_observation_id_fkey"
            columns: ["observation_id"]
            isOneToOne: false
            referencedRelation: "observations"
            referencedColumns: ["id"]
          },
        ]
      }
      observations: {
        Row: {
          additional_notes: string | null
          consent_interview:
            | Database["public"]["Enums"]["consent_answer"]
            | null
          consent_optional_items: string[]
          consent_screenshot:
            | Database["public"]["Enums"]["consent_answer"]
            | null
          created_at: string
          flag_reason: string | null
          flagged: boolean
          gig_worker_id: string | null
          gps_accuracy_meters: number | null
          gps_captured_at: string | null
          gps_lat: number | null
          gps_lng: number | null
          helmet_status: Database["public"]["Enums"]["helmet_status"] | null
          hotspot_id: string | null
          id: string
          observer_id: string
          platform_gear: string[]
          platform_gear_other: string | null
          rider_engagement:
            | Database["public"]["Enums"]["rider_engagement"]
            | null
          road_env_type: Database["public"]["Enums"]["road_env_type"] | null
          road_env_type_other: string | null
          road_hazards: string[]
          started_at: string
          status: Database["public"]["Enums"]["observation_status"]
          submitted_at: string | null
          surveyor_id: string | null
          surveyor_led: Database["public"]["Enums"]["led_answer"] | null
          surveyor_led_notes: string | null
          surveyor_rating: Database["public"]["Enums"]["surveyor_rating"] | null
          surveyor_rushed: Database["public"]["Enums"]["rushed_answer"] | null
          surveyor_rushed_notes: string | null
          updated_at: string
          vehicle_brand_model: string | null
          vehicle_observed: boolean
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Insert: {
          additional_notes?: string | null
          consent_interview?:
            | Database["public"]["Enums"]["consent_answer"]
            | null
          consent_optional_items?: string[]
          consent_screenshot?:
            | Database["public"]["Enums"]["consent_answer"]
            | null
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean
          gig_worker_id?: string | null
          gps_accuracy_meters?: number | null
          gps_captured_at?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          helmet_status?: Database["public"]["Enums"]["helmet_status"] | null
          hotspot_id?: string | null
          id?: string
          observer_id: string
          platform_gear?: string[]
          platform_gear_other?: string | null
          rider_engagement?:
            | Database["public"]["Enums"]["rider_engagement"]
            | null
          road_env_type?: Database["public"]["Enums"]["road_env_type"] | null
          road_env_type_other?: string | null
          road_hazards?: string[]
          started_at?: string
          status?: Database["public"]["Enums"]["observation_status"]
          submitted_at?: string | null
          surveyor_id?: string | null
          surveyor_led?: Database["public"]["Enums"]["led_answer"] | null
          surveyor_led_notes?: string | null
          surveyor_rating?:
            | Database["public"]["Enums"]["surveyor_rating"]
            | null
          surveyor_rushed?: Database["public"]["Enums"]["rushed_answer"] | null
          surveyor_rushed_notes?: string | null
          updated_at?: string
          vehicle_brand_model?: string | null
          vehicle_observed?: boolean
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Update: {
          additional_notes?: string | null
          consent_interview?:
            | Database["public"]["Enums"]["consent_answer"]
            | null
          consent_optional_items?: string[]
          consent_screenshot?:
            | Database["public"]["Enums"]["consent_answer"]
            | null
          created_at?: string
          flag_reason?: string | null
          flagged?: boolean
          gig_worker_id?: string | null
          gps_accuracy_meters?: number | null
          gps_captured_at?: string | null
          gps_lat?: number | null
          gps_lng?: number | null
          helmet_status?: Database["public"]["Enums"]["helmet_status"] | null
          hotspot_id?: string | null
          id?: string
          observer_id?: string
          platform_gear?: string[]
          platform_gear_other?: string | null
          rider_engagement?:
            | Database["public"]["Enums"]["rider_engagement"]
            | null
          road_env_type?: Database["public"]["Enums"]["road_env_type"] | null
          road_env_type_other?: string | null
          road_hazards?: string[]
          started_at?: string
          status?: Database["public"]["Enums"]["observation_status"]
          submitted_at?: string | null
          surveyor_id?: string | null
          surveyor_led?: Database["public"]["Enums"]["led_answer"] | null
          surveyor_led_notes?: string | null
          surveyor_rating?:
            | Database["public"]["Enums"]["surveyor_rating"]
            | null
          surveyor_rushed?: Database["public"]["Enums"]["rushed_answer"] | null
          surveyor_rushed_notes?: string | null
          updated_at?: string
          vehicle_brand_model?: string | null
          vehicle_observed?: boolean
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
        }
        Relationships: [
          {
            foreignKeyName: "observations_hotspot_id_fkey"
            columns: ["hotspot_id"]
            isOneToOne: false
            referencedRelation: "hotspots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_surveyor_id_fkey"
            columns: ["surveyor_id"]
            isOneToOne: false
            referencedRelation: "surveyors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          name?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      surveyors: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "observer" | "admin"
      consent_answer: "yes" | "no" | "unclear"
      helmet_status:
        | "wearing_full_face"
        | "wearing_half_open_face"
        | "wearing_no_visor"
        | "carrying"
        | "not_wearing_not_carrying"
        | "cannot_observe"
      hotspot_city: "Delhi" | "Gurgaon"
      led_answer: "yes" | "no" | "unsure"
      observation_status: "draft" | "submitted" | "flagged" | "reviewed"
      rider_engagement:
        | "actively_engaged"
        | "adequately_engaged"
        | "rushing_for_incentive"
        | "zoned_out_distracted"
        | "uncomfortable_resistant"
        | "going_through_motions"
      road_env_type:
        | "intersection_signal"
        | "mid_road_no_signal"
        | "commercial_market"
        | "residential_lane"
        | "highway_arterial"
        | "other"
      rushed_answer: "yes" | "no" | "somewhat"
      surveyor_rating: "satisfactory" | "needs_improvement" | "unacceptable"
      vehicle_type:
        | "petrol_ice"
        | "ev_low_speed"
        | "ev_high_speed_green_plate"
        | "cng"
        | "not_visible"
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
    Enums: {
      app_role: ["observer", "admin"],
      consent_answer: ["yes", "no", "unclear"],
      helmet_status: [
        "wearing_full_face",
        "wearing_half_open_face",
        "wearing_no_visor",
        "carrying",
        "not_wearing_not_carrying",
        "cannot_observe",
      ],
      hotspot_city: ["Delhi", "Gurgaon"],
      led_answer: ["yes", "no", "unsure"],
      observation_status: ["draft", "submitted", "flagged", "reviewed"],
      rider_engagement: [
        "actively_engaged",
        "adequately_engaged",
        "rushing_for_incentive",
        "zoned_out_distracted",
        "uncomfortable_resistant",
        "going_through_motions",
      ],
      road_env_type: [
        "intersection_signal",
        "mid_road_no_signal",
        "commercial_market",
        "residential_lane",
        "highway_arterial",
        "other",
      ],
      rushed_answer: ["yes", "no", "somewhat"],
      surveyor_rating: ["satisfactory", "needs_improvement", "unacceptable"],
      vehicle_type: [
        "petrol_ice",
        "ev_low_speed",
        "ev_high_speed_green_plate",
        "cng",
        "not_visible",
      ],
    },
  },
} as const
