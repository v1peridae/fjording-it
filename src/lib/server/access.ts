import { isAdminEmail } from '../signup-stats.ts';
import type { Stage } from '../review-pipeline.ts';
import { appDatabase } from './app-db.ts';
import { reviewerStages } from './northern-store.ts';

export async function reviewerStagesFor(email: string): Promise<Stage[]> {
	try {
		return await reviewerStages(await appDatabase(), email);
	} catch {
		return [];
	}
}

export async function canAct(email: string, stage: Stage, allowlist: string | undefined): Promise<boolean> {
	if (isAdminEmail(email, allowlist)) return true;
	const stages = await reviewerStagesFor(email);
	return stages.includes(stage);
}
