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
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      artists: {
        Row: {
          ativo: boolean
          cache_minimo: number
          cor: string
          created_at: string
          foto_url: string | null
          google_calendar_id: string | null
          id: string
          nome: string
          rider_padrao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cache_minimo?: number
          cor?: string
          created_at?: string
          foto_url?: string | null
          google_calendar_id?: string | null
          id?: string
          nome: string
          rider_padrao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cache_minimo?: number
          cor?: string
          created_at?: string
          foto_url?: string | null
          google_calendar_id?: string | null
          id?: string
          nome?: string
          rider_padrao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          artist_id: string | null
          created_at: string
          created_by: string | null
          data: string
          id: string
          motivo: string | null
        }
        Insert: {
          artist_id?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          id?: string
          motivo?: string | null
        }
        Update: {
          artist_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      contratantes: {
        Row: {
          cep: string | null
          cidade: string | null
          created_at: string
          created_by: string | null
          documento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          documento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          show_id: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          show_id?: string | null
          tipo: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          show_id?: string | null
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          nome: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          nome?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          nome?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      show_calendar_events: {
        Row: {
          artist_id: string
          created_at: string
          google_calendar_id: string | null
          google_event_id: string | null
          id: string
          last_synced_at: string | null
          show_id: string
          sync_error: string | null
        }
        Insert: {
          artist_id: string
          created_at?: string
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          last_synced_at?: string | null
          show_id: string
          sync_error?: string | null
        }
        Update: {
          artist_id?: string
          created_at?: string
          google_calendar_id?: string | null
          google_event_id?: string | null
          id?: string
          last_synced_at?: string | null
          show_id?: string
          sync_error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "show_calendar_events_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_calendar_events_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: true
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_calendar_events_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: true
            referencedRelation: "shows_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      show_deposits: {
        Row: {
          created_at: string
          data: string | null
          id: string
          observacao: string | null
          responsavel: string | null
          show_id: string
          status: Database["public"]["Enums"]["deposito_status"]
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string | null
          id?: string
          observacao?: string | null
          responsavel?: string | null
          show_id: string
          status?: Database["public"]["Enums"]["deposito_status"]
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string | null
          id?: string
          observacao?: string | null
          responsavel?: string | null
          show_id?: string
          status?: Database["public"]["Enums"]["deposito_status"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "show_deposits_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_deposits_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      show_expenses: {
        Row: {
          categoria: string
          created_at: string
          data: string | null
          descricao: string | null
          id: string
          show_id: string
          valor: number
        }
        Insert: {
          categoria?: string
          created_at?: string
          data?: string | null
          descricao?: string | null
          id?: string
          show_id: string
          valor?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string | null
          descricao?: string | null
          id?: string
          show_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "show_expenses_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_expenses_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          artist_id: string
          auto_aprovado: boolean
          auto_aprovado_em: string | null
          autorizado_por: string | null
          aviso_12h_enviado_em: string | null
          cache_total: number
          camarins_rider: string | null
          cancelado_em: string | null
          cancelado_motivo: string | null
          capacidade: number | null
          cidade: string | null
          comprovante_enviado_em: string | null
          comprovante_enviado_por: string | null
          comprovante_url: string | null
          condicao_pagamento: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          contratante_cep: string | null
          contratante_cidade: string | null
          contratante_documento: string | null
          contratante_email: string | null
          contratante_endereco: string | null
          contratante_id: string | null
          contratante_nome: string | null
          contratante_telefone: string | null
          created_at: string
          created_by: string | null
          data_show: string
          data_subida: string | null
          encargos_extras: boolean
          endereco: string | null
          horario: string | null
          hosp_diaria_alimentacao: boolean
          hosp_hospedagem: boolean
          hosp_traslado: boolean
          id: string
          local: string | null
          prazo_comprovante_em: string | null
          status: Database["public"]["Enums"]["show_status"]
          tipo_estrutura: Database["public"]["Enums"]["estrutura_tipo"] | null
          transp_aereo: boolean
          transp_excesso_bagagem: boolean
          transp_observacoes: string | null
          transp_onibus: boolean
          transp_van: boolean
          updated_at: string
          vendedor: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          artist_id: string
          auto_aprovado?: boolean
          auto_aprovado_em?: string | null
          autorizado_por?: string | null
          aviso_12h_enviado_em?: string | null
          cache_total?: number
          camarins_rider?: string | null
          cancelado_em?: string | null
          cancelado_motivo?: string | null
          capacidade?: number | null
          cidade?: string | null
          comprovante_enviado_em?: string | null
          comprovante_enviado_por?: string | null
          comprovante_url?: string | null
          condicao_pagamento?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          contratante_cep?: string | null
          contratante_cidade?: string | null
          contratante_documento?: string | null
          contratante_email?: string | null
          contratante_endereco?: string | null
          contratante_id?: string | null
          contratante_nome?: string | null
          contratante_telefone?: string | null
          created_at?: string
          created_by?: string | null
          data_show: string
          data_subida?: string | null
          encargos_extras?: boolean
          endereco?: string | null
          horario?: string | null
          hosp_diaria_alimentacao?: boolean
          hosp_hospedagem?: boolean
          hosp_traslado?: boolean
          id?: string
          local?: string | null
          prazo_comprovante_em?: string | null
          status?: Database["public"]["Enums"]["show_status"]
          tipo_estrutura?: Database["public"]["Enums"]["estrutura_tipo"] | null
          transp_aereo?: boolean
          transp_excesso_bagagem?: boolean
          transp_observacoes?: string | null
          transp_onibus?: boolean
          transp_van?: boolean
          updated_at?: string
          vendedor?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          artist_id?: string
          auto_aprovado?: boolean
          auto_aprovado_em?: string | null
          autorizado_por?: string | null
          aviso_12h_enviado_em?: string | null
          cache_total?: number
          camarins_rider?: string | null
          cancelado_em?: string | null
          cancelado_motivo?: string | null
          capacidade?: number | null
          cidade?: string | null
          comprovante_enviado_em?: string | null
          comprovante_enviado_por?: string | null
          comprovante_url?: string | null
          condicao_pagamento?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          contratante_cep?: string | null
          contratante_cidade?: string | null
          contratante_documento?: string | null
          contratante_email?: string | null
          contratante_endereco?: string | null
          contratante_id?: string | null
          contratante_nome?: string | null
          contratante_telefone?: string | null
          created_at?: string
          created_by?: string | null
          data_show?: string
          data_subida?: string | null
          encargos_extras?: boolean
          endereco?: string | null
          horario?: string | null
          hosp_diaria_alimentacao?: boolean
          hosp_hospedagem?: boolean
          hosp_traslado?: boolean
          id?: string
          local?: string | null
          prazo_comprovante_em?: string | null
          status?: Database["public"]["Enums"]["show_status"]
          tipo_estrutura?: Database["public"]["Enums"]["estrutura_tipo"] | null
          transp_aereo?: boolean
          transp_excesso_bagagem?: boolean
          transp_observacoes?: string | null
          transp_onibus?: boolean
          transp_van?: boolean
          updated_at?: string
          vendedor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shows_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          artist_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          artist_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          artist_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_artist_fk"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      vendedor_artists: {
        Row: {
          artist_id: string
          created_at: string
          vendedor_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          vendedor_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendedor_artists_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      shows_public_view: {
        Row: {
          artist_cor: string | null
          artist_id: string | null
          artist_nome: string | null
          cidade: string | null
          created_by: string | null
          data_show: string | null
          horario: string | null
          id: string | null
          local: string | null
          status: Database["public"]["Enums"]["show_status"] | null
          vendedor: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shows_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_business_hours: {
        Args: { hours_to_add: number; start_ts: string }
        Returns: string
      }
      get_my_artist_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "gerente" | "equipe" | "artista" | "vendedor" | "financeiro"
      deposito_status: "ok" | "pendente"
      estrutura_tipo: "aberta" | "fechada"
      show_status:
        | "pendente"
        | "aprovada"
        | "aguardando_pagamento"
        | "comprovante_enviado"
        | "confirmado"
        | "cancelada"
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
      app_role: ["gerente", "equipe", "artista", "vendedor", "financeiro"],
      deposito_status: ["ok", "pendente"],
      estrutura_tipo: ["aberta", "fechada"],
      show_status: [
        "pendente",
        "aprovada",
        "aguardando_pagamento",
        "comprovante_enviado",
        "confirmado",
        "cancelada",
      ],
    },
  },
} as const
