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
      application_files: {
        Row: {
          application_id: string
          file_name: string
          id: string
          kind: Database["public"]["Enums"]["application_file_kind"]
          mime_type: string
          size_bytes: number
          storage_bucket: string
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          application_id: string
          file_name: string
          id?: string
          kind: Database["public"]["Enums"]["application_file_kind"]
          mime_type: string
          size_bytes?: number
          storage_bucket?: string
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          application_id?: string
          file_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["application_file_kind"]
          mime_type?: string
          size_bytes?: number
          storage_bucket?: string
          storage_path?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_files_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_reviews: {
        Row: {
          application_id: string
          created_at: string
          id: string
          notes: string | null
          recommendation: string | null
          reviewer_id: string
          score: number | null
          updated_at: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          notes?: string | null
          recommendation?: string | null
          reviewer_id: string
          score?: number | null
          updated_at?: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          recommendation?: string | null
          reviewer_id?: string
          score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_reviews_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_status_events: {
        Row: {
          application_id: string
          changed_by: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["application_status"] | null
          id: string
          note: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Insert: {
          application_id: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          note?: string | null
          to_status: Database["public"]["Enums"]["application_status"]
        }
        Update: {
          application_id?: string
          changed_by?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          note?: string | null
          to_status?: Database["public"]["Enums"]["application_status"]
        }
        Relationships: [
          {
            foreignKeyName: "application_status_events_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          assigned_reviewer_id: string | null
          city: string
          country: string
          created_at: string
          decision_notes: string | null
          designation: string | null
          email: string
          expertise_domain: string | null
          full_name: string
          id: string
          internal_score: number | null
          linkedin_url: string | null
          organisation: string | null
          phone: string
          state: string | null
          status: Database["public"]["Enums"]["application_status"]
          submitted_at: string
          track: Database["public"]["Enums"]["application_track"]
          track_data: Json
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          assigned_reviewer_id?: string | null
          city: string
          country?: string
          created_at?: string
          decision_notes?: string | null
          designation?: string | null
          email: string
          expertise_domain?: string | null
          full_name: string
          id?: string
          internal_score?: number | null
          linkedin_url?: string | null
          organisation?: string | null
          phone: string
          state?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          track: Database["public"]["Enums"]["application_track"]
          track_data?: Json
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          assigned_reviewer_id?: string | null
          city?: string
          country?: string
          created_at?: string
          decision_notes?: string | null
          designation?: string | null
          email?: string
          expertise_domain?: string | null
          full_name?: string
          id?: string
          internal_score?: number | null
          linkedin_url?: string | null
          organisation?: string | null
          phone?: string
          state?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          submitted_at?: string
          track?: Database["public"]["Enums"]["application_track"]
          track_data?: Json
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: []
      }
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
          photo_context: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
        }
        Insert: {
          file_name: string
          id?: string
          mime_type: string
          observation_id: string
          photo_context?: string
          size_bytes?: number
          storage_path: string
          uploaded_at?: string
        }
        Update: {
          file_name?: string
          id?: string
          mime_type?: string
          observation_id?: string
          photo_context?: string
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
          consent_interview_notes: string | null
          consent_optional_items: string[]
          consent_screenshot:
            | Database["public"]["Enums"]["consent_answer"]
            | null
          consent_screenshot_notes: string | null
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
          response_consistency: string | null
          response_consistency_notes: string | null
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
          consent_interview_notes?: string | null
          consent_optional_items?: string[]
          consent_screenshot?:
            | Database["public"]["Enums"]["consent_answer"]
            | null
          consent_screenshot_notes?: string | null
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
          response_consistency?: string | null
          response_consistency_notes?: string | null
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
          consent_interview_notes?: string | null
          consent_optional_items?: string[]
          consent_screenshot?:
            | Database["public"]["Enums"]["consent_answer"]
            | null
          consent_screenshot_notes?: string | null
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
          response_consistency?: string | null
          response_consistency_notes?: string | null
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
      page_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          path: string
          referrer: string | null
          session_id: string | null
          track: Database["public"]["Enums"]["application_track"] | null
          user_agent: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          path: string
          referrer?: string | null
          session_id?: string | null
          track?: Database["public"]["Enums"]["application_track"] | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          path?: string
          referrer?: string | null
          session_id?: string | null
          track?: Database["public"]["Enums"]["application_track"] | null
          user_agent?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: []
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
      rp_audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: []
      }
      rp_authority_reports: {
        Row: {
          attachment_url: string | null
          authority_category: string
          authority_name: string
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          message: string
          response_at: string | null
          response_attachment_url: string | null
          response_status: string | null
          response_text: string | null
          sent_at: string | null
          status: string
          subject: string
          team_id: string
          updated_at: string
        }
        Insert: {
          attachment_url?: string | null
          authority_category?: string
          authority_name: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          message?: string
          response_at?: string | null
          response_attachment_url?: string | null
          response_status?: string | null
          response_text?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          team_id: string
          updated_at?: string
        }
        Update: {
          attachment_url?: string | null
          authority_category?: string
          authority_name?: string
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          message?: string
          response_at?: string | null
          response_attachment_url?: string | null
          response_status?: string | null
          response_text?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_authority_reports_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "rp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_authority_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "rp_authority_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_certificates: {
        Row: {
          certificate_type: string
          created_at: string
          id: string
          is_revoked: boolean
          issued_at: string
          issued_by: string | null
          member_profile_id: string | null
          metadata: Json
          pdf_url: string | null
          phase_number: number | null
          public_slug: string
          recipient_name: string
          revoked_reason: string | null
          serial_no: string
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          certificate_type: string
          created_at?: string
          id?: string
          is_revoked?: boolean
          issued_at?: string
          issued_by?: string | null
          member_profile_id?: string | null
          metadata?: Json
          pdf_url?: string | null
          phase_number?: number | null
          public_slug: string
          recipient_name: string
          revoked_reason?: string | null
          serial_no: string
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          certificate_type?: string
          created_at?: string
          id?: string
          is_revoked?: boolean
          issued_at?: string
          issued_by?: string | null
          member_profile_id?: string | null
          metadata?: Json
          pdf_url?: string | null
          phase_number?: number | null
          public_slug?: string
          recipient_name?: string
          revoked_reason?: string | null
          serial_no?: string
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_certificates_member_profile_id_fkey"
            columns: ["member_profile_id"]
            isOneToOne: false
            referencedRelation: "rp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_certificates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "rp_certificates_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_cohorts: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          name: string
          participating_states: string[] | null
          region: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["rp_cohort_status"]
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          participating_states?: string[] | null
          region?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["rp_cohort_status"]
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          participating_states?: string[] | null
          region?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["rp_cohort_status"]
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      rp_evaluations: {
        Row: {
          comments: string | null
          created_at: string
          evaluator_id: string | null
          id: string
          phase_number: number
          rubric_scores: Json
          status: string
          submission_id: string
          submitted_at: string | null
          team_id: string
          total_score: number
          updated_at: string
          weighted_score: number
        }
        Insert: {
          comments?: string | null
          created_at?: string
          evaluator_id?: string | null
          id?: string
          phase_number: number
          rubric_scores?: Json
          status?: string
          submission_id: string
          submitted_at?: string | null
          team_id: string
          total_score?: number
          updated_at?: string
          weighted_score?: number
        }
        Update: {
          comments?: string | null
          created_at?: string
          evaluator_id?: string | null
          id?: string
          phase_number?: number
          rubric_scores?: Json
          status?: string
          submission_id?: string
          submitted_at?: string | null
          team_id?: string
          total_score?: number
          updated_at?: string
          weighted_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "rp_evaluations_evaluator_id_fkey"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "rp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_evaluations_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "rp_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_evaluations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "rp_evaluations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_feedback: {
        Row: {
          created_at: string
          feedback_text: string
          id: string
          phase_number: number
          reviewer_id: string | null
          reviewer_role: string
          rubric_scores: Json | null
          score: number | null
          status: string
          submission_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          feedback_text: string
          id?: string
          phase_number: number
          reviewer_id?: string | null
          reviewer_role: string
          rubric_scores?: Json | null
          score?: number | null
          status?: string
          submission_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string
          id?: string
          phase_number?: number
          reviewer_id?: string | null
          reviewer_role?: string
          rubric_scores?: Json | null
          score?: number | null
          status?: string
          submission_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_feedback_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "rp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_feedback_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "rp_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_feedback_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "rp_feedback_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_finance_entries: {
        Row: {
          amount_inr: number
          category: string
          cohort_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string
          entry_type: string
          id: string
          metadata: Json
          occurred_on: string
          receipt_url: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          amount_inr: number
          category: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          entry_type: string
          id?: string
          metadata?: Json
          occurred_on?: string
          receipt_url?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_inr?: number
          category?: string
          cohort_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string
          entry_type?: string
          id?: string
          metadata?: Json
          occurred_on?: string
          receipt_url?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_finance_entries_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "rp_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_finance_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "rp_finance_entries_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_knowledge_articles: {
        Row: {
          author_id: string | null
          body_md: string
          category: string
          created_at: string
          excerpt: string | null
          hero_image_url: string | null
          id: string
          is_published: boolean
          published_at: string | null
          slug: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body_md?: string
          category?: string
          created_at?: string
          excerpt?: string | null
          hero_image_url?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body_md?: string
          category?: string
          created_at?: string
          excerpt?: string | null
          hero_image_url?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      rp_location_photos: {
        Row: {
          caption: string | null
          created_at: string
          file_name: string
          file_size: number | null
          id: string
          latitude: number | null
          location_id: string
          longitude: number | null
          mime_type: string | null
          storage_path: string
          taken_at: string | null
          team_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_name: string
          file_size?: number | null
          id?: string
          latitude?: number | null
          location_id: string
          longitude?: number | null
          mime_type?: string | null
          storage_path: string
          taken_at?: string | null
          team_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          id?: string
          latitude?: number | null
          location_id?: string
          longitude?: number | null
          mime_type?: string | null
          storage_path?: string
          taken_at?: string | null
          team_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rp_location_photos_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "rp_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_location_photos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "rp_location_photos_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_locations: {
        Row: {
          address: string | null
          authority_jurisdiction: string | null
          authority_response: string | null
          city: string | null
          created_at: string
          description: string | null
          id: string
          is_final_selected: boolean
          issue_type: string | null
          latitude: number | null
          location_name: string
          longitude: number | null
          phase_number: number
          priority_rank: number | null
          severity: Database["public"]["Enums"]["rp_severity"] | null
          state: string | null
          submitted_to_authority_at: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          authority_jurisdiction?: string | null
          authority_response?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_final_selected?: boolean
          issue_type?: string | null
          latitude?: number | null
          location_name: string
          longitude?: number | null
          phase_number?: number
          priority_rank?: number | null
          severity?: Database["public"]["Enums"]["rp_severity"] | null
          state?: string | null
          submitted_to_authority_at?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          authority_jurisdiction?: string | null
          authority_response?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_final_selected?: boolean
          issue_type?: string | null
          latitude?: number | null
          location_name?: string
          longitude?: number | null
          phase_number?: number
          priority_rank?: number | null
          severity?: Database["public"]["Enums"]["rp_severity"] | null
          state?: string | null
          submitted_to_authority_at?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_locations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "rp_locations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_meeting_attendees: {
        Row: {
          created_at: string
          id: string
          meeting_id: string
          profile_id: string
          responded_at: string | null
          rsvp: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          meeting_id: string
          profile_id: string
          responded_at?: string | null
          rsvp?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          meeting_id?: string
          profile_id?: string
          responded_at?: string | null
          rsvp?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_meeting_attendees_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "rp_meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_meeting_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "rp_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_meetings: {
        Row: {
          agenda: string
          created_at: string
          created_by: string
          id: string
          location: string | null
          meeting_link: string | null
          meeting_type: string
          mentor_id: string | null
          notes: string | null
          reminder_1h_sent_at: string | null
          reminder_24h_sent_at: string | null
          reminder_30m_sent_at: string | null
          scheduled_end: string
          scheduled_start: string
          status: string
          team_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: string
          created_at?: string
          created_by: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          meeting_type?: string
          mentor_id?: string | null
          notes?: string | null
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          reminder_30m_sent_at?: string | null
          scheduled_end: string
          scheduled_start: string
          status?: string
          team_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agenda?: string
          created_at?: string
          created_by?: string
          id?: string
          location?: string | null
          meeting_link?: string | null
          meeting_type?: string
          mentor_id?: string | null
          notes?: string | null
          reminder_1h_sent_at?: string | null
          reminder_24h_sent_at?: string | null
          reminder_30m_sent_at?: string | null
          scheduled_end?: string
          scheduled_start?: string
          status?: string
          team_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_meetings_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "rp_mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_meetings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "rp_meetings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_mentor_applications: {
        Row: {
          city: string | null
          created_at: string
          created_mentor_id: string | null
          designation: string | null
          email: string
          expertise: string | null
          full_name: string
          id: string
          linkedin_url: string | null
          motivation: string | null
          organization: string | null
          phone: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          state: string | null
          status: string
          updated_at: string
          years_experience: number | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          created_mentor_id?: string | null
          designation?: string | null
          email: string
          expertise?: string | null
          full_name: string
          id?: string
          linkedin_url?: string | null
          motivation?: string | null
          organization?: string | null
          phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          years_experience?: number | null
        }
        Update: {
          city?: string | null
          created_at?: string
          created_mentor_id?: string | null
          designation?: string | null
          email?: string
          expertise?: string | null
          full_name?: string
          id?: string
          linkedin_url?: string | null
          motivation?: string | null
          organization?: string | null
          phone?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          state?: string | null
          status?: string
          updated_at?: string
          years_experience?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rp_mentor_applications_created_mentor_id_fkey"
            columns: ["created_mentor_id"]
            isOneToOne: false
            referencedRelation: "rp_mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_mentor_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "rp_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_mentors: {
        Row: {
          avg_response_time_hours: number | null
          created_at: string
          current_team_count: number
          expertise: string | null
          id: string
          max_teams: number
          organization: string | null
          profile_id: string
          rating: number | null
          status: string
          updated_at: string
        }
        Insert: {
          avg_response_time_hours?: number | null
          created_at?: string
          current_team_count?: number
          expertise?: string | null
          id?: string
          max_teams?: number
          organization?: string | null
          profile_id: string
          rating?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          avg_response_time_hours?: number | null
          created_at?: string
          current_team_count?: number
          expertise?: string | null
          id?: string
          max_teams?: number
          organization?: string | null
          profile_id?: string
          rating?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_mentors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "rp_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_notifications: {
        Row: {
          action_link: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          recipient_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
          type: string
        }
        Insert: {
          action_link?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
          type: string
        }
        Update: {
          action_link?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          recipient_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
          type?: string
        }
        Relationships: []
      }
      rp_phase_templates: {
        Row: {
          checklist: Json
          created_at: string
          default_duration_days: number
          description: string
          id: string
          phase_number: number
          required_deliverables: Json
          title: string
        }
        Insert: {
          checklist?: Json
          created_at?: string
          default_duration_days?: number
          description: string
          id?: string
          phase_number: number
          required_deliverables?: Json
          title: string
        }
        Update: {
          checklist?: Json
          created_at?: string
          default_duration_days?: number
          description?: string
          id?: string
          phase_number?: number
          required_deliverables?: Json
          title?: string
        }
        Relationships: []
      }
      rp_profiles: {
        Row: {
          avatar_url: string | null
          city: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          organization: string | null
          phone: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          organization?: string | null
          phone?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          city?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          organization?: string | null
          phone?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      rp_rubrics: {
        Row: {
          created_at: string
          criteria: Json
          description: string | null
          id: string
          max_total_score: number
          phase_number: number
          phase_weight: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criteria: Json
          description?: string | null
          id?: string
          max_total_score?: number
          phase_number: number
          phase_weight?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          description?: string | null
          id?: string
          max_total_score?: number
          phase_number?: number
          phase_weight?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      rp_sponsorships: {
        Row: {
          amount_inr: number
          created_at: string
          currency: string
          id: string
          is_public: boolean
          message: string | null
          paid_at: string | null
          payment_provider: string | null
          provider_reference: string | null
          sponsor_email: string | null
          sponsor_logo_url: string | null
          sponsor_name: string
          sponsor_org: string | null
          status: string
          tier: string
          updated_at: string
        }
        Insert: {
          amount_inr: number
          created_at?: string
          currency?: string
          id?: string
          is_public?: boolean
          message?: string | null
          paid_at?: string | null
          payment_provider?: string | null
          provider_reference?: string | null
          sponsor_email?: string | null
          sponsor_logo_url?: string | null
          sponsor_name: string
          sponsor_org?: string | null
          status?: string
          tier: string
          updated_at?: string
        }
        Update: {
          amount_inr?: number
          created_at?: string
          currency?: string
          id?: string
          is_public?: boolean
          message?: string | null
          paid_at?: string | null
          payment_provider?: string | null
          provider_reference?: string | null
          sponsor_email?: string | null
          sponsor_logo_url?: string | null
          sponsor_name?: string
          sponsor_org?: string | null
          status?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      rp_submission_files: {
        Row: {
          caption: string | null
          created_at: string
          evidence_type: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          latitude: number | null
          longitude: number | null
          storage_path: string | null
          submission_id: string
          team_id: string
          uploaded_by: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          evidence_type?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          storage_path?: string | null
          submission_id: string
          team_id: string
          uploaded_by?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          evidence_type?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          storage_path?: string | null
          submission_id?: string
          team_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rp_submission_files_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "rp_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_submission_files_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "rp_submission_files_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_submission_files_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "rp_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_submissions: {
        Row: {
          admin_review_status: string | null
          created_at: string
          evaluator_score: number | null
          id: string
          mentor_review_status: string | null
          phase_number: number
          revision_number: number
          status: Database["public"]["Enums"]["rp_phase_status"]
          submitted_at: string | null
          submitted_by: string | null
          summary: string | null
          team_id: string
          title: string
          updated_at: string
        }
        Insert: {
          admin_review_status?: string | null
          created_at?: string
          evaluator_score?: number | null
          id?: string
          mentor_review_status?: string | null
          phase_number: number
          revision_number?: number
          status?: Database["public"]["Enums"]["rp_phase_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          summary?: string | null
          team_id: string
          title: string
          updated_at?: string
        }
        Update: {
          admin_review_status?: string | null
          created_at?: string
          evaluator_score?: number | null
          id?: string
          mentor_review_status?: string | null
          phase_number?: number
          revision_number?: number
          status?: Database["public"]["Enums"]["rp_phase_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          summary?: string | null
          team_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "rp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "rp_submissions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_team_members: {
        Row: {
          college: string | null
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          id: string
          phone: string | null
          profile_id: string | null
          role_in_team: string
          team_id: string
          year: string | null
        }
        Insert: {
          college?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          profile_id?: string | null
          role_in_team?: string
          team_id: string
          year?: string | null
        }
        Update: {
          college?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          profile_id?: string | null
          role_in_team?: string
          team_id?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rp_team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "rp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "rp_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_team_phase_progress: {
        Row: {
          admin_reviewed_at: string | null
          admin_status: string | null
          at_risk_reason: string | null
          completed_at: string | null
          completion_percentage: number
          created_at: string
          deadline: string | null
          id: string
          is_at_risk: boolean
          last_activity_at: string
          mentor_reviewed_at: string | null
          mentor_status: string | null
          phase_number: number
          revision_count: number
          started_at: string | null
          status: Database["public"]["Enums"]["rp_phase_status"]
          submitted_at: string | null
          team_id: string
          updated_at: string
        }
        Insert: {
          admin_reviewed_at?: string | null
          admin_status?: string | null
          at_risk_reason?: string | null
          completed_at?: string | null
          completion_percentage?: number
          created_at?: string
          deadline?: string | null
          id?: string
          is_at_risk?: boolean
          last_activity_at?: string
          mentor_reviewed_at?: string | null
          mentor_status?: string | null
          phase_number: number
          revision_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["rp_phase_status"]
          submitted_at?: string | null
          team_id: string
          updated_at?: string
        }
        Update: {
          admin_reviewed_at?: string | null
          admin_status?: string | null
          at_risk_reason?: string | null
          completed_at?: string | null
          completion_percentage?: number
          created_at?: string
          deadline?: string | null
          id?: string
          is_at_risk?: boolean
          last_activity_at?: string
          mentor_reviewed_at?: string | null
          mentor_status?: string | null
          phase_number?: number
          revision_count?: number
          started_at?: string | null
          status?: Database["public"]["Enums"]["rp_phase_status"]
          submitted_at?: string | null
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_team_phase_progress_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_leaderboard_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "rp_team_phase_progress_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "rp_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_teams: {
        Row: {
          assigned_evaluator_id: string | null
          assigned_mentor_id: string | null
          city: string | null
          cohort_id: string
          college: string | null
          completion_percentage: number
          created_at: string
          current_phase: number
          evaluated_phases: number
          final_score: number
          health_score: number
          id: string
          last_activity_at: string
          risk_reason: string | null
          risk_status: Database["public"]["Enums"]["rp_risk_status"]
          state: string | null
          status: Database["public"]["Enums"]["rp_team_status"]
          team_leader_id: string | null
          team_name: string
          updated_at: string
        }
        Insert: {
          assigned_evaluator_id?: string | null
          assigned_mentor_id?: string | null
          city?: string | null
          cohort_id: string
          college?: string | null
          completion_percentage?: number
          created_at?: string
          current_phase?: number
          evaluated_phases?: number
          final_score?: number
          health_score?: number
          id?: string
          last_activity_at?: string
          risk_reason?: string | null
          risk_status?: Database["public"]["Enums"]["rp_risk_status"]
          state?: string | null
          status?: Database["public"]["Enums"]["rp_team_status"]
          team_leader_id?: string | null
          team_name: string
          updated_at?: string
        }
        Update: {
          assigned_evaluator_id?: string | null
          assigned_mentor_id?: string | null
          city?: string | null
          cohort_id?: string
          college?: string | null
          completion_percentage?: number
          created_at?: string
          current_phase?: number
          evaluated_phases?: number
          final_score?: number
          health_score?: number
          id?: string
          last_activity_at?: string
          risk_reason?: string | null
          risk_status?: Database["public"]["Enums"]["rp_risk_status"]
          state?: string | null
          status?: Database["public"]["Enums"]["rp_team_status"]
          team_leader_id?: string | null
          team_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rp_teams_assigned_evaluator_id_fkey"
            columns: ["assigned_evaluator_id"]
            isOneToOne: false
            referencedRelation: "rp_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_teams_assigned_mentor_id_fkey"
            columns: ["assigned_mentor_id"]
            isOneToOne: false
            referencedRelation: "rp_mentors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_teams_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "rp_cohorts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rp_teams_team_leader_id_fkey"
            columns: ["team_leader_id"]
            isOneToOne: false
            referencedRelation: "rp_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rp_user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["rp_app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["rp_app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["rp_app_role"]
          user_id?: string
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
      rp_leaderboard_view: {
        Row: {
          city: string | null
          cohort_id: string | null
          cohort_name: string | null
          cohort_rank: number | null
          college: string | null
          current_phase: number | null
          evaluated_phases: number | null
          final_score: number | null
          overall_rank: number | null
          state: string | null
          team_id: string | null
          team_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rp_teams_cohort_id_fkey"
            columns: ["cohort_id"]
            isOneToOne: false
            referencedRelation: "rp_cohorts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      rp_has_role: {
        Args: {
          _role: Database["public"]["Enums"]["rp_app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      rp_is_admin: { Args: { _user_id: string }; Returns: boolean }
      rp_is_team_member: {
        Args: { _team: string; _user: string }
        Returns: boolean
      }
      rp_is_team_mentor: {
        Args: { _team: string; _user: string }
        Returns: boolean
      }
      rp_recompute_team_score: {
        Args: { _team_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "observer" | "admin"
      application_file_kind: "assignment" | "cv" | "other"
      application_status:
        | "submitted"
        | "under_review"
        | "shortlisted"
        | "interview"
        | "selected"
        | "rejected"
        | "withdrawn"
      application_track: "mentor" | "auditor" | "ngo_partner" | "student_team"
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
        | "genuinely_engaged"
        | "cooperative"
        | "passive"
        | "visibly_rushed"
        | "uncomfortable_guarded"
        | "resistant"
      road_env_type:
        | "intersection_signal"
        | "mid_road_no_signal"
        | "commercial_market"
        | "residential_lane"
        | "highway_arterial"
        | "other"
        | "restaurant_food_outlet"
        | "dark_store"
        | "mall_entrance"
        | "informal_rest_spot"
        | "petrol_pump"
        | "residential_society"
        | "highway_service_lane"
      rp_app_role:
        | "super_admin"
        | "cfi_admin"
        | "team_leader"
        | "team_member"
        | "mentor"
        | "evaluator"
        | "authority"
        | "finance"
        | "leadership_viewer"
      rp_cohort_status: "draft" | "active" | "completed" | "archived"
      rp_phase_status:
        | "not_started"
        | "draft"
        | "submitted"
        | "under_mentor_review"
        | "changes_requested"
        | "resubmitted"
        | "mentor_approved"
        | "under_admin_review"
        | "admin_approved"
        | "rejected"
        | "completed"
      rp_risk_status: "on_track" | "attention" | "at_risk"
      rp_severity: "low" | "medium" | "high" | "critical"
      rp_team_status:
        | "pending_approval"
        | "approved"
        | "active"
        | "delayed"
        | "at_risk"
        | "completed"
        | "dropped"
        | "disqualified"
        | "archived"
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
      application_file_kind: ["assignment", "cv", "other"],
      application_status: [
        "submitted",
        "under_review",
        "shortlisted",
        "interview",
        "selected",
        "rejected",
        "withdrawn",
      ],
      application_track: ["mentor", "auditor", "ngo_partner", "student_team"],
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
        "genuinely_engaged",
        "cooperative",
        "passive",
        "visibly_rushed",
        "uncomfortable_guarded",
        "resistant",
      ],
      road_env_type: [
        "intersection_signal",
        "mid_road_no_signal",
        "commercial_market",
        "residential_lane",
        "highway_arterial",
        "other",
        "restaurant_food_outlet",
        "dark_store",
        "mall_entrance",
        "informal_rest_spot",
        "petrol_pump",
        "residential_society",
        "highway_service_lane",
      ],
      rp_app_role: [
        "super_admin",
        "cfi_admin",
        "team_leader",
        "team_member",
        "mentor",
        "evaluator",
        "authority",
        "finance",
        "leadership_viewer",
      ],
      rp_cohort_status: ["draft", "active", "completed", "archived"],
      rp_phase_status: [
        "not_started",
        "draft",
        "submitted",
        "under_mentor_review",
        "changes_requested",
        "resubmitted",
        "mentor_approved",
        "under_admin_review",
        "admin_approved",
        "rejected",
        "completed",
      ],
      rp_risk_status: ["on_track", "attention", "at_risk"],
      rp_severity: ["low", "medium", "high", "critical"],
      rp_team_status: [
        "pending_approval",
        "approved",
        "active",
        "delayed",
        "at_risk",
        "completed",
        "dropped",
        "disqualified",
        "archived",
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
