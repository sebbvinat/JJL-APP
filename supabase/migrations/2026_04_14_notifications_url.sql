-- Notifications now carry a destination URL so clicking the bell dropdown
-- deep-links the user to the relevant page (a post, a module, etc.).
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS url TEXT;
