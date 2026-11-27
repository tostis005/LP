-- Preserve existing cards; allow only the supported title typography choices.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS card_title_font text NOT NULL DEFAULT 'default';
ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_card_title_font_check;
ALTER TABLE public.businesses ADD CONSTRAINT businesses_card_title_font_check CHECK (card_title_font IN ('default','modern','editorial','classic','rounded','geometric','mono','display'));
