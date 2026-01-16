-- SAVR Collaborative Lists - Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- STEP 1: Create all tables first (no policies)
-- ============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Lists table
CREATE TABLE IF NOT EXISTS public.lists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🛒',
  color TEXT DEFAULT '#6A9571',
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  share_code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- List Items table
CREATE TABLE IF NOT EXISTS public.list_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Groceries',
  quantity TEXT NOT NULL DEFAULT '1',
  notes TEXT,
  completed BOOLEAN DEFAULT false,
  added_by UUID REFERENCES public.users(id) NOT NULL,
  added_by_name TEXT NOT NULL,
  added_date DATE DEFAULT CURRENT_DATE,
  completed_by UUID REFERENCES public.users(id),
  completed_by_name TEXT,
  completed_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collaborators table
CREATE TABLE IF NOT EXISTS public.collaborators (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  added_by UUID REFERENCES public.users(id) NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted BOOLEAN DEFAULT false,
  UNIQUE(list_id, user_id)
);

-- Activity Feed table
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  item_name TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Push Tokens table (for push notifications)
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  device_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- STEP 2: Create indexes for performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_list_items_list_id ON public.list_items(list_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_list_id ON public.collaborators(list_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_user_id ON public.collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_list_id ON public.activities(list_id);
CREATE INDEX IF NOT EXISTS idx_lists_share_code ON public.lists(share_code);
CREATE INDEX IF NOT EXISTS idx_lists_owner_id ON public.lists(owner_id);

-- ============================================
-- STEP 3: Enable Row Level Security
-- ============================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 4: Create RLS Policies for Users
-- ============================================

CREATE POLICY "Users can view all users" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- STEP 5: Create RLS Policies for Lists
-- ============================================

CREATE POLICY "Users can view their lists" ON public.lists
  FOR SELECT USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.collaborators
      WHERE collaborators.list_id = lists.id
      AND collaborators.user_id = auth.uid()
      AND collaborators.accepted = true
    )
  );

CREATE POLICY "Users can create lists" ON public.lists
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own lists" ON public.lists
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own lists" ON public.lists
  FOR DELETE USING (owner_id = auth.uid());

-- ============================================
-- STEP 6: Create RLS Policies for List Items
-- ============================================

CREATE POLICY "Users can view list items" ON public.list_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
      AND (
        lists.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.collaborators
          WHERE collaborators.list_id = lists.id
          AND collaborators.user_id = auth.uid()
          AND collaborators.accepted = true
        )
      )
    )
  );

CREATE POLICY "Users can add items" ON public.list_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
      AND (
        lists.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.collaborators
          WHERE collaborators.list_id = lists.id
          AND collaborators.user_id = auth.uid()
          AND collaborators.accepted = true
          AND collaborators.role IN ('editor', 'owner')
        )
      )
    )
  );

CREATE POLICY "Users can update items" ON public.list_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
      AND (
        lists.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.collaborators
          WHERE collaborators.list_id = lists.id
          AND collaborators.user_id = auth.uid()
          AND collaborators.accepted = true
          AND collaborators.role IN ('editor', 'owner')
        )
      )
    )
  );

CREATE POLICY "Users can delete items" ON public.list_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = list_items.list_id
      AND (
        lists.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.collaborators
          WHERE collaborators.list_id = lists.id
          AND collaborators.user_id = auth.uid()
          AND collaborators.accepted = true
          AND collaborators.role IN ('editor', 'owner')
        )
      )
    )
  );

-- ============================================
-- STEP 7: Create RLS Policies for Collaborators
-- ============================================

CREATE POLICY "Users can view collaborators" ON public.collaborators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = collaborators.list_id
      AND (
        lists.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.collaborators c2
          WHERE c2.list_id = lists.id
          AND c2.user_id = auth.uid()
          AND c2.accepted = true
        )
      )
    )
  );

CREATE POLICY "Owners can add collaborators" ON public.collaborators
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = collaborators.list_id
      AND lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "Owners can remove collaborators" ON public.collaborators
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = collaborators.list_id
      AND lists.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own collaborator status" ON public.collaborators
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================
-- STEP 8: Create RLS Policies for Activities
-- ============================================

CREATE POLICY "Users can view activities" ON public.activities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lists
      WHERE lists.id = activities.list_id
      AND (
        lists.owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.collaborators
          WHERE collaborators.list_id = lists.id
          AND collaborators.user_id = auth.uid()
          AND collaborators.accepted = true
        )
      )
    )
  );

CREATE POLICY "Users can create activities" ON public.activities
  FOR INSERT WITH CHECK (true);

-- ============================================
-- STEP 8b: Create RLS Policies for Push Tokens
-- ============================================

CREATE POLICY "Users can view own tokens" ON public.push_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tokens" ON public.push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tokens" ON public.push_tokens
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tokens" ON public.push_tokens
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- STEP 9: Create helper functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on lists
DROP TRIGGER IF EXISTS update_lists_updated_at ON public.lists;
CREATE TRIGGER update_lists_updated_at
  BEFORE UPDATE ON public.lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trigger to auto-update updated_at on list_items
DROP TRIGGER IF EXISTS update_list_items_updated_at ON public.list_items;
CREATE TRIGGER update_list_items_updated_at
  BEFORE UPDATE ON public.list_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- STEP 10: Enable Realtime
-- ============================================

-- Note: You need to enable realtime manually in Supabase Dashboard
-- Go to Database > Replication > supabase_realtime publication
-- Enable these tables:
--   ✓ public.lists
--   ✓ public.list_items
--   ✓ public.collaborators
--   ✓ public.activities

-- Or run these commands one by one (skip if table already added):
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.lists;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.list_items;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.collaborators;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;

-- ============================================
-- SUCCESS! Database is ready for collaboration
-- ============================================
