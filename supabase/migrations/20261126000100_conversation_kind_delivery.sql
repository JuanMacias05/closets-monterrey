-- Buyer <-> courier chats (roadmap follow-up, approved 2026-11-21). The new kind goes in its
-- own migration: Postgres does not let a value added to an enum be used in the same
-- transaction, and 20261126000200 uses it right away (functions, backfill).
alter type public.conversation_kind add value if not exists 'delivery';
