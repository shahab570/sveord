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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          email: string | null
          first_name: string | null
          id: string
          is_approved: boolean | null
          last_name: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          email?: string | null
          first_name?: string | null
          id: string
          is_approved?: boolean | null
          last_name?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          email?: string | null
          first_name?: string | null
          id?: string
          is_approved?: boolean | null
          last_name?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_history: {
        Row: {
          file_name: string
          file_type: string
          id: string
          list_type: string | null
          records_processed: number | null
          uploaded_at: string
          user_id: string
        }
        Insert: {
          file_name: string
          file_type: string
          id?: string
          list_type?: string | null
          records_processed?: number | null
          uploaded_at?: string
          user_id: string
        }
        Update: {
          file_name?: string
          file_type?: string
          id?: string
          list_type?: string | null
          records_processed?: number | null
          uploaded_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          id: string
          user_id: string
          gemini_api_key: string
          gemini_model: string | null
          gemini_api_version: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          gemini_api_key: string
          gemini_model?: string | null
          gemini_api_version?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          gemini_api_key?: string
          gemini_model?: string | null
          gemini_api_version?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          created_at: string | null
          custom_spelling: string | null
          id: string
          is_learned: boolean | null
          is_reserve: boolean | null
          learned_date: string | null
          srs_ease: number | null
          srs_interval: number | null
          srs_next_review: string | null
          updated_at: string | null
          user_id: string
          user_meaning: string | null
          word_id: number
        }
        Insert: {
          created_at?: string | null
          custom_spelling?: string | null
          id?: string
          is_learned?: boolean | null
          is_reserve?: boolean | null
          learned_date?: string | null
          srs_ease?: number | null
          srs_interval?: number | null
          srs_next_review?: string | null
          updated_at?: string | null
          user_id: string
          user_meaning?: string | null
          word_id: number
        }
        Update: {
          created_at?: string | null
          custom_spelling?: string | null
          id?: string
          is_learned?: boolean | null
          is_reserve?: boolean | null
          learned_date?: string | null
          srs_ease?: number | null
          srs_interval?: number | null
          srs_next_review?: string | null
          updated_at?: string | null
          user_id?: string
          user_meaning?: string | null
          word_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      words: {
        Row: {
          created_at: string | null
          frequency_rank: number | null
          id: number
          kelly_level: string | null
          kelly_source_id: number | null
          sidor_rank: number | null
          sidor_source_id: number | null
          swedish_word: string
          word_data: Json | null
        }
        Insert: {
          created_at?: string | null
          frequency_rank?: number | null
          id?: number
          kelly_level?: string | null
          kelly_source_id?: number | null
          sidor_rank?: number | null
          sidor_source_id?: number | null
          swedish_word: string
          word_data?: Json | null
        }
        Update: {
          created_at?: string | null
          frequency_rank?: number | null
          id?: number
          kelly_level?: string | null
          kelly_source_id?: number | null
          sidor_rank?: number | null
          sidor_source_id?: number | null
          swedish_word?: string
          word_data?: Json | null
        }
        Relationships: []
      }
      saved_quizzes: {
        Row: {
          id: string
          user_id: string
          type: string
          questions: Json
          explanations: Json | null
          is_practiced: boolean | null
          created_at: string
          practiced_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          questions: Json
          explanations?: Json | null
          is_practiced?: boolean | null
          created_at?: string
          practiced_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          questions?: Json
          explanations?: Json | null
          is_practiced?: boolean | null
          created_at?: string
          practiced_at?: string | null
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
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
