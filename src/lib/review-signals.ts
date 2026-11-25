export type SignalState = 'clear' | 'look' | 'unknown';

export type SignalLine = {
	label: string;
	value: string;
	state: SignalState;
	href?: string;
};

export type ReviewSignal = {
	key: 'prior_experience' | 'copied_project' | 'hackatime_lapse';
	title: string;
	state: SignalState;
	lines: SignalLine[];
};

export type SignalFacts = {
	githubAccountCreated: string | null;
	publicRepoCount: number | null;
	priorSubmissions: { id: number; challenge: string; project: string }[] | null;
	fork: boolean | null;
	forkParent: { name: string; url: string } | null;
	firstCommitAt: string | null;
	firstCommitAdditions: number | null;
	earliestCommitBeforeEvent: string | null;
	commitsBeforeEvent: number | null;
	duplicateRepoIds: number[] | null;
	otherClaims: { id: number; project: string; seconds: number }[] | null;
	secondsBeforeWindow: number | null;
	secondsAfterWindow: number | null;
	windowSeconds: number | null;
	heartbeatOverlaps: string[] | null;
	eventStart: string | null;
};

const NOT_CHECKED = 'not checked';

export function buildReviewSignals(facts: SignalFacts): ReviewSignal[] {
	const prior: SignalLine[] = [
		dated('github account created', facts.githubAccountCreated, facts.eventStart),
		facts.publicRepoCount == null
			? unknownLine('public repos')
			: line('public repos', String(facts.publicRepoCount), facts.publicRepoCount > 0 ? 'look' : 'clear'),
		priorLine(facts.priorSubmissions)
	];
	if (facts.commitsBeforeEvent == null) prior.push(unknownLine('commits before the event'));
	else {
		prior.push(
			line(
				'commits before the event',
				String(facts.commitsBeforeEvent),
				facts.commitsBeforeEvent > 0 ? 'look' : 'clear'
			)
		);
	}

	const copy: SignalLine[] = [];
	if (facts.fork == null) copy.push(unknownLine('fork'));
	else if (facts.fork && facts.forkParent) {
		copy.push({ label: 'fork of', value: facts.forkParent.name, state: 'look', href: facts.forkParent.url });
	} else copy.push(line('fork', facts.fork ? 'yes' : 'no', facts.fork ? 'look' : 'clear'));

	copy.push(dated('first commit', facts.firstCommitAt, facts.eventStart));
	if (facts.firstCommitAdditions == null) copy.push(unknownLine('first commit size'));
	else {
		copy.push(
			line(
				'first commit size',
				`${facts.firstCommitAdditions} lines added`,
				facts.firstCommitAdditions >= 800 ? 'look' : 'clear'
			)
		);
	}
	if (facts.commitsBeforeEvent == null) copy.push(unknownLine('earliest commit before the event'));
	else {
		copy.push(
			line(
				'earliest commit before the event',
				facts.earliestCommitBeforeEvent ?? 'none',
				facts.earliestCommitBeforeEvent ? 'look' : 'clear'
			)
		);
	}
	if (facts.duplicateRepoIds == null) copy.push(unknownLine('same repo on another submission'));
	else if (facts.duplicateRepoIds.length === 0) copy.push(line('same repo on another submission', 'none', 'clear'));
	else copy.push(line('same repo on another submission', facts.duplicateRepoIds.map((id) => `#${id}`).join(', '), 'look'));

	const hours: SignalLine[] = [];
	if (facts.otherClaims == null) hours.push(unknownLine('hours claimed on another project'));
	else if (facts.otherClaims.length === 0) hours.push(line('hours claimed on another project', 'none', 'clear'));
	else {
		hours.push(
			line(
				'hours claimed on another project',
				facts.otherClaims.map((claim) => `#${claim.id} ${claim.project} · ${claim.seconds}s`).join('; '),
				'look'
			)
		);
	}
	if (facts.heartbeatOverlaps == null) hours.push(unknownLine('overlapping heartbeats'));
	else if (facts.heartbeatOverlaps.length === 0) hours.push(line('overlapping heartbeats', 'none', 'clear'));
	else hours.push(line('overlapping heartbeats', facts.heartbeatOverlaps.join('; '), 'look'));

	if (facts.secondsBeforeWindow == null && facts.secondsAfterWindow == null) {
		hours.push(unknownLine('hours outside the event window'));
	} else {
		const before = facts.secondsBeforeWindow ?? 0;
		const after = facts.secondsAfterWindow ?? 0;
		hours.push(line('hours outside the event window', `${before + after}s`, before + after > 0 ? 'look' : 'clear'));
	}
	if (facts.windowSeconds == null) hours.push(unknownLine('hackatime total inside the event window'));
	else hours.push(line('hackatime total inside the event window', `${facts.windowSeconds}s`, 'clear'));

	return [
		group('prior_experience', 'prior experience', prior),
		group('copied_project', 'copied project', copy),
		group('hackatime_lapse', 'hackatime hours', hours)
	];
}

function priorLine(rows: SignalFacts['priorSubmissions']): SignalLine {
	if (rows == null) return unknownLine('other submissions by this person');
	if (rows.length === 0) return line('other submissions by this person', 'none', 'clear');
	return line(
		'other submissions by this person',
		rows.map((row) => `#${row.id} ${row.challenge} · ${row.project}`).join('; '),
		'look'
	);
}

function group(key: ReviewSignal['key'], title: string, lines: SignalLine[]): ReviewSignal {
	const state: SignalState = lines.some((item) => item.state === 'look')
		? 'look'
		: lines.some((item) => item.state === 'unknown')
			? 'unknown'
			: 'clear';
	return { key, title, state, lines };
}

function line(label: string, value: string, state: SignalState): SignalLine {
	return { label, value, state };
}

function dated(label: string, iso: string | null, eventStart: string | null): SignalLine {
	if (!iso) return unknownLine(label);
	if (!eventStart || Number.isNaN(Date.parse(iso)) || Number.isNaN(Date.parse(eventStart))) {
		return line(label, iso, 'clear');
	}
	return line(label, iso, Date.parse(iso) < Date.parse(eventStart) ? 'look' : 'clear');
}

function unknownLine(label: string): SignalLine {
	return { label, value: NOT_CHECKED, state: 'unknown' };
}
