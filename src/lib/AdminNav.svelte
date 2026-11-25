<script lang="ts">
	let {
		role = 'owner',
		active = 'none',
		route = '',
		email = '',
		handle = null
	}: {
		role?: 'owner' | 'reviewer';
		active?: 'stats' | 'reviews' | 'reviewers' | 'none';
		route?: string;
		email?: string;
		handle?: string | null;
	} = $props();

	const who = $derived(handle ? `@${handle}` : email);
</script>

<nav class="bar" aria-label="Admin navigation">
	<div class="brand">
		<a class="mini" href={role === 'owner' ? '/admin' : '/reviews'}>fjording it</a>
		<span class="pill">{role === 'owner' ? 'admin' : 'reviewer'}</span>
		{#if route}<span class="route">{route}</span>{/if}
	</div>
	<div class="right">
		<ul>
			{#if role === 'owner'}
				<li><a class:active={active === 'stats'} href="/admin">Stats</a></li>
			{/if}
			<li><a class:active={active === 'reviews'} href="/reviews">Reviews</a></li>
			{#if role === 'owner'}
				<li><a class:active={active === 'reviewers'} href="/admin/reviewers">Reviewers</a></li>
				<li><a href="/reviews?challenge=northern">The Northern Challenge</a></li>
			{/if}
		</ul>
		{#if who}
			<span class="tagwrap">
				<img class="string" src="/hackathon/tag-string.svg" alt="" />
				<span class="tag"><span class="t">{role === 'owner' ? 'admin' : 'reviewer'}</span><b>{who}</b></span>
			</span>
		{/if}
	</div>
</nav>

<style>
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 18px;
		padding: 12px 0 4px;
		flex-wrap: wrap;
		color: #f9f3d5;
		font-family: pirate, 'Noailles Pirate', serif;
		font-size: 19px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}
	.mini {
		font-family: pirate3d, 'Noailles Pirate 3D', serif;
		font-size: 28px;
		text-decoration: none;
		line-height: 1;
		color: inherit;
	}
	.pill {
		font-family: times, 'Noailles Times', serif;
		font-size: 15px;
		background: #7ba35a;
		color: #07160a;
		padding: 2px 8px;
		border: 2px solid #f9f3d5;
	}
	.route {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 13px;
		background: #0d1526;
		color: #f9f3d5;
		padding: 3px 9px;
		border: 2px solid #7ba35a;
	}
	.right {
		display: flex;
		align-items: center;
		gap: 22px;
		flex-wrap: wrap;
	}
	ul {
		display: flex;
		gap: 18px;
		list-style: none;
		margin: 0;
		padding: 0;
		flex-wrap: wrap;
	}
	a {
		color: inherit;
		text-decoration: none;
		padding: 4px 2px;
		border-bottom: 2px solid transparent;
	}
	a:hover {
		border-bottom-color: #2fb3a0;
	}
	a.active {
		border-bottom-color: #7ba35a;
		color: #7ba35a;
	}
	.tagwrap {
		display: inline-flex;
		align-items: center;
	}
	.string {
		width: 24px;
		height: 18px;
		margin-right: -5px;
	}
	.tag {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 7px;
		background: #f9f3d5;
		color: #07160a;
		font-size: 17px;
		line-height: 1.1;
		padding: 4px 12px 4px 22px;
		clip-path: polygon(10px 0, 100% 0, 100% 100%, 10px 100%, 0 calc(100% - 8px), 0 8px);
	}
	.tag::before {
		content: '';
		position: absolute;
		left: 8px;
		top: 50%;
		width: 7px;
		height: 7px;
		margin-top: -3.5px;
		border-radius: 50%;
		background: #07160a;
	}
	.t {
		font-family: times, 'Noailles Times', serif;
		font-size: 14px;
	}
	b {
		font-weight: 400;
		font-size: 18px;
	}
	@media (max-width: 760px) {
		.mini {
			font-size: 23px;
		}
		.string {
			display: none;
		}
		ul {
			gap: 12px;
			font-size: 16px;
		}
	}
</style>
