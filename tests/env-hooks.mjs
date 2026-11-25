const stub = new URL('./env-stub.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
	if (specifier === '$env/dynamic/private') {
		return { url: stub, shortCircuit: true };
	}
	try {
		return await next(specifier, context);
	} catch (err) {
		const relative = specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('#lib/');
		if (!relative) throw err;
		for (const suffix of ['.ts', '.js', '/index.ts']) {
			try {
				return await next(specifier + suffix, context);
			} catch {
				/* try the next suffix */
			}
		}
		throw err;
	}
}
