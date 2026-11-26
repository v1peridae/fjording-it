<script lang="ts">
	type Link = { href: string; label: string };
	let { home, links, label }: { home: string; links: Link[]; label: string | null } = $props();
</script>

<nav>
	<a class="mini" href={home}>fjording it</a>
	<div class="right">
		<ul>
			{#each links as link (link.href)}
				<li class:opt={link.label === 'prizes' || link.label === 'rules'}>
					<a href={link.href}>{link.label}</a>
				</li>
			{/each}
		</ul>
		{#if label}
			<span class="tagwrap">
				<img class="string" src="/hackathon/tag-string.svg" alt="" />
				<span class="tag"><span class="t">signed in as</span><b>{label}</b></span>
			</span>
			<form method="POST" action="/hackathon?/signout">
				<button class="signout" type="submit">sign out</button>
			</form>
		{/if}
	</div>
</nav>
