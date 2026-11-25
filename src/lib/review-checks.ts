export type Evidence = { label: string; value: string; href?: string };
export type FlagState = 'clear' | 'flag' | 'unavailable';
export type CheckKind = 'prior_experience' | 'copied_project' | 'hackatime_lapse';

export type CheckResult = {
	kind: CheckKind;
	flag: FlagState;
	summary: string;
	evidence: Evidence[];
};

export type GithubRepoFacts = {
	fullName: string;
	url: string;
	createdAt: string | null;
	fork: boolean;
	parent: { fullName: string; url: string } | null;
	template: { fullName: string; url: string } | null;
	commitsBefore: { date: string; url: string }[];
	contributors: { login: string; url: string }[];
	earlyAdditions: number | null;
	sameName: { fullName: string; url: string }[];
};

export type Heartbeat = { at: number; project: string; seconds: number };

export type OtherClaim = { id: number; challenge: string; email: string; seconds: number };

const KINDS: CheckKind[] = ['prior_experience', 'copied_project', 'hackatime_lapse'];

export function checkKinds(): CheckKind[] {
	return KINDS;
}

export function parseGithubRepo(value: string): { owner: string; repo: string } | null {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return null;
	}
	const host = url.hostname.replace(/^www\./, '');
	if (host !== 'github.com') return null;
	const [owner, repo] = url.pathname.split('/').filter(Boolean);
	if (!owner || !repo) return null;
	return { owner, repo: repo.replace(/\.git$/, '') };
}

export function priorExperienceCheck(input: {
	repo: GithubRepoFacts | null;
	challengeStart: Date;
	hackatimeBeforeSeconds: number | null;
	unavailable?: string;
}): CheckResult {
	if (input.unavailable) {
		return { kind: 'prior_experience', flag: 'unavailable', summary: input.unavailable, evidence: [] };
	}
	if (!input.repo) {
		return {
			kind: 'prior_experience',
			flag: 'unavailable',
			summary: "couldn't check: that link is not a github repo",
			evidence: []
		};
	}
	const start = input.challengeStart.getTime();
	const created = input.repo.createdAt ? new Date(input.repo.createdAt).getTime() : null;
	const createdBefore = created != null && created < start;
	const commitsBefore = input.repo.commitsBefore.length;
	const extraPeople = input.repo.contributors.filter((person) => person.login !== input.repo!.fullName.split('/')[0]);
	const priorHackatime = (input.hackatimeBeforeSeconds ?? 0) > 0;
	const flag = createdBefore || commitsBefore > 0 || extraPeople.length > 0 || priorHackatime;
	const evidence: Evidence[] = [
		{
			label: 'repo created',
			value: input.repo.createdAt ? new Date(input.repo.createdAt).toISOString() : 'unknown',
			href: input.repo.url
		},
		{ label: 'commits before the challenge', value: String(commitsBefore) },
		{ label: 'contributors', value: String(input.repo.contributors.length), href: `${input.repo.url}/graphs/contributors` }
	];
	if (input.hackatimeBeforeSeconds == null) {
		evidence.push({ label: 'hackatime before the challenge', value: "couldn't check" });
	} else {
		evidence.push({ label: 'hackatime seconds before the challenge', value: String(input.hackatimeBeforeSeconds) });
	}
	for (const commit of input.repo.commitsBefore.slice(0, 3)) {
		evidence.push({ label: 'earlier commit', value: commit.date, href: commit.url });
	}
	return {
		kind: 'prior_experience',
		flag: flag ? 'flag' : 'clear',
		summary: flag ? 'this looks older than the challenge' : 'nothing before the challenge turned up',
		evidence
	};
}

export function copiedProjectCheck(input: {
	repo: GithubRepoFacts | null;
	unavailable?: string;
}): CheckResult {
	if (input.unavailable) {
		return { kind: 'copied_project', flag: 'unavailable', summary: input.unavailable, evidence: [] };
	}
	if (!input.repo) {
		return {
			kind: 'copied_project',
			flag: 'unavailable',
			summary: "couldn't check: that link is not a github repo",
			evidence: []
		};
	}
	const evidence: Evidence[] = [];
	if (input.repo.fork && input.repo.parent) {
		evidence.push({ label: 'fork of', value: input.repo.parent.fullName, href: input.repo.parent.url });
	} else {
		evidence.push({ label: 'fork', value: input.repo.fork ? 'yes' : 'no', href: input.repo.url });
	}
	if (input.repo.template) {
		evidence.push({ label: 'template', value: input.repo.template.fullName, href: input.repo.template.url });
	}
	for (const hit of input.repo.sameName.slice(0, 5)) {
		evidence.push({ label: 'same name', value: hit.fullName, href: hit.url });
	}
	if (input.repo.earlyAdditions != null) {
		evidence.push({ label: 'lines in an early commit', value: String(input.repo.earlyAdditions) });
	}
	const large = (input.repo.earlyAdditions ?? 0) >= 800;
	const flag = Boolean(input.repo.fork || input.repo.template || input.repo.sameName.length || large);
	return {
		kind: 'copied_project',
		flag: flag ? 'flag' : 'clear',
		summary: flag ? 'this may be a copy of another repo' : 'no fork, template, or name match turned up',
		evidence
	};
}

