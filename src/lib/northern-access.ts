/** Public participant pages stay off until Johnny sets NORTHERN_PUBLIC=true. */
export function northernIsPublic(value: string | undefined): boolean {
	return value?.trim().toLowerCase() === 'true';
}
