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

const parseXmlNative = function(src) {
	if (typeof src !== `string`) {
		return null;};

	return (new DOMParser).parseFromString(src, `application/xml`);
};

const serialiseXmlNative = function(doc) {
	if (!(doc instanceof Document)) {
		throw new TypeError();};

	return (new XMLSerializer).serializeToString(doc);
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
		await getOasisTests(new URL(`./oasis/`, xmltsUrl)),
		await getXmltestTests(new URL(`./xmltest/`, xmltsUrl)));

	let testCount = tests.length;
	let passCount = 0;
	let failDetailsList = [];

	console.info(
		`running ${testCount} tests; userAgent: "${navigator.userAgent}"`);

	try {
		await Promise.all(
			tests.map(async (t) => {
				let {result, details} = await performTest(t);
				if (result) {
					++passCount;
				} else {
					failDetailsList.push(details);
				};
			}));
	} catch (x) {
		debugger;
	};

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
		return {result : false};
	};

	let expectDoc = parseXmlNative(xml);
	let expectString = serialiseXmlNative(expectDoc);

	try {
		if (test.wellformed) {
			let doc = tryParseXml(xml);
			assert(doc !== null,
				`well-formed xml should parse successfully`);

			let actualString = serialiseXmlNative(doc);

			assert(actualString === expectString,
				`tryParseXml should not affect the resulting document`);

		} else {
			assert(tryParseXml(xml) === null,
				`malformed xml should fail to parse`);
		};
	} catch (x) {
		let details = {
			href : test.url.href,
			error : x.message,
			wellformed : test.wellformed,
			xml,
			nativeParserResult : expectString};

		console.error(`test case failed`, details);
		return {result : false, details};
	};

	return {result : true};
};

const oasisBlacklist = new Set([
	/* gecko DOMParser doesn't like grave accent in tag name: */
	`p04pass1.xml`,

	/* gecko DOMParser doesn't like `.` after `:` in tag name: */
	`p05pass1.xml`,

	/* DTD errors which gecko DOMParser doesn't care about: */
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

const xmltestBlacklist = new Set([
	/* gecko DOMParser doesn't conform: */
	`valid/sa/051.xml`,
	`valid/sa/050.xml`,
	`valid/sa/049.xml`,
	`valid/not-sa/031.xml`,
	`not-wf/sa/170.xml`,
	`not-wf/sa/169.xml`,
	`not-wf/sa/168.xml`,
	`not-wf/not-sa/001.xml`,
	`not-wf/ext-sa/003.xml`,
	`not-wf/ext-sa/002.xml`,
	`not-wf/ext-sa/001.xml`,
	`not-wf/not-sa/009.xml`,
	`not-wf/not-sa/008.xml`,
	`not-wf/not-sa/007.xml`,
	`not-wf/not-sa/006.xml`,
	`not-wf/not-sa/004.xml`,
	`not-wf/not-sa/003.xml`,
	`valid/sa/012.xml`,]);

const getXmltestTests = async function(baseUrl) {
	let doc = tryParseXml(
		await tryHttpGetString(new URL(`./xmltest.xml`, baseUrl)));

	if (doc === null) {
		console.error(`failed to load xmltest test case list`);
		return [];};

	let tests = [];

	for (let test of doc.querySelectorAll(
		`:root > TEST:not([TYPE='not-wf'])`))
	{
		let href = test.getAttribute(`URI`);
		if (!xmltestBlacklist.has(href)) {
			tests.push({
				url : new URL(href, baseUrl),
				wellformed : true});
		};
	};

	for (let test of doc.querySelectorAll(
		`:root > TEST[TYPE='not-wf']`))
	{
		let href = test.getAttribute(`URI`);
		if (!xmltestBlacklist.has(href)) {
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
