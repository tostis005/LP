export type ProgramType = "stamps" | "points" | "cashback";
export type Business = {
  id: string; name: string; slug: string; currency?: "USD"|"EUR"|"MXN"; parent_business_id?: string | null; description: string | null; logo_url: string | null; card_logo_scale?:number; card_logo_x?:number; card_logo_y?:number;
  category: string | null; accent_color: string; card_text_color?:string; card_title_font?:string; stamp_color?:string; card_background: string | null;
  card_text: string | null; stamp_icon?: string; stamp_image_url?: string | null; public_listing: boolean; active: boolean;
};
export type Program = {
  id: string; business_id: string; type: ProgramType; reward_label: string;
  reward_cost: number; cashback_bps: number; points_per_euro: number;
  max_stamps_per_action: number; max_ticket_cents: number; min_seconds_between_awards: number;
  max_daily_awards_per_employee: number; require_ticket_reference: boolean; require_purchase_amount?: boolean;
};
export type Membership = { id: string; customer_id: string; business_id: string; card_token: string;
  balance: number; total_earned: number; created_at: string; businesses?: Business; };
export type Location = { id: string; business_id: string; name: string; address: string; city: string;
  country: string; lat: number; lng: number; businesses?: Business; };
export type Role = "owner" | "manager" | "employee";
