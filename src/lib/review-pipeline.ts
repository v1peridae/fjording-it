export const STAGES = ['first_pass', 'fraud', 'hq'] as const;
export type Stage = (typeof STAGES)[number];
export type PipelineStage = Stage | 'done';

export type Decision =
	| 'approved'
	| 'rejected'
	| 'needs_changes'
	| 'clear'
	| 'fraud'
	| 'needs_info'
	| 'confirmed'
	| 'sent_back';

const DECISIONS: Record<Stage, Decision[]> = {
	first_pass: ['approved', 'rejected', 'needs_changes'],
	fraud: ['clear', 'fraud', 'needs_info', 'sent_back'],
	hq: ['confirmed', 'sent_back']
};

export function decisionsFor(stage: Stage): Decision[] {
	return DECISIONS[stage];
}

export function isStage(value: string): value is Stage {
	return (STAGES as readonly string[]).includes(value);
}

/** Where a decision sends the submission. Send-back walks one stage earlier. */
export function applyDecision(stage: Stage, decision: Decision): { stage: PipelineStage; status: string } | null {
	if (!DECISIONS[stage].includes(decision)) return null;
	if (stage === 'first_pass' && decision === 'approved') return { stage: 'fraud', status: 'pending' };
	if (stage === 'first_pass' && decision === 'rejected') return { stage: 'first_pass', status: 'rejected' };
	if (stage === 'first_pass' && decision === 'needs_changes') return { stage: 'first_pass', status: 'needs_changes' };
	if (stage === 'fraud' && decision === 'clear') return { stage: 'hq', status: 'pending' };
	if (stage === 'fraud' && decision === 'fraud') return { stage: 'fraud', status: 'fraud' };
	if (stage === 'fraud' && decision === 'needs_info') return { stage: 'fraud', status: 'needs_info' };
	if (stage === 'fraud' && decision === 'sent_back') return { stage: 'first_pass', status: 'pending' };
	if (stage === 'hq' && decision === 'confirmed') return { stage: 'done', status: 'confirmed' };
	if (stage === 'hq' && decision === 'sent_back') return { stage: 'fraud', status: 'pending' };
	return null;
}

export function airtableEligible(stage: PipelineStage, status: string): boolean {
	return stage === 'done' && status === 'confirmed';
}

/** Testers may be confirmed under 5 hours. Everyone else needs 5 approved hours. */
export function confirmAllowed(options: {
	hackatimeSeconds: number;
	overrideHours: number | null;
	tester: boolean;
}): boolean {
	if (options.tester) return true;
	return approvedHours(options.hackatimeSeconds, options.overrideHours) >= 5;
}

/** Approved hours are the override when a reviewer set one, otherwise Hackatime hours. */
export function approvedHours(hackatimeSeconds: number, overrideHours: number | null): number {
	if (overrideHours != null && Number.isFinite(overrideHours)) return overrideHours;
	return hackatimeSeconds / 3600;
}

export function lapseLinks(value: string): string[] | null {
	const parts = value
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	const links: string[] = [];
	for (const part of parts) {
		let raw = part;
		if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
		try {
			const url = new URL(raw);
			if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
			if (!url.hostname.includes('.')) return null;
			links.push(url.href);
		} catch {
			return null;
		}
	}
	return links;
}

export function overrideHours(value: string): number | null | undefined {
	const raw = value.trim();
	if (!raw) return null;
	const hours = Number(raw);
	if (!Number.isFinite(hours) || hours < 0 || hours > 10000) return undefined;
	return hours;
}

export function median(values: number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
