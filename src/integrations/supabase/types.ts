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
      attempts: {
        Row: {
          at: string
          id: number
          kind: string
          ok: boolean
          subject: string
        }
        Insert: {
          at?: string
          id?: number
          kind: string
          ok: boolean
          subject: string
        }
        Update: {
          at?: string
          id?: number
          kind?: string
          ok?: boolean
          subject?: string
        }
        Relationships: []
      }
      designs: {
        Row: {
          author_nick: string
          design: Json
          edit_key_hash: string
          id: string
          review_note: string
          reviewed_at: string | null
          status: string
          submitted_at: string
          title: string
          version: number
        }
        Insert: {
          author_nick: string
          design: Json
          edit_key_hash: string
          id?: string
          review_note?: string
          reviewed_at?: string | null
          status?: string
          submitted_at?: string
          title: string
          version: number
        }
        Update: {
          author_nick?: string
          design?: Json
          edit_key_hash?: string
          id?: string
          review_note?: string
          reviewed_at?: string | null
          status?: string
          submitted_at?: string
          title?: string
          version?: number
        }
        Relationships: []
      }
      feedback: {
        Row: {
          body: string
          created_at: string
          design_id: string
          id: string
          nickname: string
          trap: string
        }
        Insert: {
          body?: string
          created_at?: string
          design_id: string
          id?: string
          nickname?: string
          trap?: string
        }
        Update: {
          body?: string
          created_at?: string
          design_id?: string
          id?: string
          nickname?: string
          trap?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "designs"
            referencedColumns: ["id"]
          },
        ]
      }
      history: {
        Row: {
          action: string
          actor: string
          ballots: Json
          created_at: string
          event: Json | null
          failed: boolean
          id: string
          kind: string
          note: string
          npc: boolean
          readings: Json
          resolved_by: string
          room_id: string
          round: number
          seq: number
          tags: Json
          target: string
          turn: number
          year: number | null
        }
        Insert: {
          action?: string
          actor?: string
          ballots?: Json
          created_at?: string
          event?: Json | null
          failed?: boolean
          id?: string
          kind: string
          note?: string
          npc?: boolean
          readings?: Json
          resolved_by?: string
          room_id: string
          round: number
          seq: number
          tags?: Json
          target?: string
          turn: number
          year?: number | null
        }
        Update: {
          action?: string
          actor?: string
          ballots?: Json
          created_at?: string
          event?: Json | null
          failed?: boolean
          id?: string
          kind?: string
          note?: string
          npc?: boolean
          readings?: Json
          resolved_by?: string
          room_id?: string
          round?: number
          seq?: number
          tags?: Json
          target?: string
          turn?: number
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "history_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_private: {
        Row: {
          ai_calls: number
          design: Json
          npc_claim: number
          npc_seq: number
          recovery_hash: string
          room_id: string
        }
        Insert: {
          ai_calls?: number
          design: Json
          npc_claim?: number
          npc_seq?: number
          recovery_hash: string
          room_id: string
        }
        Update: {
          ai_calls?: number
          design?: Json
          npc_claim?: number
          npc_seq?: number
          recovery_hash?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_private_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          fill_ai: boolean
          game_key: string | null
          host_user_id: string
          id: string
          locked: boolean
          pause_mode: string
          phase: string
          progress: Json | null
          rev: number
          state: Json | null
          teams: Json
          test: boolean
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          fill_ai?: boolean
          game_key?: string | null
          host_user_id: string
          id?: string
          locked?: boolean
          pause_mode?: string
          phase?: string
          progress?: Json | null
          rev?: number
          state?: Json | null
          teams?: Json
          test?: boolean
          title?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          fill_ai?: boolean
          game_key?: string | null
          host_user_id?: string
          id?: string
          locked?: boolean
          pause_mode?: string
          phase?: string
          progress?: Json | null
          rev?: number
          state?: Json | null
          teams?: Json
          test?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      seats: {
        Row: {
          actor: string | null
          id: string
          joined_at: string
          nickname: string
          room_id: string
          user_id: string
        }
        Insert: {
          actor?: string | null
          id?: string
          joined_at?: string
          nickname: string
          room_id: string
          user_id: string
        }
        Update: {
          actor?: string | null
          id?: string
          joined_at?: string
          nickname?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seats_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
          loc: string
          pass: boolean
          quote: string
          room_id: string
          seat_id: string
          seq: number
          src: string
          target: string
          why: string
        }
        Insert: {
          action?: string
          actor: string
          created_at?: string
          id?: string
          loc?: string
          pass?: boolean
          quote?: string
          room_id: string
          seat_id: string
          seq: number
          src?: string
          target?: string
          why?: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
          loc?: string
          pass?: boolean
          quote?: string
          room_id?: string
          seat_id?: string
          seq?: number
          src?: string
          target?: string
          why?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_seat_id_fkey"
            columns: ["seat_id"]
            isOneToOne: false
            referencedRelation: "seats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
