export type HackatimeChoice = {
	name: string;
	seconds: number;
	hours: string;
	eligible: boolean;
};

export function isJunkHackatimeName(name: string): boolean {
	const value = name.trim();
	if (!value) return true;
	if (/vscode|code-oss|\/tmp\/|\\temp\\|var\/folders|appdata/i.test(value)) return true;
	if (/^[A-Za-z0-9+/_-]{24,}=*$/.test(value)) return true;
	return false;
}

/** Eligible projects first, longest first. Blank names stay out. Zero minutes stay visible as not eligible. */
export function arrangeHackatimeProjects(projects: HackatimeChoice[]): {
	eligible: HackatimeChoice[];
	later: HackatimeChoice[];
} {
	const visible = projects.filter((project) => project.name.trim() && project.seconds >= 0);
	const byHours = (left: HackatimeChoice, right: HackatimeChoice) => {
		const junk = Number(isJunkHackatimeName(left.name)) - Number(isJunkHackatimeName(right.name));
		if (junk !== 0) return junk;
		if (right.seconds !== left.seconds) return right.seconds - left.seconds;
		return left.name.localeCompare(right.name);
	};
	return {
		eligible: visible.filter((project) => project.eligible).sort(byHours),
		later: visible.filter((project) => !project.eligible).sort(byHours)
	};
}
