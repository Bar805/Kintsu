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

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
}

// Derived type for UI usage
export interface ConversationWithDetails extends Conversation {
  partner_name?: string;
  partner_avatar?: string;
}
