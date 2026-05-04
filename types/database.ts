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
      ads: {
        Row: {
          clicks_count: number
          created_at: string
          created_by: string
          description: string | null
          display_order: number
          ends_at: string | null
          id: string
          image_url: string
          impressions_count: number
          is_active: boolean
          link_url: string
          placement: Database["public"]["Enums"]["ad_placement"]
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          clicks_count?: number
          created_at?: string
          created_by: string
          description?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          image_url: string
          impressions_count?: number
          is_active?: boolean
          link_url: string
          placement: Database["public"]["Enums"]["ad_placement"]
          starts_at?: string
          title: string
          updated_at?: string
        }
        Update: {
          clicks_count?: number
          created_at?: string
          created_by?: string
          description?: string | null
          display_order?: number
          ends_at?: string | null
          id?: string
          image_url?: string
          impressions_count?: number
          is_active?: boolean
          link_url?: string
          placement?: Database["public"]["Enums"]["ad_placement"]
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassador_rewards: {
        Row: {
          ambassador_id: string
          created_at: string
          deal_id: string
          granted_at: string | null
          id: string
          investment_amount: number
          notes: string | null
          project_id: string
          referral_id: string
          reward_percentage: number
          reward_shares: number
          status: Database["public"]["Enums"]["reward_status"]
          updated_at: string
        }
        Insert: {
          ambassador_id: string
          created_at?: string
          deal_id: string
          granted_at?: string | null
          id?: string
          investment_amount: number
          notes?: string | null
          project_id: string
          referral_id: string
          reward_percentage: number
          reward_shares: number
          status?: Database["public"]["Enums"]["reward_status"]
          updated_at?: string
        }
        Update: {
          ambassador_id?: string
          created_at?: string
          deal_id?: string
          granted_at?: string | null
          id?: string
          investment_amount?: number
          notes?: string | null
          project_id?: string
          referral_id?: string
          reward_percentage?: number
          reward_shares?: number
          status?: Database["public"]["Enums"]["reward_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassador_rewards_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_rewards_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_rewards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_rewards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_rewards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassador_rewards_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      ambassadors: {
        Row: {
          admin_notes: string | null
          application_experience: string | null
          application_reason: string | null
          application_status: Database["public"]["Enums"]["ambassador_application_status"]
          applied_at: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          is_active: boolean
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          reward_percentage: number
          social_media_links: Json | null
          successful_referrals: number
          total_referrals: number
          total_rewards_earned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          application_experience?: string | null
          application_reason?: string | null
          application_status?: Database["public"]["Enums"]["ambassador_application_status"]
          applied_at?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          reward_percentage?: number
          social_media_links?: Json | null
          successful_referrals?: number
          total_referrals?: number
          total_rewards_earned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          application_experience?: string | null
          application_reason?: string | null
          application_status?: Database["public"]["Enums"]["ambassador_application_status"]
          applied_at?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          reward_percentage?: number
          social_media_links?: Json | null
          successful_referrals?: number
          total_referrals?: number
          total_rewards_earned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ambassadors_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassadors_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ambassadors_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_bids: {
        Row: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at: string | null
          id: string
          is_winning: boolean | null
          shares: number | null
        }
        Insert: {
          amount: number
          auction_id: string
          bidder_id: string
          created_at?: string | null
          id?: string
          is_winning?: boolean | null
          shares?: number | null
        }
        Update: {
          amount?: number
          auction_id?: string
          bidder_id?: string
          created_at?: string | null
          id?: string
          is_winning?: boolean | null
          shares?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "auction_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_bids_bidder_id_fkey"
            columns: ["bidder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          bid_count: number | null
          company_id: string | null
          created_at: string | null
          current_highest_bid: number | null
          ends_at: string
          id: string
          min_increment: number | null
          project_id: string
          shares_offered: number
          starting_price: number
          starts_at: string
          status: string | null
          title: string | null
          type: string | null
          winner_id: string | null
        }
        Insert: {
          bid_count?: number | null
          company_id?: string | null
          created_at?: string | null
          current_highest_bid?: number | null
          ends_at: string
          id?: string
          min_increment?: number | null
          project_id: string
          shares_offered: number
          starting_price: number
          starts_at: string
          status?: string | null
          title?: string | null
          type?: string | null
          winner_id?: string | null
        }
        Update: {
          bid_count?: number | null
          company_id?: string | null
          created_at?: string | null
          current_highest_bid?: number | null
          ends_at?: string
          id?: string
          min_increment?: number | null
          project_id?: string
          shares_offered?: number
          starting_price?: number
          starts_at?: string
          status?: string | null
          title?: string | null
          type?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auctions_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          created_at: string | null
          description: string | null
          id: string
          is_new: boolean | null
          is_trending: boolean | null
          is_verified: boolean | null
          joined_days_ago: number | null
          logo_url: string | null
          name: string
          owner_id: string | null
          projects_count: number | null
          rating: number | null
          risk_level: string | null
          sector: string
          share_price: number | null
          shareholders_count: number | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_new?: boolean | null
          is_trending?: boolean | null
          is_verified?: boolean | null
          joined_days_ago?: number | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          projects_count?: number | null
          rating?: number | null
          risk_level?: string | null
          sector: string
          share_price?: number | null
          shareholders_count?: number | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_new?: boolean | null
          is_trending?: boolean | null
          is_verified?: boolean | null
          joined_days_ago?: number | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          projects_count?: number | null
          rating?: number | null
          risk_level?: string | null
          sector?: string
          share_price?: number | null
          shareholders_count?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_holdings: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          project_id: string
          shares: number
          total_invested: number
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          project_id: string
          shares?: number
          total_invested?: number
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          project_id?: string
          shares?: number
          total_invested?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_holdings_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "partnership_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_holdings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_holdings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_holdings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_members: {
        Row: {
          contract_id: string
          created_at: string
          decline_reason: string | null
          declined_at: string | null
          id: string
          invite_status: Database["public"]["Enums"]["member_invite_status"]
          joined_at: string | null
          permission: Database["public"]["Enums"]["contract_member_permission"]
          share_percent: number
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          invite_status?: Database["public"]["Enums"]["member_invite_status"]
          joined_at?: string | null
          permission?: Database["public"]["Enums"]["contract_member_permission"]
          share_percent: number
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          decline_reason?: string | null
          declined_at?: string | null
          id?: string
          invite_status?: Database["public"]["Enums"]["member_invite_status"]
          joined_at?: string | null
          permission?: Database["public"]["Enums"]["contract_member_permission"]
          share_percent?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_members_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "partnership_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_transactions: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          id: string
          initiator_id: string
          notes: string | null
          project_id: string | null
          shares: number | null
          transaction_type: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          id?: string
          initiator_id: string
          notes?: string | null
          project_id?: string | null
          shares?: number | null
          transaction_type: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          id?: string
          initiator_id?: string
          notes?: string | null
          project_id?: string | null
          shares?: number | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "partnership_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_transactions_initiator_id_fkey"
            columns: ["initiator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          created_at: string | null
          creator_id: string
          end_fee_pct: number | null
          ended_at: string | null
          id: string
          members: Json | null
          name: string
          project_id: string | null
          status: string | null
          total_limit: number | null
          total_shares: number | null
          total_value: number | null
          type: string | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          end_fee_pct?: number | null
          ended_at?: string | null
          id?: string
          members?: Json | null
          name: string
          project_id?: string | null
          status?: string | null
          total_limit?: number | null
          total_shares?: number | null
          total_value?: number | null
          type?: string | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          end_fee_pct?: number | null
          ended_at?: string | null
          id?: string
          members?: Json | null
          name?: string
          project_id?: string | null
          status?: string | null
          total_limit?: number | null
          total_shares?: number | null
          total_value?: number | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      council_candidates: {
        Row: {
          campaign_statement: string | null
          election_id: string
          id: string
          is_eligible: boolean | null
          registered_at: string | null
          user_id: string
          votes_received: number | null
        }
        Insert: {
          campaign_statement?: string | null
          election_id: string
          id?: string
          is_eligible?: boolean | null
          registered_at?: string | null
          user_id: string
          votes_received?: number | null
        }
        Update: {
          campaign_statement?: string | null
          election_id?: string
          id?: string
          is_eligible?: boolean | null
          registered_at?: string | null
          user_id?: string
          votes_received?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "council_candidates_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "council_elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_candidates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      council_election_votes: {
        Row: {
          candidate_id: string
          created_at: string
          election_id: string
          id: string
          voter_id: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          election_id: string
          id?: string
          voter_id: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          election_id?: string
          id?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "council_election_votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "council_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_election_votes_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "council_elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_election_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      council_elections: {
        Row: {
          created_at: string | null
          id: string
          registration_ends: string | null
          registration_starts: string | null
          seats_available: number | null
          status: string | null
          title: string
          voting_ends: string | null
          voting_starts: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          registration_ends?: string | null
          registration_starts?: string | null
          seats_available?: number | null
          status?: string | null
          title: string
          voting_ends?: string | null
          voting_starts?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          registration_ends?: string | null
          registration_starts?: string | null
          seats_available?: number | null
          status?: string | null
          title?: string
          voting_ends?: string | null
          voting_starts?: string | null
        }
        Relationships: []
      }
      council_members: {
        Row: {
          bio: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          joined_at: string | null
          position_title: string | null
          role: string
          term_ends_at: string | null
          user_id: string
          votes_received: number | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          position_title?: string | null
          role: string
          term_ends_at?: string | null
          user_id: string
          votes_received?: number | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          position_title?: string | null
          role?: string
          term_ends_at?: string | null
          user_id?: string
          votes_received?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "council_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      council_proposal_votes: {
        Row: {
          choice: Database["public"]["Enums"]["council_vote_choice"]
          created_at: string
          id: string
          member_id: string
          proposal_id: string
          reason: string | null
        }
        Insert: {
          choice: Database["public"]["Enums"]["council_vote_choice"]
          created_at?: string
          id?: string
          member_id: string
          proposal_id: string
          reason?: string | null
        }
        Update: {
          choice?: Database["public"]["Enums"]["council_vote_choice"]
          created_at?: string
          id?: string
          member_id?: string
          proposal_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "council_proposal_votes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "council_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_proposal_votes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "council_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      council_proposals: {
        Row: {
          council_recommendation: string | null
          created_at: string | null
          description: string | null
          final_decision: string | null
          final_decision_at: string | null
          final_decision_by: string | null
          id: string
          related_project_id: string | null
          status: string | null
          submitted_by: string | null
          submitted_by_role: string | null
          title: string
          total_eligible_voters: number | null
          type: string
          votes_abstain: number | null
          votes_approve: number | null
          votes_object: number | null
          voting_ends_at: string | null
        }
        Insert: {
          council_recommendation?: string | null
          created_at?: string | null
          description?: string | null
          final_decision?: string | null
          final_decision_at?: string | null
          final_decision_by?: string | null
          id?: string
          related_project_id?: string | null
          status?: string | null
          submitted_by?: string | null
          submitted_by_role?: string | null
          title: string
          total_eligible_voters?: number | null
          type: string
          votes_abstain?: number | null
          votes_approve?: number | null
          votes_object?: number | null
          voting_ends_at?: string | null
        }
        Update: {
          council_recommendation?: string | null
          created_at?: string | null
          description?: string | null
          final_decision?: string | null
          final_decision_at?: string | null
          final_decision_by?: string | null
          id?: string
          related_project_id?: string | null
          status?: string | null
          submitted_by?: string | null
          submitted_by_role?: string | null
          title?: string
          total_eligible_voters?: number | null
          type?: string
          votes_abstain?: number | null
          votes_approve?: number | null
          votes_object?: number | null
          voting_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "council_proposals_final_decision_by_fkey"
            columns: ["final_decision_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_proposals_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_proposals_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_proposals_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_proposals_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      council_votes: {
        Row: {
          choice: string
          id: string
          member_id: string
          proposal_id: string
          reason: string | null
          voted_at: string | null
        }
        Insert: {
          choice: string
          id?: string
          member_id: string
          proposal_id: string
          reason?: string | null
          voted_at?: string | null
        }
        Update: {
          choice?: string
          id?: string
          member_id?: string
          proposal_id?: string
          reason?: string | null
          voted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "council_votes_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "council_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "council_votes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "council_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      deal_messages: {
        Row: {
          attachment_url: string | null
          content: string | null
          created_at: string
          deal_id: string
          id: string
          is_read: boolean
          message_type: Database["public"]["Enums"]["message_type"]
          read_at: string | null
          sender_id: string
        }
        Insert: {
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          deal_id: string
          id?: string
          is_read?: boolean
          message_type?: Database["public"]["Enums"]["message_type"]
          read_at?: string | null
          sender_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          is_read?: boolean
          message_type?: Database["public"]["Enums"]["message_type"]
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deal_messages_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deal_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          accepted_at: string | null
          buyer_commission: number | null
          buyer_id: string
          buyer_notes: string | null
          cancellation_reason: string | null
          completed_at: string | null
          created_at: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          expires_at: string
          fee_amount: number | null
          fee_percentage: number | null
          id: string
          listing_id: string | null
          payment_submitted_at: string | null
          price_per_share: number
          project_id: string
          quick_sale_listing_id: string | null
          seller_commission: number | null
          seller_id: string
          seller_notes: string | null
          shares: number
          source: string | null
          status: Database["public"]["Enums"]["deal_status"]
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          buyer_commission?: number | null
          buyer_id: string
          buyer_notes?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          created_at?: string
          deal_type: Database["public"]["Enums"]["deal_type"]
          expires_at?: string
          fee_amount?: number | null
          fee_percentage?: number | null
          id?: string
          listing_id?: string | null
          payment_submitted_at?: string | null
          price_per_share: number
          project_id: string
          quick_sale_listing_id?: string | null
          seller_commission?: number | null
          seller_id: string
          seller_notes?: string | null
          shares: number
          source?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          buyer_commission?: number | null
          buyer_id?: string
          buyer_notes?: string | null
          cancellation_reason?: string | null
          completed_at?: string | null
          created_at?: string
          deal_type?: Database["public"]["Enums"]["deal_type"]
          expires_at?: string
          fee_amount?: number | null
          fee_percentage?: number | null
          id?: string
          listing_id?: string | null
          payment_submitted_at?: string | null
          price_per_share?: number
          project_id?: string
          quick_sale_listing_id?: string | null
          seller_commission?: number | null
          seller_id?: string
          seller_notes?: string | null
          shares?: number
          source?: string | null
          status?: Database["public"]["Enums"]["deal_status"]
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deals_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_quick_sale_listing_id_fkey"
            columns: ["quick_sale_listing_id"]
            isOneToOne: false
            referencedRelation: "quick_sale_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      development_promises: {
        Row: {
          created_at: string | null
          deadline: string
          fulfilled_at: string | null
          id: string
          project_id: string
          promise_text: string
          promise_type: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          deadline: string
          fulfilled_at?: string | null
          id?: string
          project_id: string
          promise_text: string
          promise_type?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          deadline?: string
          fulfilled_at?: string | null
          id?: string
          project_id?: string
          promise_text?: string
          promise_type?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "development_promises_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_promises_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "development_promises_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_brands: {
        Row: {
          branches: string[]
          brand_logo_emoji: string
          brand_name: string
          category: Database["public"]["Enums"]["discount_category"]
          conditions: string[]
          cover_color: string
          created_at: string
          created_by: string
          description: string
          discount_percent: number
          ends_at: string
          id: string
          is_active: boolean
          max_uses: number
          required_level: string
          starts_at: string
          updated_at: string
          used_count: number
        }
        Insert: {
          branches?: string[]
          brand_logo_emoji?: string
          brand_name: string
          category: Database["public"]["Enums"]["discount_category"]
          conditions?: string[]
          cover_color?: string
          created_at?: string
          created_by: string
          description: string
          discount_percent: number
          ends_at: string
          id?: string
          is_active?: boolean
          max_uses: number
          required_level?: string
          starts_at: string
          updated_at?: string
          used_count?: number
        }
        Update: {
          branches?: string[]
          brand_logo_emoji?: string
          brand_name?: string
          category?: Database["public"]["Enums"]["discount_category"]
          conditions?: string[]
          cover_color?: string
          created_at?: string
          created_by?: string
          description?: string
          discount_percent?: number
          ends_at?: string
          id?: string
          is_active?: boolean
          max_uses?: number
          required_level?: string
          starts_at?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "discount_brands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          admin_notes: string | null
          created_at: string
          deal_id: string
          evidence_urls: string[] | null
          id: string
          opened_at: string
          opened_by: string
          reason: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["dispute_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          deal_id: string
          evidence_urls?: string[] | null
          id?: string
          opened_at?: string
          opened_by: string
          reason: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          deal_id?: string
          evidence_urls?: string[] | null
          id?: string
          opened_at?: string
          opened_by?: string
          reason?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["dispute_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      distributions: {
        Row: {
          amount: number
          created_at: string | null
          distributed_at: string | null
          holder_id: string
          id: string
          project_id: string
          type: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          distributed_at?: string | null
          holder_id: string
          id?: string
          project_id: string
          type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          distributed_at?: string | null
          holder_id?: string
          id?: string
          project_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distributions_holder_id_fkey"
            columns: ["holder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distributions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      election_votes: {
        Row: {
          candidate_id: string
          election_id: string
          id: string
          voted_at: string | null
          voter_id: string
        }
        Insert: {
          candidate_id: string
          election_id: string
          id?: string
          voted_at?: string | null
          voter_id: string
        }
        Update: {
          candidate_id?: string
          election_id?: string
          id?: string
          voted_at?: string | null
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "election_votes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "council_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_votes_election_id_fkey"
            columns: ["election_id"]
            isOneToOne: false
            referencedRelation: "council_elections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "election_votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          category: string
          created_at: string | null
          helpful_count: number | null
          id: string
          is_published: boolean | null
          order_index: number | null
          question: string
        }
        Insert: {
          answer: string
          category: string
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          is_published?: boolean | null
          order_index?: number | null
          question: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          is_published?: boolean | null
          order_index?: number | null
          question?: string
        }
        Relationships: []
      }
      fee_unit_balances: {
        Row: {
          balance: number
          created_at: string
          frozen_balance: number
          last_transaction_at: string | null
          reserved_balance: number
          total_bonus_received: number
          total_deposited: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          frozen_balance?: number
          last_transaction_at?: string | null
          reserved_balance?: number
          total_bonus_received?: number
          total_deposited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          frozen_balance?: number
          last_transaction_at?: string | null
          reserved_balance?: number
          total_bonus_received?: number
          total_deposited?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_unit_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_unit_requests: {
        Row: {
          admin_notes: string | null
          amount_approved: number | null
          amount_requested: number
          created_at: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          proof_image_url: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["fee_unit_request_status"]
          submitted_at: string
          transaction_reference: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount_approved?: number | null
          amount_requested: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          proof_image_url: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["fee_unit_request_status"]
          submitted_at?: string
          transaction_reference?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount_approved?: number | null
          amount_requested?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          proof_image_url?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["fee_unit_request_status"]
          submitted_at?: string
          transaction_reference?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_unit_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_unit_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_unit_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          executed_by: string | null
          id: string
          source_id: string | null
          source_type: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          executed_by?: string | null
          id?: string
          source_id?: string | null
          source_type?: string | null
          transaction_type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          executed_by?: string | null
          id?: string
          source_id?: string | null
          source_type?: string | null
          transaction_type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_unit_transactions_executed_by_fkey"
            columns: ["executed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_unit_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      following: {
        Row: {
          followed_at: string | null
          id: string
          item_id: string
          type: string
          user_id: string
        }
        Insert: {
          followed_at?: string | null
          id?: string
          item_id: string
          type: string
          user_id: string
        }
        Update: {
          followed_at?: string | null
          id?: string
          item_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "following_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: Database["public"]["Enums"]["follow_target_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: Database["public"]["Enums"]["follow_target_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["follow_target_type"]
          user_id?: string
        }
        Relationships: []
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: Database["public"]["Enums"]["friend_request_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          recipient_id: string
          responded_at?: string | null
          sender_id: string
          status?: Database["public"]["Enums"]["friend_request_status"]
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          recipient_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: Database["public"]["Enums"]["friend_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          user_id_a: string
          user_id_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id_a: string
          user_id_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id_a?: string
          user_id_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_id_a_fkey"
            columns: ["user_id_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user_id_b_fkey"
            columns: ["user_id_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fund_transactions: {
        Row: {
          amount: number
          approved_by: string | null
          created_at: string | null
          id: string
          price_per_share: number | null
          project_id: string | null
          reason: string | null
          shares_count: number | null
          type: string
        }
        Insert: {
          amount: number
          approved_by?: string | null
          created_at?: string | null
          id?: string
          price_per_share?: number | null
          project_id?: string | null
          reason?: string | null
          shares_count?: number | null
          type: string
        }
        Update: {
          amount?: number
          approved_by?: string | null
          created_at?: string | null
          id?: string
          price_per_share?: number | null
          project_id?: string | null
          reason?: string | null
          shares_count?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fund_transactions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fund_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      healthcare_applications: {
        Row: {
          admin_notes: string | null
          attachments: string[]
          created_at: string
          diagnosis: string
          disease_type: Database["public"]["Enums"]["disease_type"]
          doctor_name: string
          hospital: string
          id: string
          rejection_reason: string | null
          requested_amount: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["healthcare_application_status"]
          submitted_at: string
          total_cost: number
          updated_at: string
          user_available: number
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          attachments?: string[]
          created_at?: string
          diagnosis: string
          disease_type: Database["public"]["Enums"]["disease_type"]
          doctor_name: string
          hospital: string
          id?: string
          rejection_reason?: string | null
          requested_amount: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["healthcare_application_status"]
          submitted_at?: string
          total_cost: number
          updated_at?: string
          user_available?: number
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          attachments?: string[]
          created_at?: string
          diagnosis?: string
          disease_type?: Database["public"]["Enums"]["disease_type"]
          doctor_name?: string
          hospital?: string
          id?: string
          rejection_reason?: string | null
          requested_amount?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["healthcare_application_status"]
          submitted_at?: string
          total_cost?: number
          updated_at?: string
          user_available?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "healthcare_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      healthcare_cases: {
        Row: {
          amount_collected: number
          city: string
          completed_at: string | null
          created_at: string
          created_by: string
          diagnosis: string
          disease_type: Database["public"]["Enums"]["disease_type"]
          donors_count: number
          hospital: string
          id: string
          is_anonymous: boolean
          patient_age: number | null
          patient_display_name: string
          status: Database["public"]["Enums"]["healthcare_case_status"]
          story: string | null
          total_required: number
          treatment_plan: string | null
          updated_at: string
        }
        Insert: {
          amount_collected?: number
          city: string
          completed_at?: string | null
          created_at?: string
          created_by: string
          diagnosis: string
          disease_type: Database["public"]["Enums"]["disease_type"]
          donors_count?: number
          hospital: string
          id?: string
          is_anonymous?: boolean
          patient_age?: number | null
          patient_display_name: string
          status?: Database["public"]["Enums"]["healthcare_case_status"]
          story?: string | null
          total_required: number
          treatment_plan?: string | null
          updated_at?: string
        }
        Update: {
          amount_collected?: number
          city?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string
          diagnosis?: string
          disease_type?: Database["public"]["Enums"]["disease_type"]
          donors_count?: number
          hospital?: string
          id?: string
          is_anonymous?: boolean
          patient_age?: number | null
          patient_display_name?: string
          status?: Database["public"]["Enums"]["healthcare_case_status"]
          story?: string | null
          total_required?: number
          treatment_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "healthcare_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      healthcare_donations: {
        Row: {
          amount: number
          case_id: string | null
          created_at: string
          donor_id: string
          id: string
          is_anonymous: boolean
          is_recurring: boolean
          notes: string | null
        }
        Insert: {
          amount: number
          case_id?: string | null
          created_at?: string
          donor_id: string
          id?: string
          is_anonymous?: boolean
          is_recurring?: boolean
          notes?: string | null
        }
        Update: {
          amount?: number
          case_id?: string | null
          created_at?: string
          donor_id?: string
          id?: string
          is_anonymous?: boolean
          is_recurring?: boolean
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "healthcare_donations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "healthcare_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "healthcare_donations_donor_id_fkey"
            columns: ["donor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holdings: {
        Row: {
          acquired_from_ambassador: number
          acquired_from_offering: number
          acquired_from_secondary: number
          average_buy_price: number
          created_at: string
          first_acquired_at: string
          frozen_shares: number
          id: string
          last_acquired_at: string
          project_id: string
          shares: number
          total_invested: number
          updated_at: string
          user_id: string
        }
        Insert: {
          acquired_from_ambassador?: number
          acquired_from_offering?: number
          acquired_from_secondary?: number
          average_buy_price: number
          created_at?: string
          first_acquired_at?: string
          frozen_shares?: number
          id?: string
          last_acquired_at?: string
          project_id: string
          shares: number
          total_invested: number
          updated_at?: string
          user_id: string
        }
        Update: {
          acquired_from_ambassador?: number
          acquired_from_offering?: number
          acquired_from_secondary?: number
          average_buy_price?: number
          created_at?: string
          first_acquired_at?: string
          frozen_shares?: number
          id?: string
          last_acquired_at?: string
          project_id?: string
          shares?: number
          total_invested?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "holdings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "holdings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_subscriptions: {
        Row: {
          annual_limit: number
          cancelled_at: string | null
          created_at: string
          id: string
          monthly_fee: number
          next_billing: string
          plan: Database["public"]["Enums"]["insurance_plan"]
          started_at: string
          status: Database["public"]["Enums"]["insurance_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_limit: number
          cancelled_at?: string | null
          created_at?: string
          id?: string
          monthly_fee: number
          next_billing?: string
          plan: Database["public"]["Enums"]["insurance_plan"]
          started_at?: string
          status?: Database["public"]["Enums"]["insurance_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_limit?: number
          cancelled_at?: string | null
          created_at?: string
          id?: string
          monthly_fee?: number
          next_billing?: string
          plan?: Database["public"]["Enums"]["insurance_plan"]
          started_at?: string
          status?: Database["public"]["Enums"]["insurance_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insurance_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_submissions: {
        Row: {
          address: string
          city: string
          created_at: string
          date_of_birth: string
          document_back_url: string | null
          document_front_url: string
          document_number: string
          document_type: Database["public"]["Enums"]["id_document_type"]
          full_name: string
          id: string
          phone: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          selfie_url: string
          status: Database["public"]["Enums"]["kyc_status"]
          submitted_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          date_of_birth: string
          document_back_url?: string | null
          document_front_url: string
          document_number: string
          document_type: Database["public"]["Enums"]["id_document_type"]
          full_name: string
          id?: string
          phone: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url: string
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          date_of_birth?: string
          document_back_url?: string | null
          document_front_url?: string
          document_number?: string
          document_type?: Database["public"]["Enums"]["id_document_type"]
          full_name?: string
          id?: string
          phone?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          selfie_url?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          submitted_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kyc_submissions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kyc_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_pages: {
        Row: {
          content: string
          created_at: string
          id: string
          is_published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_pages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          buyer_id: string | null
          created_at: string
          expires_at: string | null
          frozen_fee_units: number
          id: string
          is_quick_sell: boolean
          notes: string | null
          price_per_share: number
          project_id: string
          seller_id: string
          shares_offered: number
          shares_sold: number
          sold_at: string | null
          status: Database["public"]["Enums"]["listing_status"]
          type: string
          updated_at: string
        }
        Insert: {
          buyer_id?: string | null
          created_at?: string
          expires_at?: string | null
          frozen_fee_units?: number
          id?: string
          is_quick_sell?: boolean
          notes?: string | null
          price_per_share: number
          project_id: string
          seller_id: string
          shares_offered: number
          shares_sold?: number
          sold_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          type?: string
          updated_at?: string
        }
        Update: {
          buyer_id?: string | null
          created_at?: string
          expires_at?: string | null
          frozen_fee_units?: number
          id?: string
          is_quick_sell?: boolean
          notes?: string | null
          price_per_share?: number
          project_id?: string
          seller_id?: string
          shares_offered?: number
          shares_sold?: number
          sold_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      market_state: {
        Row: {
          category_cap_pct: number | null
          created_at: string | null
          current_price: number
          freeze_reason: string | null
          frozen_until: string | null
          id: string
          initial_price: number
          is_frozen: boolean | null
          last_price_update: string | null
          market_phase: string | null
          monthly_cap_pct: number | null
          monthly_growth_pct: number | null
          project_id: string
          total_deals_count: number | null
          total_growth_pct: number | null
          updated_at: string | null
          yearly_cap_pct: number | null
          yearly_growth_pct: number | null
        }
        Insert: {
          category_cap_pct?: number | null
          created_at?: string | null
          current_price: number
          freeze_reason?: string | null
          frozen_until?: string | null
          id?: string
          initial_price: number
          is_frozen?: boolean | null
          last_price_update?: string | null
          market_phase?: string | null
          monthly_cap_pct?: number | null
          monthly_growth_pct?: number | null
          project_id: string
          total_deals_count?: number | null
          total_growth_pct?: number | null
          updated_at?: string | null
          yearly_cap_pct?: number | null
          yearly_growth_pct?: number | null
        }
        Update: {
          category_cap_pct?: number | null
          created_at?: string | null
          current_price?: number
          freeze_reason?: string | null
          frozen_until?: string | null
          id?: string
          initial_price?: number
          is_frozen?: boolean | null
          last_price_update?: string | null
          market_phase?: string | null
          monthly_cap_pct?: number | null
          monthly_growth_pct?: number | null
          project_id?: string
          total_deals_count?: number | null
          total_growth_pct?: number | null
          updated_at?: string | null
          yearly_cap_pct?: number | null
          yearly_growth_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "market_state_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_state_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_state_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          author_id: string
          content: string
          cover_image_url: string | null
          created_at: string
          gallery_images: string[] | null
          id: string
          is_pinned: boolean
          is_published: boolean
          news_type: Database["public"]["Enums"]["news_type"]
          published_at: string | null
          reactions_count: number
          related_project_id: string | null
          slug: string
          summary: string | null
          tags: string[] | null
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          author_id: string
          content: string
          cover_image_url?: string | null
          created_at?: string
          gallery_images?: string[] | null
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          news_type: Database["public"]["Enums"]["news_type"]
          published_at?: string | null
          reactions_count?: number
          related_project_id?: string | null
          slug: string
          summary?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          author_id?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string
          gallery_images?: string[] | null
          id?: string
          is_pinned?: boolean
          is_published?: boolean
          news_type?: Database["public"]["Enums"]["news_type"]
          published_at?: string | null
          reactions_count?: number
          related_project_id?: string | null
          slug?: string
          summary?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "news_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_related_project_id_fkey"
            columns: ["related_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      news_reactions: {
        Row: {
          created_at: string
          id: string
          news_id: string
          reaction_type: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          news_id: string
          reaction_type: Database["public"]["Enums"]["reaction_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          news_id?: string
          reaction_type?: Database["public"]["Enums"]["reaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_reactions_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          auctions_enabled: boolean
          council_enabled: boolean
          deals_enabled: boolean
          disputes_enabled: boolean
          email_enabled: boolean
          kyc_enabled: boolean
          level_enabled: boolean
          projects_enabled: boolean
          push_enabled: boolean
          quiet_hours_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          sound_enabled: boolean
          support_enabled: boolean
          system_enabled: boolean
          updated_at: string
          user_id: string
          vibration_enabled: boolean
        }
        Insert: {
          auctions_enabled?: boolean
          council_enabled?: boolean
          deals_enabled?: boolean
          disputes_enabled?: boolean
          email_enabled?: boolean
          kyc_enabled?: boolean
          level_enabled?: boolean
          projects_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          sound_enabled?: boolean
          support_enabled?: boolean
          system_enabled?: boolean
          updated_at?: string
          user_id: string
          vibration_enabled?: boolean
        }
        Update: {
          auctions_enabled?: boolean
          council_enabled?: boolean
          deals_enabled?: boolean
          disputes_enabled?: boolean
          email_enabled?: boolean
          kyc_enabled?: boolean
          level_enabled?: boolean
          projects_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          sound_enabled?: boolean
          support_enabled?: boolean
          system_enabled?: boolean
          updated_at?: string
          user_id?: string
          vibration_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          expires_at: string | null
          icon_name: string | null
          id: string
          is_internal_only: boolean
          is_read: boolean
          link_url: string | null
          locked_at: string | null
          locked_by: string | null
          message: string
          metadata: Json | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          priority: Database["public"]["Enums"]["notification_priority"]
          processed_at: string | null
          processed_by: string | null
          read_at: string | null
          sent_via_email: boolean
          sent_via_push: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          icon_name?: string | null
          id?: string
          is_internal_only?: boolean
          is_read?: boolean
          link_url?: string | null
          locked_at?: string | null
          locked_by?: string | null
          message: string
          metadata?: Json | null
          notification_type: Database["public"]["Enums"]["notification_type"]
          priority?: Database["public"]["Enums"]["notification_priority"]
          processed_at?: string | null
          processed_by?: string | null
          read_at?: string | null
          sent_via_email?: boolean
          sent_via_push?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          icon_name?: string | null
          id?: string
          is_internal_only?: boolean
          is_read?: boolean
          link_url?: string | null
          locked_at?: string | null
          locked_by?: string | null
          message?: string
          metadata?: Json | null
          notification_type?: Database["public"]["Enums"]["notification_type"]
          priority?: Database["public"]["Enums"]["notification_priority"]
          processed_at?: string | null
          processed_by?: string | null
          read_at?: string | null
          sent_via_email?: boolean
          sent_via_push?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orphan_children: {
        Row: {
          age: number
          blur_photo: boolean
          city: string
          created_at: string
          created_by: string
          education_level: Database["public"]["Enums"]["education_level"]
          first_name: string
          gender: Database["public"]["Enums"]["child_gender"]
          health_status: string
          id: string
          needs_amount_monthly: number
          photo_url: string | null
          sponsored_amount: number
          sponsors_count: number
          status: Database["public"]["Enums"]["child_sponsorship_status"]
          story: string | null
          updated_at: string
        }
        Insert: {
          age: number
          blur_photo?: boolean
          city: string
          created_at?: string
          created_by: string
          education_level: Database["public"]["Enums"]["education_level"]
          first_name: string
          gender: Database["public"]["Enums"]["child_gender"]
          health_status?: string
          id?: string
          needs_amount_monthly: number
          photo_url?: string | null
          sponsored_amount?: number
          sponsors_count?: number
          status?: Database["public"]["Enums"]["child_sponsorship_status"]
          story?: string | null
          updated_at?: string
        }
        Update: {
          age?: number
          blur_photo?: boolean
          city?: string
          created_at?: string
          created_by?: string
          education_level?: Database["public"]["Enums"]["education_level"]
          first_name?: string
          gender?: Database["public"]["Enums"]["child_gender"]
          health_status?: string
          id?: string
          needs_amount_monthly?: number
          photo_url?: string | null
          sponsored_amount?: number
          sponsors_count?: number
          status?: Database["public"]["Enums"]["child_sponsorship_status"]
          story?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orphan_children_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orphan_reports: {
        Row: {
          child_id: string
          created_at: string
          created_by: string
          education_progress: string | null
          health_status: string | null
          highlights: string | null
          id: string
          period: string
          photos_count: number
          sent_at: string
          sponsor_id: string
        }
        Insert: {
          child_id: string
          created_at?: string
          created_by: string
          education_progress?: string | null
          health_status?: string | null
          highlights?: string | null
          id?: string
          period: string
          photos_count?: number
          sent_at?: string
          sponsor_id: string
        }
        Update: {
          child_id?: string
          created_at?: string
          created_by?: string
          education_progress?: string | null
          health_status?: string | null
          highlights?: string | null
          id?: string
          period?: string
          photos_count?: number
          sent_at?: string
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orphan_reports_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "orphan_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orphan_reports_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orphan_reports_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_contracts: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          creator_id: string
          description: string | null
          end_fee_pct: number
          ended_at: string | null
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["contract_status"]
          title: string
          total_balance: number
          total_investment: number
          updated_at: string
          was_gift_redeemed: boolean
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          end_fee_pct?: number
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title: string
          total_balance?: number
          total_investment: number
          updated_at?: string
          was_gift_redeemed?: boolean
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          end_fee_pct?: number
          ended_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["contract_status"]
          title?: string
          total_balance?: number
          total_investment?: number
          updated_at?: string
          was_gift_redeemed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "partnership_contracts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_proofs: {
        Row: {
          amount_paid: number
          created_at: string
          deal_id: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          proof_image_url: string
          submitted_at: string
          transaction_reference: string | null
        }
        Insert: {
          amount_paid: number
          created_at?: string
          deal_id: string
          id?: string
          notes?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          proof_image_url: string
          submitted_at?: string
          transaction_reference?: string | null
        }
        Update: {
          amount_paid?: number
          created_at?: string
          deal_id?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          proof_image_url?: string
          submitted_at?: string
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_proofs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          change_pct: number
          created_at: string | null
          id: string
          market_phase: string
          new_price: number
          old_price: number
          project_id: string
          trigger_deal_id: string | null
          trigger_type: string
        }
        Insert: {
          change_pct: number
          created_at?: string | null
          id?: string
          market_phase: string
          new_price: number
          old_price: number
          project_id: string
          trigger_deal_id?: string | null
          trigger_type: string
        }
        Update: {
          change_pct?: number
          created_at?: string | null
          id?: string
          market_phase?: string
          new_price?: number
          old_price?: number
          project_id?: string
          trigger_deal_id?: string | null
          trigger_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          ban_reason: string | null
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          is_ambassador: boolean | null
          is_banned: boolean
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          last_seen_at: string | null
          phone: string | null
          rating_average: number | null
          rating_count: number | null
          referred_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          total_invested: number | null
          trades_completed: number | null
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          ban_reason?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_active?: boolean
          is_ambassador?: boolean | null
          is_banned?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          last_seen_at?: string | null
          phone?: string | null
          rating_average?: number | null
          rating_count?: number | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          total_invested?: number | null
          trades_completed?: number | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          ban_reason?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          is_ambassador?: boolean | null
          is_banned?: boolean
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          last_seen_at?: string | null
          phone?: string | null
          rating_average?: number | null
          rating_count?: number | null
          referred_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          total_invested?: number | null
          trades_completed?: number | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_updates: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          images: string[] | null
          progress_percentage: number | null
          project_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          images?: string[] | null
          progress_percentage?: number | null
          project_id: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          images?: string[] | null
          progress_percentage?: number | null
          project_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_updates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_wallets: {
        Row: {
          available_shares: number
          created_at: string
          id: string
          project_id: string
          reserved_shares: number
          sold_shares: number
          total_shares: number
          updated_at: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          available_shares: number
          created_at?: string
          id?: string
          project_id: string
          reserved_shares?: number
          sold_shares?: number
          total_shares: number
          updated_at?: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          available_shares?: number
          created_at?: string
          id?: string
          project_id?: string
          reserved_shares?: number
          sold_shares?: number
          total_shares?: number
          updated_at?: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: [
          {
            foreignKeyName: "project_wallets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_wallets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_wallets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          ambassador_percentage: number
          cover_image_url: string | null
          created_at: string
          created_by: string
          current_market_price: number | null
          description: string
          expected_completion_date: string | null
          gallery_images: string[] | null
          id: string
          location_address: string | null
          location_city: string | null
          location_coords: unknown
          name: string
          offering_end_date: string | null
          offering_percentage: number
          offering_start_date: string | null
          project_type: Database["public"]["Enums"]["project_type"]
          published_at: string | null
          reserve_percentage: number
          share_price: number
          short_description: string | null
          slug: string
          status: Database["public"]["Enums"]["project_status"]
          total_shares: number
          total_value: number | null
          updated_at: string
        }
        Insert: {
          ambassador_percentage?: number
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          current_market_price?: number | null
          description: string
          expected_completion_date?: string | null
          gallery_images?: string[] | null
          id?: string
          location_address?: string | null
          location_city?: string | null
          location_coords?: unknown
          name: string
          offering_end_date?: string | null
          offering_percentage?: number
          offering_start_date?: string | null
          project_type: Database["public"]["Enums"]["project_type"]
          published_at?: string | null
          reserve_percentage?: number
          share_price: number
          short_description?: string | null
          slug: string
          status?: Database["public"]["Enums"]["project_status"]
          total_shares: number
          total_value?: number | null
          updated_at?: string
        }
        Update: {
          ambassador_percentage?: number
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          current_market_price?: number | null
          description?: string
          expected_completion_date?: string | null
          gallery_images?: string[] | null
          id?: string
          location_address?: string | null
          location_city?: string | null
          location_coords?: unknown
          name?: string
          offering_end_date?: string | null
          offering_percentage?: number
          offering_start_date?: string | null
          project_type?: Database["public"]["Enums"]["project_type"]
          published_at?: string | null
          reserve_percentage?: number
          share_price?: number
          short_description?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["project_status"]
          total_shares?: number
          total_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string
          device_type: string | null
          endpoint: string
          id: string
          is_active: boolean
          last_used_at: string
          p256dh_key: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string
          device_type?: string | null
          endpoint: string
          id?: string
          is_active?: boolean
          last_used_at?: string
          p256dh_key: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string
          device_type?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean
          last_used_at?: string
          p256dh_key?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_sale_listings: {
        Row: {
          available_shares: number
          created_at: string | null
          discount_percent: number
          expires_at: string | null
          final_price: number
          id: string
          is_unlimited: boolean | null
          market_price: number
          note: string | null
          project_id: string | null
          status: string | null
          total_shares: number
          type: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          available_shares: number
          created_at?: string | null
          discount_percent: number
          expires_at?: string | null
          final_price: number
          id?: string
          is_unlimited?: boolean | null
          market_price: number
          note?: string | null
          project_id?: string | null
          status?: string | null
          total_shares: number
          type: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          available_shares?: number
          created_at?: string | null
          discount_percent?: number
          expires_at?: string | null
          final_price?: number
          id?: string
          is_unlimited?: boolean | null
          market_price?: number
          note?: string | null
          project_id?: string | null
          status?: string | null
          total_shares?: number
          type?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_sale_listings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_sale_listings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_sale_listings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quick_sale_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_sale_subscriptions: {
        Row: {
          cancelled_at: string | null
          expires_at: string | null
          fee_paid: number | null
          id: string
          is_active: boolean | null
          subscribed_at: string | null
          user_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          expires_at?: string | null
          fee_paid?: number | null
          id?: string
          is_active?: boolean | null
          subscribed_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          expires_at?: string | null
          fee_paid?: number | null
          id?: string
          is_active?: boolean | null
          subscribed_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quick_sale_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_sell_subscriptions: {
        Row: {
          amount_paid: number
          auto_renew: boolean
          cancelled_at: string | null
          created_at: string
          expires_at: string
          id: string
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          auto_renew?: boolean
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          auto_renew?: boolean
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_sell_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          deal_id: string
          id: string
          quick_tags: string[] | null
          rated_user_id: string
          rater_id: string
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          deal_id: string
          id?: string
          quick_tags?: string[] | null
          rated_user_id: string
          rater_id: string
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          deal_id?: string
          id?: string
          quick_tags?: string[] | null
          rated_user_id?: string
          rater_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rated_user_id_fkey"
            columns: ["rated_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_links: {
        Row: {
          ambassador_id: string
          campaign_name: string | null
          clicks_count: number
          code: string
          conversions_count: number
          created_at: string
          description: string | null
          expires_at: string
          id: string
          renewed_at: string | null
          revoked_at: string | null
          signups_count: number
          status: Database["public"]["Enums"]["referral_link_status"]
          updated_at: string
        }
        Insert: {
          ambassador_id: string
          campaign_name?: string | null
          clicks_count?: number
          code: string
          conversions_count?: number
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          renewed_at?: string | null
          revoked_at?: string | null
          signups_count?: number
          status?: Database["public"]["Enums"]["referral_link_status"]
          updated_at?: string
        }
        Update: {
          ambassador_id?: string
          campaign_name?: string | null
          clicks_count?: number
          code?: string
          conversions_count?: number
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          renewed_at?: string | null
          revoked_at?: string | null
          signups_count?: number
          status?: Database["public"]["Enums"]["referral_link_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_links_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          ambassador_id: string
          created_at: string
          first_investment_amount: number | null
          first_investment_at: string | null
          first_investment_deal_id: string | null
          has_invested: boolean
          id: string
          referral_link_id: string
          referred_user_id: string
          signup_ip: unknown
          signup_user_agent: string | null
          updated_at: string
        }
        Insert: {
          ambassador_id: string
          created_at?: string
          first_investment_amount?: number | null
          first_investment_at?: string | null
          first_investment_deal_id?: string | null
          has_invested?: boolean
          id?: string
          referral_link_id: string
          referred_user_id: string
          signup_ip?: unknown
          signup_user_agent?: string | null
          updated_at?: string
        }
        Update: {
          ambassador_id?: string
          created_at?: string
          first_investment_amount?: number | null
          first_investment_at?: string | null
          first_investment_deal_id?: string | null
          has_invested?: boolean
          id?: string
          referral_link_id?: string
          referred_user_id?: string
          signup_ip?: unknown
          signup_user_agent?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_ambassador_id_fkey"
            columns: ["ambassador_id"]
            isOneToOne: false
            referencedRelation: "ambassadors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_first_investment_deal_id_fkey"
            columns: ["first_investment_deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referral_link_id_fkey"
            columns: ["referral_link_id"]
            isOneToOne: false
            referencedRelation: "referral_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_user_id_fkey"
            columns: ["referred_user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      share_modification_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          generated_by: string
          id: string
          is_used: boolean
          project_id: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string
          generated_by: string
          id?: string
          is_used?: boolean
          project_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          generated_by?: string
          id?: string
          is_used?: boolean
          project_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_modification_codes_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_modification_codes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_modification_codes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_modification_codes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_modification_codes_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      share_modification_requests: {
        Row: {
          applied_at: string | null
          code_used: string | null
          created_at: string
          id: string
          modification_type: string
          project_id: string
          reason: string | null
          requested_by: string
          shares_amount: number
          status: string
          super_admin_at: string | null
          super_admin_id: string | null
          super_admin_note: string | null
        }
        Insert: {
          applied_at?: string | null
          code_used?: string | null
          created_at?: string
          id?: string
          modification_type: string
          project_id: string
          reason?: string | null
          requested_by: string
          shares_amount: number
          status?: string
          super_admin_at?: string | null
          super_admin_id?: string | null
          super_admin_note?: string | null
        }
        Update: {
          applied_at?: string | null
          code_used?: string | null
          created_at?: string
          id?: string
          modification_type?: string
          project_id?: string
          reason?: string | null
          requested_by?: string
          shares_amount?: number
          status?: string
          super_admin_at?: string | null
          super_admin_id?: string | null
          super_admin_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_modification_requests_code_used_fkey"
            columns: ["code_used"]
            isOneToOne: false
            referencedRelation: "share_modification_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_modification_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_modification_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_modification_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_modification_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_modification_requests_super_admin_id_fkey"
            columns: ["super_admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      share_transfers: {
        Row: {
          applied_at: string | null
          cancelled_at: string | null
          created_at: string
          expires_at: string
          fee_amount: number
          id: string
          message: string | null
          project_id: string
          recipient_id: string
          rejection_reason: string | null
          responded_at: string | null
          sender_id: string
          shares: number
          status: Database["public"]["Enums"]["share_transfer_status"]
          transfer_fee_pct: number
        }
        Insert: {
          applied_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          fee_amount?: number
          id?: string
          message?: string | null
          project_id: string
          recipient_id: string
          rejection_reason?: string | null
          responded_at?: string | null
          sender_id: string
          shares: number
          status?: Database["public"]["Enums"]["share_transfer_status"]
          transfer_fee_pct?: number
        }
        Update: {
          applied_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string
          fee_amount?: number
          id?: string
          message?: string | null
          project_id?: string
          recipient_id?: string
          rejection_reason?: string | null
          responded_at?: string | null
          sender_id?: string
          shares?: number
          status?: Database["public"]["Enums"]["share_transfer_status"]
          transfer_fee_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "share_transfers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_transfers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_transfers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_transfers_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_transfers_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsorships: {
        Row: {
          amount: number
          cancellation_reason: string | null
          cancelled_at: string | null
          child_id: string
          created_at: string
          duration_months: number
          ends_at: string | null
          id: string
          is_anonymous: boolean
          receive_reports: boolean
          sponsor_id: string
          started_at: string
          status: Database["public"]["Enums"]["sponsorship_status"]
          type: Database["public"]["Enums"]["sponsorship_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          child_id: string
          created_at?: string
          duration_months: number
          ends_at?: string | null
          id?: string
          is_anonymous?: boolean
          receive_reports?: boolean
          sponsor_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["sponsorship_status"]
          type: Database["public"]["Enums"]["sponsorship_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          cancellation_reason?: string | null
          cancelled_at?: string | null
          child_id?: string
          created_at?: string
          duration_months?: number
          ends_at?: string | null
          id?: string
          is_anonymous?: boolean
          receive_reports?: boolean
          sponsor_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["sponsorship_status"]
          type?: Database["public"]["Enums"]["sponsorship_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsorships_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "orphan_children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sponsorships_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stability_fund: {
        Row: {
          available_balance: number | null
          id: string
          last_updated: string | null
          reserved_balance: number | null
          total_balance: number | null
          total_inflow: number | null
          total_interventions: number | null
          total_profit: number | null
        }
        Insert: {
          available_balance?: number | null
          id?: string
          last_updated?: string | null
          reserved_balance?: number | null
          total_balance?: number | null
          total_inflow?: number | null
          total_interventions?: number | null
          total_profit?: number | null
        }
        Update: {
          available_balance?: number | null
          id?: string
          last_updated?: string | null
          reserved_balance?: number | null
          total_balance?: number | null
          total_inflow?: number | null
          total_interventions?: number | null
          total_profit?: number | null
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          admin_reply: string | null
          assigned_to: string | null
          body: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          closed_at: string | null
          closed_reason: string | null
          created_at: string | null
          id: string
          last_message_at: string
          priority: string | null
          replied_at: string | null
          status: string | null
          subject: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          admin_reply?: string | null
          assigned_to?: string | null
          body?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string
          priority?: string | null
          replied_at?: string | null
          status?: string | null
          subject: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          admin_reply?: string | null
          assigned_to?: string | null
          body?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string | null
          id?: string
          last_message_at?: string
          priority?: string | null
          replied_at?: string | null
          status?: string | null
          subject?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          attachments: Json | null
          body: string
          created_at: string
          id: string
          sender_id: string
          sender_type: Database["public"]["Enums"]["ticket_sender_type"]
          ticket_id: string
        }
        Insert: {
          attachments?: Json | null
          body: string
          created_at?: string
          id?: string
          sender_id: string
          sender_type: Database["public"]["Enums"]["ticket_sender_type"]
          ticket_id: string
        }
        Update: {
          attachments?: Json | null
          body?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_type?: Database["public"]["Enums"]["ticket_sender_type"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      trades: {
        Row: {
          buyer_id: string
          commission_amount: number | null
          commission_pct: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          listing_id: string | null
          price_per_share: number
          project_id: string
          seller_id: string
          shares: number
          status: string | null
          total_price: number
        }
        Insert: {
          buyer_id: string
          commission_amount?: number | null
          commission_pct?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          price_per_share: number
          project_id: string
          seller_id: string
          shares: number
          status?: string | null
          total_price: number
        }
        Update: {
          buyer_id?: string
          commission_amount?: number | null
          commission_pct?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          listing_id?: string | null
          price_per_share?: number
          project_id?: string
          seller_id?: string
          shares?: number
          status?: string | null
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "trades_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "admin_market_overview"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "project_market_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_coupons: {
        Row: {
          barcode: string
          claimed_at: string
          code: string
          discount_id: string
          expires_at: string
          id: string
          status: Database["public"]["Enums"]["coupon_status"]
          used_at: string | null
          user_id: string
        }
        Insert: {
          barcode: string
          claimed_at?: string
          code: string
          discount_id: string
          expires_at: string
          id?: string
          status?: Database["public"]["Enums"]["coupon_status"]
          used_at?: string | null
          user_id: string
        }
        Update: {
          barcode?: string
          claimed_at?: string
          code?: string
          discount_id?: string
          expires_at?: string
          id?: string
          status?: Database["public"]["Enums"]["coupon_status"]
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_coupons_discount_id_fkey"
            columns: ["discount_id"]
            isOneToOne: false
            referencedRelation: "discount_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_coupons_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_gifts: {
        Row: {
          created_at: string
          expires_at: string | null
          gift_type: string
          gift_value: Json | null
          granted_by: string | null
          granted_reason: string | null
          id: string
          is_used: boolean
          used_at: string | null
          used_target_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          gift_type: string
          gift_value?: Json | null
          granted_by?: string | null
          granted_reason?: string | null
          id?: string
          is_used?: boolean
          used_at?: string | null
          used_target_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          gift_type?: string
          gift_value?: Json | null
          granted_by?: string | null
          granted_reason?: string | null
          id?: string
          is_used?: boolean
          used_at?: string | null
          used_target_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_gifts_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_gifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          email_notifications: boolean | null
          language: string
          notify_ambassador_rewards: boolean | null
          notify_deal_update: boolean | null
          notify_market_alerts: boolean | null
          notify_new_deal: boolean | null
          notify_news: boolean | null
          push_notifications: boolean | null
          show_stats_publicly: boolean | null
          sms_notifications: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          email_notifications?: boolean | null
          language?: string
          notify_ambassador_rewards?: boolean | null
          notify_deal_update?: boolean | null
          notify_market_alerts?: boolean | null
          notify_new_deal?: boolean | null
          notify_news?: boolean | null
          push_notifications?: boolean | null
          show_stats_publicly?: boolean | null
          sms_notifications?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          email_notifications?: boolean | null
          language?: string
          notify_ambassador_rewards?: boolean | null
          notify_deal_update?: boolean | null
          notify_market_alerts?: boolean | null
          notify_new_deal?: boolean | null
          notify_news?: boolean | null
          push_notifications?: boolean | null
          show_stats_publicly?: boolean | null
          sms_notifications?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profile_extras: {
        Row: {
          agreed_privacy_at: string | null
          agreed_terms_at: string | null
          birth_date: string | null
          city: string | null
          confirmed_accuracy_at: string | null
          created_at: string
          experience: string | null
          gender: string | null
          goals: string[]
          income_source: string | null
          income_tier: string | null
          preferred_sectors: string[]
          profession: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agreed_privacy_at?: string | null
          agreed_terms_at?: string | null
          birth_date?: string | null
          city?: string | null
          confirmed_accuracy_at?: string | null
          created_at?: string
          experience?: string | null
          gender?: string | null
          goals?: string[]
          income_source?: string | null
          income_tier?: string | null
          preferred_sectors?: string[]
          profession?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agreed_privacy_at?: string | null
          agreed_terms_at?: string | null
          birth_date?: string | null
          city?: string | null
          confirmed_accuracy_at?: string | null
          created_at?: string
          experience?: string | null
          gender?: string | null
          goals?: string[]
          income_source?: string | null
          income_tier?: string | null
          preferred_sectors?: string[]
          profession?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_extras_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_market_overview: {
        Row: {
          current_price: number | null
          id: string | null
          initial_price: number | null
          is_frozen: boolean | null
          market_phase: string | null
          monthly_growth_pct: number | null
          name: string | null
          pending_promises: number | null
          project_type: Database["public"]["Enums"]["project_type"] | null
          status: Database["public"]["Enums"]["project_status"] | null
          total_deals_count: number | null
          total_growth_pct: number | null
        }
        Relationships: []
      }
      portfolio_summary: {
        Row: {
          holdings_count: number | null
          total_invested: number | null
          total_shares: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holdings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_market_view: {
        Row: {
          current_market_price: number | null
          engine_current_price: number | null
          id: string | null
          is_frozen: boolean | null
          market_phase: string | null
          name: string | null
          project_type: Database["public"]["Enums"]["project_type"] | null
          share_price: number | null
          status: Database["public"]["Enums"]["project_status"] | null
          total_growth_pct: number | null
          total_shares: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_buy_listing: {
        Args: {
          p_duration_hours?: number
          p_listing_id: string
          p_quantity: number
        }
        Returns: Json
      }
      admin_add_council_member: {
        Args: {
          p_bio?: string
          p_position_title: string
          p_role: Database["public"]["Enums"]["council_member_role"]
          p_term_ends_at?: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_announce_election: {
        Args: {
          p_registration_ends: string
          p_registration_starts: string
          p_seats_available: number
          p_title: string
          p_voting_ends: string
          p_voting_starts: string
        }
        Returns: Json
      }
      admin_approve_fee_request: {
        Args: {
          p_admin_notes?: string
          p_amount_approved?: number
          p_request_id: string
        }
        Returns: Json
      }
      admin_approve_share_modification: {
        Args: { p_request_id: string }
        Returns: Json
      }
      admin_assign_ticket: {
        Args: { p_assignee_id: string; p_ticket_id: string }
        Returns: Json
      }
      admin_broadcast_notification: {
        Args: {
          p_audience?: string
          p_audience_param?: string
          p_link_url?: string
          p_message: string
          p_metadata?: Json
          p_priority?: string
          p_title: string
        }
        Returns: Json
      }
      admin_cancel_auction: {
        Args: { p_auction_id: string; p_reason?: string }
        Returns: Json
      }
      admin_cancel_contract: {
        Args: { p_contract_id: string; p_reason: string }
        Returns: Json
      }
      admin_create_auction: {
        Args: {
          p_ends_at: string
          p_min_increment: number
          p_project_id: string
          p_shares_offered: number
          p_starting_price: number
          p_starts_at: string
          p_title: string
          p_type?: string
        }
        Returns: Json
      }
      admin_create_company: {
        Args: {
          p_city?: string
          p_description?: string
          p_founded_year?: number
          p_logo_url?: string
          p_name: string
          p_risk_level?: string
          p_sector: string
          p_share_price?: number
        }
        Returns: Json
      }
      admin_create_discount: {
        Args: {
          p_branches?: string[]
          p_brand_logo_emoji: string
          p_brand_name: string
          p_category: Database["public"]["Enums"]["discount_category"]
          p_conditions?: string[]
          p_cover_color?: string
          p_description: string
          p_discount_percent: number
          p_ends_at: string
          p_max_uses: number
          p_required_level?: string
          p_starts_at: string
        }
        Returns: Json
      }
      admin_create_healthcare_case: {
        Args: {
          p_city: string
          p_diagnosis: string
          p_disease_type: Database["public"]["Enums"]["disease_type"]
          p_hospital: string
          p_is_anonymous?: boolean
          p_is_urgent?: boolean
          p_patient_age: number
          p_patient_display_name: string
          p_story?: string
          p_total_required: number
          p_treatment_plan?: string
        }
        Returns: Json
      }
      admin_create_orphan_child: {
        Args: {
          p_age: number
          p_blur_photo?: boolean
          p_city: string
          p_education_level: Database["public"]["Enums"]["education_level"]
          p_first_name: string
          p_gender: Database["public"]["Enums"]["child_gender"]
          p_health_status?: string
          p_needs_amount_monthly: number
          p_story?: string
        }
        Returns: Json
      }
      admin_delete_company: { Args: { p_company_id: string }; Returns: Json }
      admin_end_auction_early: { Args: { p_auction_id: string }; Returns: Json }
      admin_finalize_proposal: {
        Args: { p_decision: string; p_notes?: string; p_proposal_id: string }
        Returns: Json
      }
      admin_force_end_contract: {
        Args: { p_contract_id: string; p_reason?: string }
        Returns: Json
      }
      admin_freeze_project_wallet: {
        Args: { p_wallet_id: string }
        Returns: Json
      }
      admin_generate_share_code: {
        Args: { p_project_id: string }
        Returns: Json
      }
      admin_grant_gift: {
        Args: {
          p_expires_at?: string
          p_gift_type: string
          p_gift_value?: Json
          p_reason?: string
          p_user_id: string
        }
        Returns: Json
      }
      admin_lock_notification: {
        Args: { p_notification_id: string }
        Returns: Json
      }
      admin_mark_case_completed: { Args: { p_case_id: string }; Returns: Json }
      admin_process_notification: {
        Args: { p_notification_id: string }
        Returns: Json
      }
      admin_reject_fee_request: {
        Args: { p_reason: string; p_request_id: string }
        Returns: Json
      }
      admin_reject_share_modification: {
        Args: { p_note?: string; p_request_id: string }
        Returns: Json
      }
      admin_remove_council_member: {
        Args: { p_member_id: string; p_reason?: string }
        Returns: Json
      }
      admin_remove_orphan_child: { Args: { p_child_id: string }; Returns: Json }
      admin_resolve_contract_internally: {
        Args: { p_contract_id: string; p_notes?: string; p_percents: Json }
        Returns: Json
      }
      admin_review_healthcare_application: {
        Args: { p_application_id: string; p_approve: boolean; p_notes?: string }
        Returns: Json
      }
      admin_revoke_gift: { Args: { p_gift_id: string }; Returns: Json }
      admin_send_orphan_report: {
        Args: {
          p_child_id: string
          p_education_progress?: string
          p_health_status?: string
          p_highlights?: string
          p_period: string
          p_photos_count?: number
        }
        Returns: Json
      }
      admin_set_discount_active: {
        Args: { p_discount_id: string; p_is_active: boolean }
        Returns: Json
      }
      admin_set_ticket_status: {
        Args: {
          p_status: Database["public"]["Enums"]["ticket_status"]
          p_ticket_id: string
        }
        Returns: Json
      }
      admin_set_user_role: {
        Args: { p_role: string; p_user_id: string }
        Returns: Json
      }
      admin_submit_share_modification: {
        Args: {
          p_code: string
          p_project_id: string
          p_reason?: string
          p_shares: number
          p_type: string
        }
        Returns: Json
      }
      admin_unfreeze_project_wallet: {
        Args: { p_wallet_id: string }
        Returns: Json
      }
      admin_unlock_notification: {
        Args: { p_notification_id: string }
        Returns: Json
      }
      admin_update_case_progress: {
        Args: { p_case_id: string; p_new_amount_collected: number }
        Returns: Json
      }
      admin_update_company: {
        Args: {
          p_city?: string
          p_company_id: string
          p_description?: string
          p_founded_year?: number
          p_is_trending?: boolean
          p_is_verified?: boolean
          p_logo_url?: string
          p_name?: string
          p_risk_level?: string
          p_sector?: string
          p_share_price?: number
        }
        Returns: Json
      }
      admin_update_council_member: {
        Args: { p_bio?: string; p_member_id: string; p_position_title?: string }
        Returns: Json
      }
      admin_update_discount: {
        Args: {
          p_branches?: string[]
          p_brand_logo_emoji?: string
          p_brand_name?: string
          p_category?: Database["public"]["Enums"]["discount_category"]
          p_conditions?: string[]
          p_cover_color?: string
          p_description?: string
          p_discount_id: string
          p_discount_percent?: number
          p_ends_at?: string
          p_max_uses?: number
          p_required_level?: string
          p_starts_at?: string
        }
        Returns: Json
      }
      admin_update_orphan_child: {
        Args: {
          p_age?: number
          p_blur_photo?: boolean
          p_child_id: string
          p_city?: string
          p_education_level?: Database["public"]["Enums"]["education_level"]
          p_first_name?: string
          p_gender?: Database["public"]["Enums"]["child_gender"]
          p_health_status?: string
          p_needs_amount_monthly?: number
          p_story?: string
        }
        Returns: Json
      }
      admin_upsert_legal_page: {
        Args: {
          p_content: string
          p_publish?: boolean
          p_slug: string
          p_title: string
        }
        Returns: Json
      }
      cancel_friend_request: { Args: { p_request_id: string }; Returns: Json }
      cancel_listing: { Args: { p_listing_id: string }; Returns: Json }
      cancel_share_transfer: { Args: { p_transfer_id: string }; Returns: Json }
      cast_election_vote: {
        Args: { p_candidate_id: string; p_election_id: string }
        Returns: Json
      }
      cast_proposal_vote: {
        Args: {
          p_choice: Database["public"]["Enums"]["council_vote_choice"]
          p_proposal_id: string
          p_reason?: string
        }
        Returns: Json
      }
      claim_discount: { Args: { p_discount_id: string }; Returns: Json }
      cleanup_expired_share_codes: { Args: never; Returns: Json }
      clear_stale_notification_locks: { Args: never; Returns: Json }
      close_support_ticket: {
        Args: { p_reason?: string; p_ticket_id: string }
        Returns: Json
      }
      create_listing:
        | {
            Args: {
              p_is_quick_sell?: boolean
              p_notes?: string
              p_price_per_share: number
              p_project_id: string
              p_shares_offered: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_is_quick_sell?: boolean
              p_notes?: string
              p_price_per_share: number
              p_project_id: string
              p_shares_offered: number
              p_type?: string
            }
            Returns: Json
          }
      create_support_ticket: {
        Args: {
          p_body: string
          p_category?: Database["public"]["Enums"]["ticket_category"]
          p_priority?: Database["public"]["Enums"]["ticket_priority"]
          p_subject: string
        }
        Returns: Json
      }
      create_user_notification: {
        Args: {
          p_link_url?: string
          p_message: string
          p_metadata?: Json
          p_priority?: Database["public"]["Enums"]["notification_priority"]
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
        }
        Returns: string
      }
      end_partnership_contract: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      expire_stale_share_transfers: { Args: never; Returns: Json }
      follow_target: {
        Args: { p_target_id: string; p_target_type: string }
        Returns: Json
      }
      generate_barcode: { Args: never; Returns: string }
      generate_coupon_code: { Args: { p_brand_name: string }; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      get_ambassador_by_code: { Args: { p_code: string }; Returns: Json }
      get_dashboard_stats: { Args: never; Returns: Json }
      get_my_portfolio_analytics: { Args: never; Returns: Json }
      get_my_portfolio_history: { Args: { p_months?: number }; Returns: Json }
      get_unread_count: { Args: { p_user_id?: string }; Returns: number }
      get_user_contracts: {
        Args: never
        Returns: {
          contract_id: string
          contract_title: string
          is_creator: boolean
          permission: string
          status: Database["public"]["Enums"]["contract_status"]
          total_balance: number
        }[]
      }
      increment_news_views: { Args: { p_news_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      link_referral_by_code: { Args: { p_code: string }; Returns: Json }
      log_admin_action:
        | {
            Args: {
              p_action: string
              p_entity_id: string
              p_entity_type: string
              p_metadata?: Json
            }
            Returns: string
          }
        | {
            Args: {
              p_action: string
              p_entity_id: string
              p_entity_type: string
              p_ip_address?: string
              p_metadata?: Json
              p_user_agent?: string
            }
            Returns: string
          }
      mark_all_notifications_read: {
        Args: { p_user_id?: string }
        Returns: undefined
      }
      place_bid: {
        Args: { p_amount: number; p_auction_id: string; p_shares: number }
        Returns: Json
      }
      place_deal_from_listing: {
        Args: {
          p_duration_hours?: number
          p_listing_id: string
          p_quantity: number
        }
        Returns: Json
      }
      redeem_free_contract_gift: {
        Args: { p_contract_id: string }
        Returns: Json
      }
      register_as_candidate: {
        Args: { p_campaign_statement: string; p_election_id: string }
        Returns: Json
      }
      reply_to_ticket: {
        Args: { p_body: string; p_ticket_id: string }
        Returns: Json
      }
      respond_to_friend_request: {
        Args: { p_accept: boolean; p_request_id: string }
        Returns: Json
      }
      respond_to_share_transfer: {
        Args: { p_accept: boolean; p_reason?: string; p_transfer_id: string }
        Returns: Json
      }
      send_friend_request: {
        Args: { p_message?: string; p_recipient_id: string }
        Returns: Json
      }
      set_council_recommendation: {
        Args: {
          p_proposal_id: string
          p_recommendation: Database["public"]["Enums"]["council_recommendation"]
        }
        Returns: Json
      }
      submit_proposal: {
        Args: {
          p_description: string
          p_related_project_id?: string
          p_title: string
          p_type: Database["public"]["Enums"]["council_proposal_type"]
          p_voting_ends_at: string
        }
        Returns: Json
      }
      submit_share_transfer: {
        Args: {
          p_message?: string
          p_project_id: string
          p_recipient_id: string
          p_shares: number
        }
        Returns: Json
      }
      subscribe_to_quick_sale: { Args: { p_user_id: string }; Returns: Json }
      unfollow_target: {
        Args: { p_target_id: string; p_target_type: string }
        Returns: Json
      }
      unfriend: { Args: { p_other_user_id: string }; Returns: Json }
      update_member_permission: {
        Args: {
          p_member_id: string
          p_permission: Database["public"]["Enums"]["contract_member_permission"]
        }
        Returns: Json
      }
    }
    Enums: {
      ad_placement:
        | "home_top"
        | "home_middle"
        | "market_banner"
        | "deals_banner"
        | "profile_banner"
      ambassador_application_status:
        | "pending"
        | "approved"
        | "rejected"
        | "revoked"
      auction_status: "upcoming" | "active" | "ended" | "cancelled"
      auction_type: "english" | "dutch"
      child_gender: "male" | "female"
      child_sponsorship_status: "needs_sponsor" | "partial" | "fully_sponsored"
      contract_member_permission: "view_only" | "buy_only" | "buy_and_sell"
      contract_status: "pending" | "active" | "ended" | "cancelled"
      council_election_status: "registration" | "voting" | "ended"
      council_member_role: "founder" | "appointed" | "elected"
      council_proposal_status:
        | "pending"
        | "voting"
        | "approved"
        | "rejected"
        | "executed"
      council_proposal_type:
        | "new_project"
        | "shares_release"
        | "investigation"
        | "policy"
      council_recommendation: "approve" | "object" | "neutral"
      council_vote_choice: "approve" | "object" | "abstain"
      coupon_status: "active" | "used" | "expired"
      deal_status:
        | "pending_seller_approval"
        | "rejected"
        | "accepted"
        | "payment_submitted"
        | "completed"
        | "cancelled"
        | "disputed"
        | "expired"
      deal_type: "primary" | "secondary" | "quick_sell"
      discount_category:
        | "restaurants"
        | "clothing"
        | "electronics"
        | "services"
        | "travel"
        | "groceries"
      disease_type:
        | "cancer"
        | "heart"
        | "kidney"
        | "neurological"
        | "pediatric"
        | "transplant"
        | "other"
      dispute_status:
        | "open"
        | "under_review"
        | "resolved_buyer"
        | "resolved_seller"
        | "closed"
      education_level:
        | "kindergarten"
        | "primary"
        | "intermediate"
        | "secondary"
        | "university"
      fee_unit_request_status: "pending" | "approved" | "rejected" | "cancelled"
      follow_target_type: "project" | "company"
      friend_request_status: "pending" | "accepted" | "declined" | "cancelled"
      healthcare_application_status:
        | "pending"
        | "approved"
        | "rejected"
        | "cancelled"
      healthcare_case_status: "urgent" | "active" | "completed" | "cancelled"
      id_document_type: "national_id" | "passport" | "driver_license"
      insurance_plan: "basic" | "advanced" | "comprehensive"
      insurance_status: "active" | "paused" | "cancelled"
      kyc_status: "not_submitted" | "pending" | "approved" | "rejected"
      listing_status: "active" | "sold" | "cancelled" | "frozen"
      member_invite_status: "pending" | "accepted" | "declined"
      message_type: "text" | "image" | "payment_proof" | "system"
      news_type:
        | "announcement"
        | "market_update"
        | "project_news"
        | "platform_update"
        | "educational"
      notification_priority: "low" | "normal" | "high" | "urgent"
      notification_type:
        | "kyc_approved"
        | "kyc_rejected"
        | "deal_request_received"
        | "deal_accepted"
        | "deal_rejected"
        | "payment_submitted"
        | "deal_completed"
        | "deal_cancelled"
        | "deal_disputed"
        | "new_project"
        | "project_update"
        | "new_listing_match"
        | "ambassador_approved"
        | "ambassador_reward_earned"
        | "fee_request_approved"
        | "fee_request_rejected"
        | "low_balance_warning"
        | "subscription_expiring"
        | "subscription_expired"
        | "system_announcement"
        | "news_published"
        | "deal_expired"
        | "level_upgraded"
        | "dispute_resolved"
        | "payment_received"
        | "reminder"
        | "friend_request_received"
        | "friend_request_accepted"
        | "council_proposal_new"
        | "council_proposal_decided"
        | "support_ticket_replied"
      payment_method: "zain_cash" | "master_card" | "bank_transfer" | "other"
      project_status:
        | "draft"
        | "coming_soon"
        | "active"
        | "sold_out"
        | "completed"
        | "cancelled"
      project_type:
        | "real_estate"
        | "agriculture"
        | "industrial"
        | "commercial"
        | "tech"
        | "other"
      reaction_type: "like" | "love" | "celebrate" | "applause" | "fire"
      referral_link_status: "active" | "expired" | "revoked"
      reward_status: "pending" | "granted" | "cancelled"
      share_transfer_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "cancelled"
        | "expired"
      sponsorship_status: "active" | "ended" | "cancelled"
      sponsorship_type: "monthly" | "annual" | "onetime"
      subscription_status: "active" | "expired" | "cancelled"
      ticket_category:
        | "technical"
        | "billing"
        | "kyc"
        | "complaint"
        | "feature_request"
        | "other"
      ticket_priority: "low" | "medium" | "high"
      ticket_sender_type: "user" | "admin"
      ticket_status: "new" | "in_progress" | "replied" | "closed"
      transaction_type:
        | "deposit"
        | "withdrawal"
        | "subscription"
        | "bonus"
        | "refund"
        | "adjustment"
      user_role: "user" | "ambassador" | "admin" | "super_admin"
      wallet_type: "offering" | "ambassador" | "reserve"
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
      ad_placement: [
        "home_top",
        "home_middle",
        "market_banner",
        "deals_banner",
        "profile_banner",
      ],
      ambassador_application_status: [
        "pending",
        "approved",
        "rejected",
        "revoked",
      ],
      auction_status: ["upcoming", "active", "ended", "cancelled"],
      auction_type: ["english", "dutch"],
      child_gender: ["male", "female"],
      child_sponsorship_status: ["needs_sponsor", "partial", "fully_sponsored"],
      contract_member_permission: ["view_only", "buy_only", "buy_and_sell"],
      contract_status: ["pending", "active", "ended", "cancelled"],
      council_election_status: ["registration", "voting", "ended"],
      council_member_role: ["founder", "appointed", "elected"],
      council_proposal_status: [
        "pending",
        "voting",
        "approved",
        "rejected",
        "executed",
      ],
      council_proposal_type: [
        "new_project",
        "shares_release",
        "investigation",
        "policy",
      ],
      council_recommendation: ["approve", "object", "neutral"],
      council_vote_choice: ["approve", "object", "abstain"],
      coupon_status: ["active", "used", "expired"],
      deal_status: [
        "pending_seller_approval",
        "rejected",
        "accepted",
        "payment_submitted",
        "completed",
        "cancelled",
        "disputed",
        "expired",
      ],
      deal_type: ["primary", "secondary", "quick_sell"],
      discount_category: [
        "restaurants",
        "clothing",
        "electronics",
        "services",
        "travel",
        "groceries",
      ],
      disease_type: [
        "cancer",
        "heart",
        "kidney",
        "neurological",
        "pediatric",
        "transplant",
        "other",
      ],
      dispute_status: [
        "open",
        "under_review",
        "resolved_buyer",
        "resolved_seller",
        "closed",
      ],
      education_level: [
        "kindergarten",
        "primary",
        "intermediate",
        "secondary",
        "university",
      ],
      fee_unit_request_status: ["pending", "approved", "rejected", "cancelled"],
      follow_target_type: ["project", "company"],
      friend_request_status: ["pending", "accepted", "declined", "cancelled"],
      healthcare_application_status: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
      ],
      healthcare_case_status: ["urgent", "active", "completed", "cancelled"],
      id_document_type: ["national_id", "passport", "driver_license"],
      insurance_plan: ["basic", "advanced", "comprehensive"],
      insurance_status: ["active", "paused", "cancelled"],
      kyc_status: ["not_submitted", "pending", "approved", "rejected"],
      listing_status: ["active", "sold", "cancelled", "frozen"],
      member_invite_status: ["pending", "accepted", "declined"],
      message_type: ["text", "image", "payment_proof", "system"],
      news_type: [
        "announcement",
        "market_update",
        "project_news",
        "platform_update",
        "educational",
      ],
      notification_priority: ["low", "normal", "high", "urgent"],
      notification_type: [
        "kyc_approved",
        "kyc_rejected",
        "deal_request_received",
        "deal_accepted",
        "deal_rejected",
        "payment_submitted",
        "deal_completed",
        "deal_cancelled",
        "deal_disputed",
        "new_project",
        "project_update",
        "new_listing_match",
        "ambassador_approved",
        "ambassador_reward_earned",
        "fee_request_approved",
        "fee_request_rejected",
        "low_balance_warning",
        "subscription_expiring",
        "subscription_expired",
        "system_announcement",
        "news_published",
        "deal_expired",
        "level_upgraded",
        "dispute_resolved",
        "payment_received",
        "reminder",
        "friend_request_received",
        "friend_request_accepted",
        "council_proposal_new",
        "council_proposal_decided",
        "support_ticket_replied",
      ],
      payment_method: ["zain_cash", "master_card", "bank_transfer", "other"],
      project_status: [
        "draft",
        "coming_soon",
        "active",
        "sold_out",
        "completed",
        "cancelled",
      ],
      project_type: [
        "real_estate",
        "agriculture",
        "industrial",
        "commercial",
        "tech",
        "other",
      ],
      reaction_type: ["like", "love", "celebrate", "applause", "fire"],
      referral_link_status: ["active", "expired", "revoked"],
      reward_status: ["pending", "granted", "cancelled"],
      share_transfer_status: [
        "pending",
        "accepted",
        "rejected",
        "cancelled",
        "expired",
      ],
      sponsorship_status: ["active", "ended", "cancelled"],
      sponsorship_type: ["monthly", "annual", "onetime"],
      subscription_status: ["active", "expired", "cancelled"],
      ticket_category: [
        "technical",
        "billing",
        "kyc",
        "complaint",
        "feature_request",
        "other",
      ],
      ticket_priority: ["low", "medium", "high"],
      ticket_sender_type: ["user", "admin"],
      ticket_status: ["new", "in_progress", "replied", "closed"],
      transaction_type: [
        "deposit",
        "withdrawal",
        "subscription",
        "bonus",
        "refund",
        "adjustment",
      ],
      user_role: ["user", "ambassador", "admin", "super_admin"],
      wallet_type: ["offering", "ambassador", "reserve"],
    },
  },
} as const
