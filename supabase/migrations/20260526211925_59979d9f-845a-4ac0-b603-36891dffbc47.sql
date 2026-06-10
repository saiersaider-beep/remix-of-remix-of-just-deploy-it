-- Add missing columns referenced by client code
DO $a1$ BEGIN ALTER TABLE public.playlist_tracks ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(); EXCEPTION WHEN OTHERS THEN NULL; END $a1$;

DO $a2$ BEGIN
  CREATE TABLE IF NOT EXISTS public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    content text,
    audio_url text,
    transcript text,
    created_at timestamptz NOT NULL DEFAULT now(),
    read_at timestamptz
  );
  ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
  GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
  GRANT ALL ON public.messages TO service_role;
EXCEPTION WHEN OTHERS THEN NULL; END $a2$;

DO $a3$ BEGIN ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS audio_url text; EXCEPTION WHEN OTHERS THEN NULL; END $a3$;
DO $a4$ BEGIN ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS transcript text; EXCEPTION WHEN OTHERS THEN NULL; END $a4$;

DO $a5$ BEGIN
  CREATE TABLE IF NOT EXISTS public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id uuid NOT NULL,
    user2_id uuid NOT NULL,
    last_message_at timestamptz NOT NULL DEFAULT now(),
    last_message_preview text,
    last_sender_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
  GRANT SELECT, INSERT ON public.conversations TO authenticated;
  GRANT ALL ON public.conversations TO service_role;
EXCEPTION WHEN OTHERS THEN NULL; END $a5$;

DO $a6$ BEGIN CREATE POLICY "Participants view conv" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() = user1_id OR auth.uid() = user2_id); EXCEPTION WHEN duplicate_object THEN NULL; END $a6$;
DO $a7$ BEGIN CREATE POLICY "Participants read msg" ON public.messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND (auth.uid() = c.user1_id OR auth.uid() = c.user2_id))); EXCEPTION WHEN duplicate_object THEN NULL; END $a7$;
DO $a8$ BEGIN CREATE POLICY "Sender inserts msg" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id); EXCEPTION WHEN duplicate_object THEN NULL; END $a8$;

-- track_comments: add 'content' and 'pinned' (code uses both 'body' and 'content')
DO $a9$ BEGIN ALTER TABLE public.track_comments ADD COLUMN IF NOT EXISTS content text; EXCEPTION WHEN OTHERS THEN NULL; END $a9$;
DO $a10$ BEGIN ALTER TABLE public.track_comments ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false; EXCEPTION WHEN OTHERS THEN NULL; END $a10$;

-- purchases: artist_id used in tracks-data
DO $a11$ BEGIN ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS artist_id uuid; EXCEPTION WHEN OTHERS THEN NULL; END $a11$;