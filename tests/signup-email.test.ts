import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkSignupEmail, normalizeSignupEmail } from '../src/lib/signup-email.ts'

test('whitespace and invisible characters are stripped, and the domain is lowercased', () => {
	assert.equal(normalizeSignupEmail('  Ada@HackClub.com \n'), 'ada@hackclub.com')
	assert.equal(normalizeSignupEmail('lmn_0304@gmail.com\u200b'), 'lmn_0304@gmail.com')
	assert.equal(normalizeSignupEmail('\u00a0palakkumaraalooo@gmail.co\u200b'), 'palakkumaraalooo@gmail.co')
})

test('the two broken sign-ups are refused before they could be saved', () => {
	const typo = checkSignupEmail('palakkumaraalooo@gmail.co')
	assert.equal(typo.ok, false)
	if (!typo.ok) assert.equal(typo.error, 'did you mean palakkumaraalooo@gmail.com?')

	const underscore = checkSignupEmail(' lmn_0304@gmail.com ')
	assert.equal(underscore.ok, false)
	if (!underscore.ok) assert.equal(underscore.error, "gmail addresses can't use that")
})

test('common domain typos get a suggestion, and real domains do not', () => {
	for (const [bad, good] of [
		['ada@gmial.com', 'ada@gmail.com'],
		['ada@gmai.com', 'ada@gmail.com'],
		['ada@hotmial.com', 'ada@hotmail.com'],
		['ada@yahoo.co', 'ada@yahoo.com'],
		['ada@googlemail.co', 'ada@googlemail.com']
	] as const) {
		const result = checkSignupEmail(bad)
		assert.equal(result.ok, false)
		if (!result.ok) assert.equal(result.error, `did you mean ${good}?`)
	}
	assert.equal(checkSignupEmail('ada@yahoo.co.uk').ok, true)
	assert.equal(checkSignupEmail('ada@company.co').ok, true)
	assert.equal(checkSignupEmail('ada@hackclub.com').ok, true)
})

test('gmail local parts stay strict, and other providers keep their own characters', () => {
	assert.equal(checkSignupEmail('ada.lovelace+fjord@gmail.com').ok, true)
	assert.equal(checkSignupEmail('ada.lovelace+fjord@googlemail.com').ok, true)
	assert.equal(checkSignupEmail('ada-lovelace@gmail.com').ok, false)
	assert.equal(checkSignupEmail('.ada@gmail.com').ok, false)
	assert.equal(checkSignupEmail('ada..lovelace@gmail.com').ok, false)
	assert.equal(checkSignupEmail('ada_lovelace@yahoo.com').ok, true)
	assert.equal(checkSignupEmail('ada_lovelace@hackclub.com').ok, true)
	assert.equal(checkSignupEmail('not an email').ok, false)
	assert.equal(checkSignupEmail('ada@').ok, false)
})
