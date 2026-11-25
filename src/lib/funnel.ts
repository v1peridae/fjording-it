export type FunnelCounts = {
	signedUp: number;
	connected: number;
	addedProject: number;
	submitted: number;
	approved: number;
	approvedHours: number;
};

export type FunnelStage = {
	key: string;
	label: string;
	count: number;
	ofPrevious: number | null;
	ofSignups: number | null;
};

/** One round trip. Counts are people until submitted, which is Northern Challenge rows. */
export const FUNNEL_SQL = `
SELECT
	(SELECT count(*)::int FROM participants) AS signed_up,
	(SELECT count(*)::int FROM participants p
	  WHERE EXISTS (
	    SELECT 1 FROM hackatime_connections h
	    WHERE lower(h.email) = lower(p.email)
	  )) AS connected,
	(SELECT count(*)::int FROM participants p
	  WHERE EXISTS (
	    SELECT 1 FROM submissions s
	    WHERE s.challenge = 'northern'
	      AND (s.participant_id = p.id OR lower(s.email) = lower(p.email))
	  )) AS added_project,
	(SELECT count(*)::int FROM submissions WHERE challenge = 'northern') AS submitted,
	(SELECT count(*)::int FROM submissions
	  WHERE challenge = 'northern' AND status = 'confirmed') AS approved,
	(SELECT COALESCE(sum(
	    CASE
	      WHEN override_hours IS NOT NULL THEN override_hours
	      ELSE hackatime_seconds / 3600.0
	    END
	  ), 0)
	  FROM submissions
	  WHERE challenge = 'northern' AND status = 'confirmed') AS approved_hours
`;

export function funnelFromRow(row: Record<string, unknown>): FunnelCounts {
	return {
		signedUp: num(row.signed_up),
		connected: num(row.connected),
		addedProject: num(row.added_project),
		submitted: num(row.submitted),
		approved: num(row.approved),
		approvedHours: num(row.approved_hours)
	};
}

export function funnelStages(counts: FunnelCounts): { stages: FunnelStage[]; approvedHours: number } {
	const rows: { key: string; label: string; count: number }[] = [
		{ key: 'signed_up', label: 'signed up', count: counts.signedUp },
		{ key: 'connected', label: 'connected hackatime', count: counts.connected },
		{ key: 'project', label: 'added a project', count: counts.addedProject },
		{ key: 'submitted', label: 'submitted', count: counts.submitted },
		{ key: 'approved', label: 'approved', count: counts.approved }
	];
	return {
		approvedHours: round1(counts.approvedHours),
		stages: rows.map((row, index) => ({
			...row,
			ofPrevious: index === 0 ? null : percent(row.count, rows[index - 1].count),
			ofSignups: percent(row.count, counts.signedUp)
		}))
	};
}

function percent(part: number, whole: number): number | null {
	if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
	return Math.round((part / whole) * 1000) / 10;
}

function round1(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.round(value * 10) / 10;
}

function num(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}
