import { isStage, type Stage } from './review-pipeline.ts';

const STAGES = ['first_pass', 'fraud', 'hq'] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function reviewerAssignment(
	emailRaw: string,
	picked: Iterable<string>
): { email: string; stages: Stage[] } | { error: string } {
	const email = emailRaw.trim().toLowerCase();
	const chosen = new Set(picked);
	const stages = STAGES.filter((stage) => chosen.has(stage) && isStage(stage));
	if (!EMAIL.test(email)) return { error: 'need an email address' };
	if (stages.length === 0) return { error: 'pick at least one stage' };
	return { email, stages };
}