export function hackatimeLapseCheck(input: {
	project: string;
	storedSeconds: number;
	claims: OtherClaim[];
	heartbeats: Heartbeat[] | null;
	challengeStart: Date;
	challengeEnd: Date;
	unavailable?: string;
}): CheckResult {
	const evidence: Evidence[] = [];
	const duplicates = input.claims.filter((claim) => claim.seconds >= 0);
	for (const claim of duplicates) {
		evidence.push({
			label: 'also claimed',
			value: `${claim.challenge} #${claim.id} · ${claim.email} · ${claim.seconds}s`
		});
	}
	if (input.unavailable && !input.heartbeats && duplicates.length === 0) {
		return { kind: 'hackatime_lapse', flag: 'unavailable', summary: input.unavailable, evidence };
	}
	if (!input.heartbeats) {
		return {
			kind: 'hackatime_lapse',
			flag: duplicates.length ? 'flag' : 'unavailable',
			summary: duplicates.length
				? 'the same hackatime project is on another submission'
				: (input.unavailable ?? "couldn't check hackatime heartbeats"),
			evidence
		};
	}

	const start = input.challengeStart.getTime();
	const end = input.challengeEnd.getTime();
	const mine = input.heartbeats.filter((beat) => beat.project.toLowerCase() === input.project.toLowerCase());
	const before = mine.filter((beat) => beat.at < start).reduce((sum, beat) => sum + beat.seconds, 0);
	const after = mine.filter((beat) => beat.at > end).reduce((sum, beat) => sum + beat.seconds, 0);
	const inside = mine.filter((beat) => beat.at >= start && beat.at <= end);
	const insideSeconds = inside.reduce((sum, beat) => sum + beat.seconds, 0);
	evidence.push({ label: 'seconds before the window', value: String(before) });
	evidence.push({ label: 'seconds after the window', value: String(after) });
	evidence.push({ label: 'seconds inside the window', value: String(insideSeconds) });

	const outsideCounted = input.storedSeconds > insideSeconds + 60 && before + after > 60;
	if (outsideCounted) {
		evidence.push({
			label: 'stored seconds',
			value: `${input.storedSeconds} stored, ${insideSeconds} inside the window`
		});
	}

	const ordered = [...inside].sort((a, b) => a.at - b.at);
	let longGap = false;
	for (let i = 1; i < ordered.length; i++) {
		const gap = ordered[i].at - (ordered[i - 1].at + ordered[i - 1].seconds * 1000);
		if (gap > 12 * 60 * 60 * 1000) longGap = true;
	}
	if (longGap) evidence.push({ label: 'gap', value: 'more than 12 hours between heartbeats inside the window' });

	let spike = false;
	const buckets = new Map<number, number>();
	for (const beat of inside) {
		const bucket = Math.floor(beat.at / 3_600_000);
		buckets.set(bucket, (buckets.get(bucket) ?? 0) + beat.seconds);
	}
	for (const seconds of buckets.values()) {
		if (seconds > 70 * 60) spike = true;
	}
	if (spike) evidence.push({ label: 'spike', value: 'more than 70 minutes logged inside one hour' });

	const overlaps = overlappingProjects(input.heartbeats, input.project, start, end);
	for (const overlap of overlaps.slice(0, 5)) {
		evidence.push({ label: 'overlaps', value: overlap });
	}

	const flag = duplicates.length > 0 || outsideCounted || longGap || spike || overlaps.length > 0 || before > 0;
	return {
		kind: 'hackatime_lapse',
		flag: flag ? 'flag' : 'clear',
		summary: flag ? 'hackatime hours need a closer look' : 'no double count, overlap, or spike turned up',
		evidence
	};
}

function overlappingProjects(heartbeats: Heartbeat[], project: string, start: number, end: number): string[] {
	const spans = heartbeats
		.filter((beat) => beat.at >= start && beat.at <= end)
		.map((beat) => ({
			project: beat.project,
			from: beat.at,
			to: beat.at + beat.seconds * 1000
		}));
	const mine = spans.filter((span) => span.project.toLowerCase() === project.toLowerCase());
	const others = spans.filter((span) => span.project.toLowerCase() !== project.toLowerCase());
	const found = new Set<string>();
	for (const left of mine) {
		for (const right of others) {
			if (left.from < right.to && right.from < left.to) found.add(right.project);
		}
	}
	return [...found].map((name) => `${name} overlaps ${project}`);
}

export function heartbeatsFromPayload(json: unknown): Heartbeat[] | null {
	if (!json || typeof json !== 'object') return null;
	const body = json as { heartbeats?: unknown; data?: unknown; spans?: unknown };
	const list = body.heartbeats ?? body.data ?? body.spans;
	if (!Array.isArray(list)) return null;
	const beats: Heartbeat[] = [];
	for (const item of list) {
		if (!item || typeof item !== 'object') continue;
		const row = item as { time?: unknown; start?: unknown; duration?: unknown; seconds?: unknown; project?: unknown; end?: unknown };
		const project = typeof row.project === 'string' ? row.project.trim() : '';
		if (!project) continue;
		const rawTime = row.time ?? row.start;
		const at = typeof rawTime === 'number' ? (rawTime < 10_000_000_000 ? rawTime * 1000 : rawTime) : Date.parse(String(rawTime ?? ''));
		if (!Number.isFinite(at)) continue;
		let seconds = Number(row.duration ?? row.seconds ?? 120);
		if (typeof row.end === 'string' || typeof row.end === 'number') {
			const end = typeof row.end === 'number' ? (row.end < 10_000_000_000 ? row.end * 1000 : row.end) : Date.parse(row.end);
			if (Number.isFinite(end) && end > at) seconds = Math.round((end - at) / 1000);
		}
		if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
		beats.push({ at, project, seconds });
	}
	return beats;
}
