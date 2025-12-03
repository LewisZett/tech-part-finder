// Application-level type definitions for database entities

export interface Profile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  trade_type: string;
  phone_number?: string | null;
  is_verified?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PublicProfile {
  id: string | null;
  full_name?: string | null;
  trade_type?: string | null;
  is_verified?: boolean | null;
  created_at?: string | null;
}

export interface Part {
  id: string;
  supplier_id: string;
  part_name: string;
  category: string;
  condition: string;
  price?: number | null;
  description?: string | null;
  location?: string | null;
  image_url?: string | null;
  status?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  vehicle_year_from?: number | null;
  vehicle_year_to?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Joined data
  public_profiles?: PublicProfile | null;
}

export interface PartRequest {
  id: string;
  requester_id: string;
  part_name: string;
  category: string;
  description?: string | null;
  condition_preference?: string | null;
  max_price?: number | null;
  location?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Joined data
  public_profiles?: PublicProfile | null;
}

export interface Match {
  id: string;
  part_id?: string | null;
  request_id?: string | null;
  supplier_id: string;
  requester_id: string;
  status?: string | null;
  supplier_agreed?: boolean | null;
  requester_agreed?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  // Joined data - can be single object or array depending on query
  parts?: { part_name: string; price?: number | null } | Array<{ part_name: string; price?: number | null }>;
  part_requests?: { part_name: string; max_price?: number | null } | Array<{ part_name: string; max_price?: number | null }>;
  supplier?: PublicProfile | null;
  requester?: PublicProfile | null;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at?: string | null;
}

export interface Rating {
  id: string;
  match_id: string;
  rater_id: string;
  rated_id: string;
  rating: number;
  comment?: string | null;
  rating_type?: string | null;
  seller_response?: string | null;
  verified_purchase?: boolean | null;
  created_at?: string | null;
}

// Category configuration types
export type CategoryKey = 'phone' | 'tv' | 'computer' | 'car';

export const CATEGORY_DB_MAP: Record<CategoryKey, string> = {
  phone: "Phone Spare Parts",
  tv: "TV Spare Parts",
  computer: "Computer Spare Parts",
  car: "Car Spare Parts",
} as const;