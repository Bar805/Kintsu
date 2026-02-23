export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Conversation {
  id: string;
  created_at: string;
  is_active: boolean;
  timer_expires_at: string | null;
  last_message_sender_id: string | null;
  interested_user_ids: string[];
  meetup_suggested: boolean;
  meetup_trigger_after: number | null;
  user_ids_who_messaged: string[];
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_ai_generated: boolean;
}

export interface Participant {
  conversation_id: string;
  user_id: string;
  joined_at: string;
}

export interface VibeSliders {
  social_battery: number;
  planning: number;
  conversation: number;
  thinking: number;
  risk: number;
}

export interface PromptAnswer {
  prompt: string;
  answer: string;
}

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name?: string | null; // Keeping as optional for backwards compatibility during migration
  avatar_url: string;
  bio?: string | null;
  age?: number | null;
  gender?: string | null;
  interests?: string[] | null;
  looking_for?: string | null;
  // Identity Stack fields
  sliders?: VibeSliders | null;
  identity_chips?: string[] | null;
  prompt_answer?: PromptAnswer | null;
  ai_summary?: string | null;
}

// Derived type for UI usage
export interface ConversationWithDetails extends Conversation {
  partner_name?: string;
  partner_avatar?: string;
}
