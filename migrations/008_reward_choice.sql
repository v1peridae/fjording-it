-- Each participant picks the cap, or skips it to stay in the running for the $300.
-- Also keeps a per-participant hour balance (approved challenge hours, admin only).
-- Adds columns only. Does not remove existing data.

ALTER TABLE participants ADD COLUMN IF NOT EXISTS reward_choice text
	CONSTRAINT participants_reward_choice CHECK (reward_choice IN ('cap', 'prize'));
ALTER TABLE participants ADD COLUMN IF NOT EXISTS reward_choice_at timestamptz;

ALTER TABLE participants ADD COLUMN IF NOT EXISTS hour_balance numeric;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS hour_balance_at timestamptz;
