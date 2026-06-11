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
      album_tracks: {
        Row: {
          album_id: string
          created_at: string
          position: number
          track_id: string
        }
        Insert: {
          album_id: string
          created_at?: string
          position?: number
          track_id: string
        }
        Update: {
          album_id?: string
          created_at?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "album_tracks_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "album_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      albums: {
        Row: {
          artist_id: string
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          plays: number
          released_at: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          plays?: number
          released_at?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          plays?: number
          released_at?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      announcements: {
        Row: {
          active: boolean
          body: string | null
          created_at: string
          id: string
          level: string
          title: string
        }
        Insert: {
          active?: boolean
          body?: string | null
          created_at?: string
          id?: string
          level?: string
          title: string
        }
        Update: {
          active?: boolean
          body?: string | null
          created_at?: string
          id?: string
          level?: string
          title?: string
        }
        Relationships: []
      }
      artist_creation_fees: {
        Row: {
          amount_xof: number
          created_at: string
          flw_payment_link: string | null
          flw_tx_id: string | null
          flw_tx_ref: string | null
          id: string
          method: string | null
          paid_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_xof?: number
          created_at?: string
          flw_payment_link?: string | null
          flw_tx_id?: string | null
          flw_tx_ref?: string | null
          id?: string
          method?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_xof?: number
          created_at?: string
          flw_payment_link?: string | null
          flw_tx_id?: string | null
          flw_tx_ref?: string | null
          id?: string
          method?: string | null
          paid_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      artist_daily_stats: {
        Row: {
          artist_id: string
          comments: number
          day: string
          followers_gained: number
          followers_lost: number
          likes: number
          plays: number
          reposts: number
          unlikes: number
        }
        Insert: {
          artist_id: string
          comments?: number
          day: string
          followers_gained?: number
          followers_lost?: number
          likes?: number
          plays?: number
          reposts?: number
          unlikes?: number
        }
        Update: {
          artist_id?: string
          comments?: number
          day?: string
          followers_gained?: number
          followers_lost?: number
          likes?: number
          plays?: number
          reposts?: number
          unlikes?: number
        }
        Relationships: []
      }
      artist_followers: {
        Row: {
          artist_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artist_followers_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      artist_verification_requests: {
        Row: {
          artist_id: string | null
          country: string | null
          created_at: string
          display_name: string | null
          documents: Json | null
          genre: string | null
          id: string
          legal_name: string | null
          notes: string | null
          reason: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          social_links: Json | null
          stage_name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          artist_id?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          documents?: Json | null
          genre?: string | null
          id?: string
          legal_name?: string | null
          notes?: string | null
          reason?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json | null
          stage_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          artist_id?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          documents?: Json | null
          genre?: string | null
          id?: string
          legal_name?: string | null
          notes?: string | null
          reason?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          social_links?: Json | null
          stage_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      artists: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cover_url: string | null
          created_at: string
          id: string
          monthly_listeners: number
          name: string
          pro_badge: string
          slug: string
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          monthly_listeners?: number
          name: string
          pro_badge?: string
          slug: string
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cover_url?: string | null
          created_at?: string
          id?: string
          monthly_listeners?: number
          name?: string
          pro_badge?: string
          slug?: string
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      audio_access_logs: {
        Row: {
          access_type: string | null
          artist_id: string | null
          created_at: string
          id: string
          ip: string | null
          ip_address: string | null
          mode: string | null
          reason: string | null
          request_id: string | null
          track_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          access_type?: string | null
          artist_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          ip_address?: string | null
          mode?: string | null
          reason?: string | null
          request_id?: string | null
          track_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          access_type?: string | null
          artist_id?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          ip_address?: string | null
          mode?: string | null
          reason?: string | null
          request_id?: string | null
          track_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bank_receipts: {
        Row: {
          amount_xof: number | null
          created_at: string
          id: string
          receipt_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_xof?: number | null
          created_at?: string
          id?: string
          receipt_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_xof?: number | null
          created_at?: string
          id?: string
          receipt_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      banned_ips: {
        Row: {
          banned_by: string | null
          created_at: string
          id: string
          ip: string
          reason: string | null
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          id?: string
          ip: string
          reason?: string | null
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          id?: string
          ip?: string
          reason?: string | null
        }
        Relationships: []
      }
      branding: {
        Row: {
          app_name: string | null
          favicon_url: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          updated_at: string
        }
        Insert: {
          app_name?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          updated_at?: string
        }
        Update: {
          app_name?: string | null
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cms_pages: {
        Row: {
          body: string | null
          created_at: string
          id: string
          in_footer: boolean
          published: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          in_footer?: boolean
          published?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          in_footer?: boolean
          published?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          last_sender_id: string | null
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          last_sender_id?: string | null
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          last_sender_id?: string | null
          user1_id?: string
          user2_id?: string
        }
        Relationships: []
      }
      copyright_claims: {
        Row: {
          created_at: string
          evidence_url: string | null
          id: string
          reason: string | null
          reporter_id: string | null
          resolved_at: string | null
          status: string
          track_id: string | null
        }
        Insert: {
          created_at?: string
          evidence_url?: string | null
          id?: string
          reason?: string | null
          reporter_id?: string | null
          resolved_at?: string | null
          status?: string
          track_id?: string | null
        }
        Update: {
          created_at?: string
          evidence_url?: string | null
          id?: string
          reason?: string | null
          reporter_id?: string | null
          resolved_at?: string | null
          status?: string
          track_id?: string | null
        }
        Relationships: []
      }
      faq_items: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          id: string
          is_published: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      listening_history: {
        Row: {
          id: string
          played_at: string
          track_id: string
          user_id: string
        }
        Insert: {
          id?: string
          played_at?: string
          track_id: string
          user_id: string
        }
        Update: {
          id?: string
          played_at?: string
          track_id?: string
          user_id?: string
        }
        Relationships: []
      }
      live_rooms: {
        Row: {
          artist_id: string
          created_at: string
          ended_at: string | null
          id: string
          is_live: boolean
          mode: string
          started_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          artist_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_live?: boolean
          mode?: string
          started_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          artist_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          is_live?: boolean
          mode?: string
          started_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_rooms_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: true
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      live_stage_members: {
        Row: {
          cam_enabled: boolean
          created_at: string
          expires_at: string | null
          id: string
          mic_enabled: boolean
          request_message: string | null
          role: string
          room_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cam_enabled?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          mic_enabled?: boolean
          request_message?: string | null
          role?: string
          room_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cam_enabled?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          mic_enabled?: boolean
          request_message?: string | null
          role?: string
          room_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_stage_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "live_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          audio_duration_ms: number | null
          audio_url: string | null
          content: string | null
          conversation_id: string
          created_at: string
          id: string
          image_url: string | null
          read_at: string | null
          sender_id: string
          transcript: string | null
        }
        Insert: {
          audio_duration_ms?: number | null
          audio_url?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          read_at?: string | null
          sender_id: string
          transcript?: string | null
        }
        Update: {
          audio_duration_ms?: number | null
          audio_url?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          read_at?: string | null
          sender_id?: string
          transcript?: string | null
        }
        Relationships: []
      }
      mm_payments: {
        Row: {
          admin_notes: string | null
          amount_xof: number
          applied: boolean
          created_at: string
          full_name: string
          id: string
          identifier: string | null
          merchant_number: string
          operator: string
          phone: string
          provider: string
          purpose: string
          reviewed_at: string | null
          reviewed_by: string | null
          screenshot_url: string | null
          status: string
          target_id: string | null
          transaction_ref: string | null
          tx_reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount_xof: number
          applied?: boolean
          created_at?: string
          full_name: string
          id?: string
          identifier?: string | null
          merchant_number: string
          operator: string
          phone: string
          provider?: string
          purpose: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          status?: string
          target_id?: string | null
          transaction_ref?: string | null
          tx_reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount_xof?: number
          applied?: boolean
          created_at?: string
          full_name?: string
          id?: string
          identifier?: string | null
          merchant_number?: string
          operator?: string
          phone?: string
          provider?: string
          purpose?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          screenshot_url?: string | null
          status?: string
          target_id?: string | null
          transaction_ref?: string | null
          tx_reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mm_settings: {
        Row: {
          flooz_number: string
          id: boolean
          paygate_api_key: string | null
          paygate_enabled: boolean
          plan_basic_days: number
          plan_basic_xof: number
          plan_premium_days: number
          plan_premium_xof: number
          plan_vip_days: number
          plan_vip_xof: number
          updated_at: string
          yas_number: string
        }
        Insert: {
          flooz_number?: string
          id?: boolean
          paygate_api_key?: string | null
          paygate_enabled?: boolean
          plan_basic_days?: number
          plan_basic_xof?: number
          plan_premium_days?: number
          plan_premium_xof?: number
          plan_vip_days?: number
          plan_vip_xof?: number
          updated_at?: string
          yas_number?: string
        }
        Update: {
          flooz_number?: string
          id?: boolean
          paygate_api_key?: string | null
          paygate_enabled?: boolean
          plan_basic_days?: number
          plan_basic_xof?: number
          plan_premium_days?: number
          plan_premium_xof?: number
          plan_vip_days?: number
          plan_vip_xof?: number
          updated_at?: string
          yas_number?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          amount: number | null
          cinetpay_tx_id: string | null
          created_at: string
          currency: string | null
          event_type: string | null
          flw_tx_id: string | null
          flw_tx_ref: string | null
          id: string
          payload: Json | null
          processed: boolean
          processed_at: string | null
          processing_error: string | null
          provider: string
          signature: string | null
          status: string | null
        }
        Insert: {
          amount?: number | null
          cinetpay_tx_id?: string | null
          created_at?: string
          currency?: string | null
          event_type?: string | null
          flw_tx_id?: string | null
          flw_tx_ref?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider: string
          signature?: string | null
          status?: string | null
        }
        Update: {
          amount?: number | null
          cinetpay_tx_id?: string | null
          created_at?: string
          currency?: string | null
          event_type?: string | null
          flw_tx_id?: string | null
          flw_tx_ref?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          signature?: string | null
          status?: string | null
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          api_key: string | null
          api_url: string
          created_at: string
          currency: string
          enabled: boolean
          id: string
          mode: string
          notify_url_override: string | null
          provider: string
          secret_key: string | null
          site_id: string | null
          updated_at: string
        }
        Insert: {
          api_key?: string | null
          api_url?: string
          created_at?: string
          currency?: string
          enabled?: boolean
          id?: string
          mode?: string
          notify_url_override?: string | null
          provider?: string
          secret_key?: string | null
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          api_key?: string | null
          api_url?: string
          created_at?: string
          currency?: string
          enabled?: boolean
          id?: string
          mode?: string
          notify_url_override?: string | null
          provider?: string
          secret_key?: string | null
          site_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      playlist_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          playlist_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          playlist_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          playlist_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_collaborators_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_tracks: {
        Row: {
          added_at: string
          added_by: string | null
          created_at: string
          id: string
          playlist_id: string
          position: number
          track_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          created_at?: string
          id?: string
          playlist_id: string
          position?: number
          track_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          created_at?: string
          id?: string
          playlist_id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          slug: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          slug: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          slug?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json | null
          points: number
          reference: string | null
          song_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metadata?: Json | null
          points: number
          reference?: string | null
          song_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json | null
          points?: number
          reference?: string | null
          song_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          last_seen_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          last_seen_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_seen_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          album_id: string | null
          amount: number | null
          artist_id: string | null
          created_at: string
          currency: string | null
          flw_tx_id: string | null
          flw_tx_ref: string | null
          id: string
          paid_at: string | null
          payment_url: string | null
          provider: string
          raw_response: Json | null
          status: string
          track_id: string | null
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          album_id?: string | null
          amount?: number | null
          artist_id?: string | null
          created_at?: string
          currency?: string | null
          flw_tx_id?: string | null
          flw_tx_ref?: string | null
          id?: string
          paid_at?: string | null
          payment_url?: string | null
          provider?: string
          raw_response?: Json | null
          status?: string
          track_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          album_id?: string | null
          amount?: number | null
          artist_id?: string | null
          created_at?: string
          currency?: string | null
          flw_tx_id?: string | null
          flw_tx_ref?: string | null
          id?: string
          paid_at?: string | null
          payment_url?: string | null
          provider?: string
          raw_response?: Json | null
          status?: string
          track_id?: string | null
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          id: string
          reason: string | null
          reporter_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string | null
          reporter_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          logo_url: string | null
          updated_at: string
        }
        Insert: {
          id: string
          logo_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          logo_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number | null
          cancelled_at: string | null
          created_at: string
          currency: string | null
          current_period_end: string | null
          current_period_start: string | null
          flw_tx_id: string | null
          flw_tx_ref: string | null
          id: string
          payment_url: string | null
          plan: string
          provider: string
          raw_response: Json | null
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          flw_tx_id?: string | null
          flw_tx_ref?: string | null
          id?: string
          payment_url?: string | null
          plan: string
          provider?: string
          raw_response?: Json | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          flw_tx_id?: string | null
          flw_tx_ref?: string | null
          id?: string
          payment_url?: string | null
          plan?: string
          provider?: string
          raw_response?: Json | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      track_access: {
        Row: {
          expires_at: string | null
          granted_at: string
          id: string
          source: string
          track_id: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          id?: string
          source?: string
          track_id: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          id?: string
          source?: string
          track_id?: string
          user_id?: string
        }
        Relationships: []
      }
      track_comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "track_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      track_comments: {
        Row: {
          author_name: string | null
          body: string | null
          content: string | null
          created_at: string
          id: string
          image_url: string | null
          parent_comment_id: string | null
          parent_id: string | null
          pinned: boolean
          track_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          body?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          parent_comment_id?: string | null
          parent_id?: string | null
          pinned?: boolean
          track_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          body?: string | null
          content?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          parent_comment_id?: string | null
          parent_id?: string | null
          pinned?: boolean
          track_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "track_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_comments_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_events: {
        Row: {
          artist_id: string
          created_at: string
          event_type: string
          id: number
          track_id: string
          user_id: string | null
        }
        Insert: {
          artist_id: string
          created_at?: string
          event_type: string
          id?: number
          track_id: string
          user_id?: string | null
        }
        Update: {
          artist_id?: string
          created_at?: string
          event_type?: string
          id?: number
          track_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "track_events_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "track_events_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_likes: {
        Row: {
          created_at: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_likes_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_reposts: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_reposts_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      track_unlocks: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          kind: string
          seconds_granted: number
          source: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          kind: string
          seconds_granted?: number
          source: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          kind?: string
          seconds_granted?: number
          source?: string
          track_id?: string
          user_id?: string
        }
        Relationships: []
      }
      tracks: {
        Row: {
          artist_id: string
          audio_url: string
          cover_url: string | null
          created_at: string
          description: string | null
          duration_seconds: number
          genre: string | null
          id: string
          is_published: boolean
          likes: number
          lyrics: string | null
          plays: number
          preview_seconds: number
          price_amount: number
          price_currency: string
          pricing_model: string
          released_at: string
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          artist_id: string
          audio_url: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number
          genre?: string | null
          id?: string
          is_published?: boolean
          likes?: number
          lyrics?: string | null
          plays?: number
          preview_seconds?: number
          price_amount?: number
          price_currency?: string
          pricing_model?: string
          released_at?: string
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          artist_id?: string
          audio_url?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number
          genre?: string | null
          id?: string
          is_published?: boolean
          likes?: number
          lyrics?: string | null
          plays?: number
          preview_seconds?: number
          price_amount?: number
          price_currency?: string
          pricing_model?: string
          released_at?: string
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_artist_id_fkey"
            columns: ["artist_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id"]
          },
        ]
      }
      user_points: {
        Row: {
          points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          points?: number
          updated_at?: string
          user_id?: string
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
      wallet_balances: {
        Row: {
          balance_xof: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_xof?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_xof?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_topup_requests: {
        Row: {
          amount_xof: number
          created_at: string
          id: string
          method: string
          notes: string | null
          receipt_url: string | null
          reference: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_xof: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          receipt_url?: string | null
          reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_xof?: number
          created_at?: string
          id?: string
          method?: string
          notes?: string | null
          receipt_url?: string | null
          reference?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount_xof: number
          created_at: string
          description: string | null
          flw_tx_ref: string | null
          id: string
          kind: string
          metadata: Json | null
          reference: string | null
          settled_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_xof: number
          created_at?: string
          description?: string | null
          flw_tx_ref?: string | null
          id?: string
          kind: string
          metadata?: Json | null
          reference?: string | null
          settled_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_xof?: number
          created_at?: string
          description?: string | null
          flw_tx_ref?: string | null
          id?: string
          kind?: string
          metadata?: Json | null
          reference?: string | null
          settled_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          amount_xof: number
          artist_id: string | null
          created_at: string
          destination: Json | null
          id: string
          method: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_xof: number
          artist_id?: string | null
          created_at?: string
          destination?: Json | null
          id?: string
          method?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_xof?: number
          artist_id?: string | null
          created_at?: string
          destination?: Json | null
          id?: string
          method?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_artist_verification: {
        Args: { _request_id: string }
        Returns: undefined
      }
      approve_wallet_topup: { Args: { _req_id: string }; Returns: undefined }
      award_points: {
        Args: {
          _kind: string
          _points: number
          _ref?: string
          _song_id?: string
          _user_id: string
        }
        Returns: number
      }
      buy_track_with_wallet: {
        Args: { _track_id: string; _user_id: string }
        Returns: {
          amount_xof: number
          new_balance_xof: number
        }[]
      }
      convert_points_to_wallet: {
        Args: { _points: number; _user_id: string }
        Returns: {
          credited_xof: number
          new_balance_xof: number
          new_points: number
        }[]
      }
      dev_credit_wallet: {
        Args: { _amount: number; _user_id: string }
        Returns: number
      }
      fetch_trending_tracks: {
        Args: { _days?: number; _limit?: number }
        Returns: {
          recent_plays: number
          track_id: string
        }[]
      }
      get_artist_balance: { Args: { _artist_id: string }; Returns: number }
      get_or_create_conversation: {
        Args: { _other_user_id: string }
        Returns: string
      }
      get_track_purchase_count: { Args: { _track_id: string }; Returns: number }
      get_user_fan_tier: {
        Args: { _artist_id: string; _user_id: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mm_apply_paygate_callback: {
        Args: {
          _amount: number
          _identifier: string
          _payment_method: string
          _payment_reference: string
          _phone: string
          _tx_reference: string
        }
        Returns: undefined
      }
      mm_approve_payment: { Args: { _payment_id: string }; Returns: undefined }
      mm_reject_payment: {
        Args: { _payment_id: string; _reason?: string }
        Returns: undefined
      }
      pay_artist_fee_with_wallet: {
        Args: { _user_id: string }
        Returns: {
          amount_xof: number
          new_balance_xof: number
        }[]
      }
      reject_artist_verification: {
        Args: { _reason?: string; _request_id: string }
        Returns: undefined
      }
      reject_wallet_topup: {
        Args: { _reason?: string; _req_id: string }
        Returns: undefined
      }
      spend_points_minute: {
        Args: { _track_id: string; _user_id: string }
        Returns: {
          new_balance: number
          points_used: number
        }[]
      }
      user_has_track_access: {
        Args: { _track_id: string; _user_id: string }
        Returns: boolean
      }
      wallet_apply_settled: {
        Args: { _amount: number; _ref?: string; _user_id: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "super_admin"
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
      app_role: ["admin", "moderator", "user", "super_admin"],
    },
  },
} as const
