
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  "https://ndryoyjjgvrtqrlidytq.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_CA4ZvxkvrfPkghVxY-_18Q_W9RL8xo2";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
