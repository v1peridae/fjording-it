import { approvedHours } from './review-pipeline.ts';

/**
 * The cap or the $300. Each participant picks one.
 *
 * The rule, kept simple on purpose:
 * - 'cap'   = the cap only. Not in the running for the $300.
 * - 'prize' = no cap. In the running for the $300 (top 5 picked by HQ).
 * - no pick = treated as 'cap', the prize everyone who ships 5 hours was promised first.
 *   Skipping the cap has to be an explicit choice.
 */
export const REWARD_CHOICES = ['cap', 'prize'] as const;
export type RewardChoice = (typeof REWARD_CHOICES)[number];

export function parseRewardChoice(value: unknown): RewardChoice | null {
	return typeof value === 'string' && (REWARD_CHOICES as readonly string[]).includes(value) ? (value as RewardChoice) : null;
}

export function rewardOutcome(choice: RewardChoice | null): { cap: boolean; prizeEligible: boolean } {
	if (choice === 'prize') return { cap: false, prizeEligible: true };
	return { cap: true, prizeEligible: false };
}

/** The pick can change until the challenge closes. */
export function canChangeReward(phase: 'early' | 'open' | 'closed'): boolean {
	return phase !== 'closed';
}

export const REWARD_COPY = {
	ask: 'get the cap, or skip it and stay in the running for the $300',
	cap: 'get the cap',
	capFine: 'ship 5 hours and we send you one',
	prize: 'skip the cap',
	prizeFine: 'stay in the running for $300 toward a flight to norway. the top 5 projects get it, picked by HQ',
	when: 'pick any time before dec 6. you can change your mind until then',
	none: "no pick yet, so it's the cap for now",
	pickedCap: "you're getting the cap",
	pickedPrize: "you skipped the cap. you're in the running for the $300"
} as const;

/**
 * Admin only. Never send this to a participant route.
 * The balance is the sum of approved hours on HQ confirmed, non test, northern submissions.
 * Approved hours are the reviewer override when set, otherwise the Hackatime seconds in the window.
 * Unconfirmed work counts 0. The value is set, never incremented, so syncing twice is safe.
 */
export type BalanceSubmission = {
	challenge: string;
	stage: string;
	status: string;
	isTest: boolean;
	hackatimeSeconds: number;
	overrideHours: number | null;
};

export function hourBalance(submissions: BalanceSubmission[], challenge = 'northern'): number {
	let total = 0;
	for (const sub of submissions) {
		if (sub.challenge !== challenge || sub.isTest) continue;
		if (sub.stage !== 'done' || sub.status !== 'confirmed') continue;
		const hours = approvedHours(Number.isFinite(sub.hackatimeSeconds) ? sub.hackatimeSeconds : 0, sub.overrideHours);
		if (Number.isFinite(hours) && hours > 0) total += hours;
	}
	return Math.round(total * 1000) / 1000;
}
