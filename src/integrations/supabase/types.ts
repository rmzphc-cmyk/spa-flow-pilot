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
      checkins: {
        Row: {
          created_at: string
          focus_level: number
          id: string
          key_context: string | null
          mood_score: number
          report_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          focus_level: number
          id?: string
          key_context?: string | null
          mood_score: number
          report_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          focus_level?: number
          id?: string
          key_context?: string | null
          mood_score?: number
          report_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      context_memories: {
        Row: {
          content: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          memory_type: Database["public"]["Enums"]["memory_type"]
          relevance_score: number | null
          source_report_id: string | null
          spa_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          memory_type: Database["public"]["Enums"]["memory_type"]
          relevance_score?: number | null
          source_report_id?: string | null
          spa_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          memory_type?: Database["public"]["Enums"]["memory_type"]
          relevance_score?: number | null
          source_report_id?: string | null
          spa_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "context_memories_source_report_id_fkey"
            columns: ["source_report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "context_memories_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
        ]
      }
      destinations: {
        Row: {
          country: string | null
          created_at: string
          id: string
          name: string
          organization_id: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          id?: string
          name: string
          organization_id: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "destinations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      direction_spa_access: {
        Row: {
          granted_at: string
          granted_by: string
          id: string
          spa_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by: string
          id?: string
          spa_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string
          id?: string
          spa_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direction_spa_access_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direction_spa_access_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direction_spa_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ids_items: {
        Row: {
          capture_text: string
          captured_at: string
          converted_to_objective_id: string | null
          converted_to_todo_id: string | null
          created_at: string
          created_by: string
          cycle_type: Database["public"]["Enums"]["ids_cycle_type"]
          display_order: number
          id: string
          problem_statement: string | null
          proposed_solution: string | null
          report_id: string
          requires_solution: boolean
          resolution_notes: string | null
          resolution_type:
            | Database["public"]["Enums"]["ids_resolution_type"]
            | null
          root_cause: string | null
          spa_id: string
          status: Database["public"]["Enums"]["ids_status"]
          updated_at: string
        }
        Insert: {
          capture_text: string
          captured_at?: string
          converted_to_objective_id?: string | null
          converted_to_todo_id?: string | null
          created_at?: string
          created_by: string
          cycle_type: Database["public"]["Enums"]["ids_cycle_type"]
          display_order?: number
          id?: string
          problem_statement?: string | null
          proposed_solution?: string | null
          report_id: string
          requires_solution?: boolean
          resolution_notes?: string | null
          resolution_type?:
            | Database["public"]["Enums"]["ids_resolution_type"]
            | null
          root_cause?: string | null
          spa_id: string
          status?: Database["public"]["Enums"]["ids_status"]
          updated_at?: string
        }
        Update: {
          capture_text?: string
          captured_at?: string
          converted_to_objective_id?: string | null
          converted_to_todo_id?: string | null
          created_at?: string
          created_by?: string
          cycle_type?: Database["public"]["Enums"]["ids_cycle_type"]
          display_order?: number
          id?: string
          problem_statement?: string | null
          proposed_solution?: string | null
          report_id?: string
          requires_solution?: boolean
          resolution_notes?: string | null
          resolution_type?:
            | Database["public"]["Enums"]["ids_resolution_type"]
            | null
          root_cause?: string | null
          spa_id?: string
          status?: Database["public"]["Enums"]["ids_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ids_items_converted_to_objective_id_fkey"
            columns: ["converted_to_objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ids_items_converted_to_todo_id_fkey"
            columns: ["converted_to_todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ids_items_converted_to_todo_id_fkey"
            columns: ["converted_to_todo_id"]
            isOneToOne: false
            referencedRelation: "todos_overdue"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ids_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ids_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ids_items_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_definitions: {
        Row: {
          category: Database["public"]["Enums"]["kpi_category"]
          comment_guidance_en: string | null
          comment_guidance_es: string | null
          comment_guidance_fr: string | null
          comparison_direction: Database["public"]["Enums"]["comparison_direction"]
          created_at: string
          created_by: string
          display_order: number
          id: string
          is_active: boolean
          kpi_group: string
          name: string
          name_en: string | null
          name_es: string | null
          spa_id: string
          threshold_amber: number | null
          threshold_excellent: number | null
          threshold_red: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["kpi_category"]
          comment_guidance_en?: string | null
          comment_guidance_es?: string | null
          comment_guidance_fr?: string | null
          comparison_direction?: Database["public"]["Enums"]["comparison_direction"]
          created_at?: string
          created_by: string
          display_order?: number
          id?: string
          is_active?: boolean
          kpi_group?: string
          name: string
          name_en?: string | null
          name_es?: string | null
          spa_id: string
          threshold_amber?: number | null
          threshold_excellent?: number | null
          threshold_red?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["kpi_category"]
          comment_guidance_en?: string | null
          comment_guidance_es?: string | null
          comment_guidance_fr?: string | null
          comparison_direction?: Database["public"]["Enums"]["comparison_direction"]
          created_at?: string
          created_by?: string
          display_order?: number
          id?: string
          is_active?: boolean
          kpi_group?: string
          name?: string
          name_en?: string | null
          name_es?: string | null
          spa_id?: string
          threshold_amber?: number | null
          threshold_excellent?: number | null
          threshold_red?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_definitions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_definitions_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_entries: {
        Row: {
          comment: string | null
          comment_is_validated: boolean
          created_at: string
          id: string
          kpi_definition_id: string
          report_id: string
          status: Database["public"]["Enums"]["kpi_status"]
          target_value: number | null
          updated_at: string
          value_current: number | null
          value_n1: number | null
        }
        Insert: {
          comment?: string | null
          comment_is_validated?: boolean
          created_at?: string
          id?: string
          kpi_definition_id: string
          report_id: string
          status?: Database["public"]["Enums"]["kpi_status"]
          target_value?: number | null
          updated_at?: string
          value_current?: number | null
          value_n1?: number | null
        }
        Update: {
          comment?: string | null
          comment_is_validated?: boolean
          created_at?: string
          id?: string
          kpi_definition_id?: string
          report_id?: string
          status?: Database["public"]["Enums"]["kpi_status"]
          target_value?: number | null
          updated_at?: string
          value_current?: number | null
          value_n1?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_entries_kpi_definition_id_fkey"
            columns: ["kpi_definition_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_entries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_monthly_targets: {
        Row: {
          actual_monthly_value: number | null
          created_at: string
          id: string
          kpi_definition_id: string
          monthly_value: number | null
          spa_id: string
          updated_at: string
          weekly_mode: string
          weekly_override: number | null
          year_month: string
        }
        Insert: {
          actual_monthly_value?: number | null
          created_at?: string
          id?: string
          kpi_definition_id: string
          monthly_value?: number | null
          spa_id: string
          updated_at?: string
          weekly_mode?: string
          weekly_override?: number | null
          year_month: string
        }
        Update: {
          actual_monthly_value?: number | null
          created_at?: string
          id?: string
          kpi_definition_id?: string
          monthly_value?: number | null
          spa_id?: string
          updated_at?: string
          weekly_mode?: string
          weekly_override?: number | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_monthly_targets_kpi_definition_id_fkey"
            columns: ["kpi_definition_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_monthly_targets_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_summaries: {
        Row: {
          created_at: string
          edit_history: Json | null
          executive_summary: string | null
          generated_at: string
          generated_by_agent: string
          id: string
          ids_synthesis: string | null
          is_validated: boolean
          key_actions: string | null
          kpi_synthesis: string | null
          language: Database["public"]["Enums"]["language_code"]
          management_synthesis: string | null
          manager_note: string | null
          model_used: string
          objectives_synthesis: string | null
          report_id: string
          tokens_used: number | null
          transcript_generated_at: string | null
          transcript_status: string | null
          transcript_text: string | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          created_at?: string
          edit_history?: Json | null
          executive_summary?: string | null
          generated_at?: string
          generated_by_agent: string
          id?: string
          ids_synthesis?: string | null
          is_validated?: boolean
          key_actions?: string | null
          kpi_synthesis?: string | null
          language?: Database["public"]["Enums"]["language_code"]
          management_synthesis?: string | null
          manager_note?: string | null
          model_used?: string
          objectives_synthesis?: string | null
          report_id: string
          tokens_used?: number | null
          transcript_generated_at?: string | null
          transcript_status?: string | null
          transcript_text?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          created_at?: string
          edit_history?: Json | null
          executive_summary?: string | null
          generated_at?: string
          generated_by_agent?: string
          id?: string
          ids_synthesis?: string | null
          is_validated?: boolean
          key_actions?: string | null
          kpi_synthesis?: string | null
          language?: Database["public"]["Enums"]["language_code"]
          management_synthesis?: string | null
          manager_note?: string | null
          model_used?: string
          objectives_synthesis?: string | null
          report_id?: string
          tokens_used?: number | null
          transcript_generated_at?: string | null
          transcript_status?: string | null
          transcript_text?: string | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meeting_summaries_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: true
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_summaries_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          language: Database["public"]["Enums"]["language_code"]
          read_at: string | null
          report_id: string | null
          sent_at: string | null
          spa_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          language?: Database["public"]["Enums"]["language_code"]
          read_at?: string | null
          report_id?: string | null
          sent_at?: string | null
          spa_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          language?: Database["public"]["Enums"]["language_code"]
          read_at?: string | null
          report_id?: string | null
          sent_at?: string | null
          spa_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          achieved_at: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          ids_item_id: string | null
          progress_note: string | null
          progress_updated_in_report: string | null
          report_id_created: string
          source: Database["public"]["Enums"]["objective_source"]
          spa_id: string
          status: Database["public"]["Enums"]["objective_status"]
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          achieved_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          ids_item_id?: string | null
          progress_note?: string | null
          progress_updated_in_report?: string | null
          report_id_created: string
          source?: Database["public"]["Enums"]["objective_source"]
          spa_id: string
          status?: Database["public"]["Enums"]["objective_status"]
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          achieved_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          ids_item_id?: string | null
          progress_note?: string | null
          progress_updated_in_report?: string | null
          report_id_created?: string
          source?: Database["public"]["Enums"]["objective_source"]
          spa_id?: string
          status?: Database["public"]["Enums"]["objective_status"]
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_ids_item_id_fkey"
            columns: ["ids_item_id"]
            isOneToOne: false
            referencedRelation: "ids_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_progress_updated_in_report_fkey"
            columns: ["progress_updated_in_report"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_report_id_created_fkey"
            columns: ["report_id_created"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          ai_synthesis_generated_at: string | null
          ai_synthesis_scheduled_at: string | null
          audio_duration_s: number | null
          audio_mime_type: string | null
          audio_storage_path: string | null
          created_at: string
          cycle_label: string
          cycle_type: Database["public"]["Enums"]["ids_cycle_type"]
          id: string
          is_locked: boolean
          manager_id: string
          meeting_closed_at: string | null
          meeting_started_at: string | null
          period_end: string
          period_start: string
          spa_id: string
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          ai_synthesis_generated_at?: string | null
          ai_synthesis_scheduled_at?: string | null
          audio_duration_s?: number | null
          audio_mime_type?: string | null
          audio_storage_path?: string | null
          created_at?: string
          cycle_label: string
          cycle_type: Database["public"]["Enums"]["ids_cycle_type"]
          id?: string
          is_locked?: boolean
          manager_id: string
          meeting_closed_at?: string | null
          meeting_started_at?: string | null
          period_end: string
          period_start: string
          spa_id: string
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          ai_synthesis_generated_at?: string | null
          ai_synthesis_scheduled_at?: string | null
          audio_duration_s?: number | null
          audio_mime_type?: string | null
          audio_storage_path?: string | null
          created_at?: string
          cycle_label?: string
          cycle_type?: Database["public"]["Enums"]["ids_cycle_type"]
          id?: string
          is_locked?: boolean
          manager_id?: string
          meeting_closed_at?: string | null
          meeting_started_at?: string | null
          period_end?: string
          period_start?: string
          spa_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_validated_by_fkey"
            columns: ["validated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      responsibility_logs: {
        Row: {
          actual_count: number | null
          comment: string | null
          completion_rate: number
          consecutive_100_count: number
          created_at: string
          id: string
          report_id: string
          responsibility_template_id: string
          truth_prompt_triggered: boolean
          updated_at: string
        }
        Insert: {
          actual_count?: number | null
          comment?: string | null
          completion_rate?: number
          consecutive_100_count?: number
          created_at?: string
          id?: string
          report_id: string
          responsibility_template_id: string
          truth_prompt_triggered?: boolean
          updated_at?: string
        }
        Update: {
          actual_count?: number | null
          comment?: string | null
          completion_rate?: number
          consecutive_100_count?: number
          created_at?: string
          id?: string
          report_id?: string
          responsibility_template_id?: string
          truth_prompt_triggered?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsibility_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "responsibility_logs_responsibility_template_id_fkey"
            columns: ["responsibility_template_id"]
            isOneToOne: false
            referencedRelation: "responsibility_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      responsibility_templates: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          display_order: number
          expected_count: number
          frequency: string
          id: string
          is_active: boolean
          spa_id: string
          title: string
          title_en: string | null
          title_es: string | null
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          expected_count?: number
          frequency?: string
          id?: string
          is_active?: boolean
          spa_id: string
          title: string
          title_en?: string | null
          title_es?: string | null
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          expected_count?: number
          frequency?: string
          id?: string
          is_active?: boolean
          spa_id?: string
          title?: string
          title_en?: string | null
          title_es?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsibility_templates_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
        ]
      }
      spas: {
        Row: {
          country: string | null
          created_at: string
          created_by: string
          default_language: Database["public"]["Enums"]["language_code"]
          destination_id: string
          id: string
          is_active: boolean
          meeting_schedule: Json | null
          monthly_meeting_day: number | null
          name: string
          organization_id: string
          reporting_cycle_type: Database["public"]["Enums"]["reporting_cycle_type"]
          slug: string
          timezone: string
          updated_at: string
          weekly_day_of_week: number | null
        }
        Insert: {
          country?: string | null
          created_at?: string
          created_by: string
          default_language?: Database["public"]["Enums"]["language_code"]
          destination_id: string
          id?: string
          is_active?: boolean
          meeting_schedule?: Json | null
          monthly_meeting_day?: number | null
          name: string
          organization_id: string
          reporting_cycle_type?: Database["public"]["Enums"]["reporting_cycle_type"]
          slug: string
          timezone?: string
          updated_at?: string
          weekly_day_of_week?: number | null
        }
        Update: {
          country?: string | null
          created_at?: string
          created_by?: string
          default_language?: Database["public"]["Enums"]["language_code"]
          destination_id?: string
          id?: string
          is_active?: boolean
          meeting_schedule?: Json | null
          monthly_meeting_day?: number | null
          name?: string
          organization_id?: string
          reporting_cycle_type?: Database["public"]["Enums"]["reporting_cycle_type"]
          slug?: string
          timezone?: string
          updated_at?: string
          weekly_day_of_week?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "spas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spas_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          deferred_count: number
          deferred_from_date: string | null
          description: string | null
          due_date: string | null
          id: string
          ids_item_id: string | null
          priority: Database["public"]["Enums"]["todo_priority"]
          report_id: string | null
          source: Database["public"]["Enums"]["todo_source"]
          spa_id: string
          status: Database["public"]["Enums"]["todo_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          deferred_count?: number
          deferred_from_date?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          ids_item_id?: string | null
          priority?: Database["public"]["Enums"]["todo_priority"]
          report_id?: string | null
          source?: Database["public"]["Enums"]["todo_source"]
          spa_id: string
          status?: Database["public"]["Enums"]["todo_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deferred_count?: number
          deferred_from_date?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          ids_item_id?: string | null
          priority?: Database["public"]["Enums"]["todo_priority"]
          report_id?: string | null
          source?: Database["public"]["Enums"]["todo_source"]
          spa_id?: string
          status?: Database["public"]["Enums"]["todo_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_ids_item_id_fkey"
            columns: ["ids_item_id"]
            isOneToOne: false
            referencedRelation: "ids_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          language: Database["public"]["Enums"]["language_code"]
          notification_email: boolean
          notification_in_app: boolean
          notification_prebriefing: boolean
          updated_at: string
          user_id: string
          weekly_day_preference: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          notification_email?: boolean
          notification_in_app?: boolean
          notification_prebriefing?: boolean
          updated_at?: string
          user_id: string
          weekly_day_preference?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          language?: Database["public"]["Enums"]["language_code"]
          notification_email?: boolean
          notification_in_app?: boolean
          notification_prebriefing?: boolean
          updated_at?: string
          user_id?: string
          weekly_day_preference?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          destination_id: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          manager_id: string | null
          organization_id: string | null
          preferred_language: Database["public"]["Enums"]["language_code"]
          role: Database["public"]["Enums"]["user_role"]
          spa_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          destination_id?: string | null
          email: string
          full_name?: string
          id: string
          is_active?: boolean
          manager_id?: string | null
          organization_id?: string | null
          preferred_language?: Database["public"]["Enums"]["language_code"]
          role?: Database["public"]["Enums"]["user_role"]
          spa_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          destination_id?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          manager_id?: string | null
          organization_id?: string | null
          preferred_language?: Database["public"]["Enums"]["language_code"]
          role?: Database["public"]["Enums"]["user_role"]
          spa_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      todos_overdue: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          deferred_count: number | null
          deferred_from_date: string | null
          description: string | null
          due_date: string | null
          id: string | null
          ids_item_id: string | null
          priority: Database["public"]["Enums"]["todo_priority"] | null
          report_id: string | null
          source: Database["public"]["Enums"]["todo_source"] | null
          spa_id: string | null
          status: Database["public"]["Enums"]["todo_status"] | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          deferred_count?: number | null
          deferred_from_date?: string | null
          description?: string | null
          due_date?: string | null
          id?: string | null
          ids_item_id?: string | null
          priority?: Database["public"]["Enums"]["todo_priority"] | null
          report_id?: string | null
          source?: Database["public"]["Enums"]["todo_source"] | null
          spa_id?: string | null
          status?: Database["public"]["Enums"]["todo_status"] | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          deferred_count?: number | null
          deferred_from_date?: string | null
          description?: string | null
          due_date?: string | null
          id?: string | null
          ids_item_id?: string | null
          priority?: Database["public"]["Enums"]["todo_priority"] | null
          report_id?: string | null
          source?: Database["public"]["Enums"]["todo_source"] | null
          spa_id?: string | null
          status?: Database["public"]["Enums"]["todo_status"] | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "todos_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_ids_item_id_fkey"
            columns: ["ids_item_id"]
            isOneToOne: false
            referencedRelation: "ids_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_spa_id_fkey"
            columns: ["spa_id"]
            isOneToOne: false
            referencedRelation: "spas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_user_destination_id: { Args: never; Returns: string }
      current_user_organization_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      current_user_spa_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      user_can_access_spa: { Args: { _spa_id: string }; Returns: boolean }
    }
    Enums: {
      comparison_direction: "higher_is_better" | "lower_is_better"
      ids_cycle_type: "weekly" | "monthly"
      ids_resolution_type:
        | "todo_created"
        | "objective_created"
        | "closed_no_action"
        | "deferred"
      ids_status: "captured" | "structured" | "converted" | "closed_no_action"
      kpi_category: "financial" | "operational" | "customer" | "hr" | "custom"
      kpi_status: "green" | "amber" | "red" | "not_applicable" | "excellent"
      language_code: "fr" | "en" | "es"
      memory_type:
        | "kpi_trend"
        | "recurring_issue"
        | "management_pattern"
        | "team_context"
        | "objective_history"
      notification_type:
        | "synthesis_ready"
        | "report_due"
        | "todos_overdue"
        | "direction_validated"
        | "prebriefing_ready"
        | "cycle_opened"
      objective_source: "manual" | "ids_conversion"
      objective_status: "active" | "achieved" | "abandoned"
      report_status:
        | "draft_preparation"
        | "ready_for_review"
        | "in_meeting"
        | "post_meeting_generated"
        | "validated"
      reporting_cycle_type: "weekly" | "monthly" | "both"
      todo_priority: "low" | "medium" | "high"
      todo_source: "manual" | "ids_conversion" | "ai_suggestion"
      todo_status: "pending" | "in_progress" | "done" | "deferred"
      user_role: "spa_manager" | "direction" | "admin" | "employee"
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
      comparison_direction: ["higher_is_better", "lower_is_better"],
      ids_cycle_type: ["weekly", "monthly"],
      ids_resolution_type: [
        "todo_created",
        "objective_created",
        "closed_no_action",
        "deferred",
      ],
      ids_status: ["captured", "structured", "converted", "closed_no_action"],
      kpi_category: ["financial", "operational", "customer", "hr", "custom"],
      kpi_status: ["green", "amber", "red", "not_applicable", "excellent"],
      language_code: ["fr", "en", "es"],
      memory_type: [
        "kpi_trend",
        "recurring_issue",
        "management_pattern",
        "team_context",
        "objective_history",
      ],
      notification_type: [
        "synthesis_ready",
        "report_due",
        "todos_overdue",
        "direction_validated",
        "prebriefing_ready",
        "cycle_opened",
      ],
      objective_source: ["manual", "ids_conversion"],
      objective_status: ["active", "achieved", "abandoned"],
      report_status: [
        "draft_preparation",
        "ready_for_review",
        "in_meeting",
        "post_meeting_generated",
        "validated",
      ],
      reporting_cycle_type: ["weekly", "monthly", "both"],
      todo_priority: ["low", "medium", "high"],
      todo_source: ["manual", "ids_conversion", "ai_suggestion"],
      todo_status: ["pending", "in_progress", "done", "deferred"],
      user_role: ["spa_manager", "direction", "admin", "employee"],
    },
  },
} as const
