/* -------------------------------------------------------------------------- */

'use strict';

/* -------------------------------------------------------------------------- */

const tryParseXml = function(src) {
	/* DOMParser.parseFromString() may return a <parsererror> document instead
	of throwing when the input is malformed

	while this solution seems to reliably identify malformed xml,
	it unfortunately cannot prevent 'XML Parsing Error:' messages from being
	written to the console */

	if (typeof src !== `string`) {
		return null;};

	let key = `a`+Math.random().toString(32);

	let doc = null;
	try {
		doc = (new DOMParser).parseFromString(
			src+`<?${key}?>`, `application/xml`);
	} catch (x) {};

	if (!(doc instanceof Document)) {
		return null;};

	let lastNode = doc.lastChild;
	if (!(lastNode instanceof ProcessingInstruction)
		|| lastNode.target !== key
		|| lastNode.data !== ``)
	{
		return null;};

	doc.removeChild(lastNode);

	return doc;
};

/* -------------------------------------------------------------------------- */

const requestTimeoutMs = 10000;

const tryHttpGetString = async function(url) {
	try {
		let xhr = await httpGet(url, `text`);
		if (!(xhr instanceof XMLHttpRequest)) {
			return undefined;};
		return xhr.responseText;
	} catch (x) {
		console.error(x.message);
		return undefined;};
};

const httpGet = function(url, responseType) {
	if (!(url instanceof URL)) {
		throw new TypeError();};

	return new Promise((resolve, reject) => {
		let onFailure = function() {
			return reject(new Error(
				`GET request to ${url.href} failed with status `
				+`"${this.statusText}"`));
		};

		let onSuccess = function() {
			if (this.status === 200) {
				return resolve(this);
			} else {
				return onFailure.call(this);};
		};

		let xhr = Object.assign(new XMLHttpRequest, {
			responseType,
			timeout : requestTimeoutMs,
			onload : onSuccess,
			onabort : onFailure,
			onerror : onFailure,
			ontimeout : onFailure,});
		xhr.open(`GET`, url.href);
		xhr.send();
	});
};

/* -------------------------------------------------------------------------- */

const entrypoint = async function() {
	let docUrl = new URL(document.documentURI);
	let xmltsUrl = new URL(`./xmlts20080827/`, docUrl);

	let tests = [].concat(
		await getOasisTests(new URL(`./oasis/`, xmltsUrl)));

	let testCount = tests.length;
	let passCount = 0;

	await Promise.all(
		tests
			.map(async (t) => {
				if (await performTest(t)) {
					++passCount;};}));

	console.info(`${passCount}/${testCount} tests passed`);

	debugger;
};

const assert = function(cond, msg = `assertion failed`) {
	if (!cond) {
		debugger;
		throw new Error(msg);
	};
};

const performTest = async function(test) {
	let xml = await tryHttpGetString(test.url);
	if (typeof xml !== `string`) {
		console.error(`failed to load test xml ${test.url.href}`);
		return false;
	};

	try {
		if (test.wellformed) {
			let doc = tryParseXml(xml);
			assert(doc !== null,
				`well-formed xml should parse successfully`);
	
			let expectDoc =
				(new DOMParser).parseFromString(xml, `application/xml`);
			let expectString = (new XMLSerializer).serializeToString(expectDoc);
			let actualString = (new XMLSerializer).serializeToString(doc);
	
			assert(actualString === expectString,
				`tryParseXml should not affect the resulting document`);
	
		} else {
			assert(tryParseXml(xml) === null,
				`malformed xml should fail to parse`);
		};
	} catch (x) {
		console.error(`test case failed`, {
			href : test.url.href,
			error : x.message,
			wellformed : test.wellformed,
			xml,});
		return false;
	};

	return true;
};

let oasisBlacklist = new Set([
	/* DOMParser doesn't like grave accent in tag name: */
	`p04pass1.xml`,

	/* DOMParser doesn't like `.` after `:` in tag name: */
	`p05pass1.xml`,

	/* DTD errors which DOMParser doesn't care about: */
	`p61fail1.xml`,
	`p62fail1.xml`,
	`p62fail2.xml`,
	`p63fail1.xml`,
	`p63fail2.xml`,
	`p64fail1.xml`,
	`p64fail2.xml`,
	`p31fail1.xml`,
	`p30fail1.xml`,
	`p09fail1.xml`,
	`p09fail2.xml`,]);

const getOasisTests = async function(baseUrl) {
	let doc = tryParseXml(
		await tryHttpGetString(new URL(`./oasis.xml`, baseUrl)));

	if (doc === null) {
		console.error(`failed to load oasis test case list`);
		return [];};

	let tests = [];

	for (let test of doc.querySelectorAll(
		`:root > TEST:not([TYPE='not-wf'])`))
	{
		let href = test.getAttribute(`URI`);
		if (!oasisBlacklist.has(href)) {
			tests.push({
				url : new URL(href, baseUrl),
				wellformed : true});
		};
	};

	for (let test of doc.querySelectorAll(
		`:root > TEST[TYPE='not-wf']`))
	{
		let href = test.getAttribute(`URI`);
		if (!oasisBlacklist.has(href)) {
			tests.push({
				url : new URL(href, baseUrl),
				wellformed : false});
		};
	};

	return tests;
};

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */

/*




























































*/

/* -------------------------------------------------------------------------- */
