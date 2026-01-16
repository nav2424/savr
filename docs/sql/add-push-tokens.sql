-- Add Push Tokens Table (Run this if you already have the base schema)

-- Push Tokens table (for push notifications)
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  device_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own tokens" ON public.push_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tokens" ON public.push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tokens" ON public.push_tokens
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tokens" ON public.push_tokens
  FOR DELETE USING (user_id = auth.uid());

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON public.push_tokens(user_id);

-- Done! Push notifications are ready.

