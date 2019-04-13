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

	if (!(doc instanceof XMLDocument)) {
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
	logInfo(`userAgent: "${navigator.userAgent}"`);

	let docUrl = new URL(document.documentURI);
	let xmltsUrl = new URL(`./xmlts20080827/`, docUrl);

	let tests = [].concat(
		await getIbmTests(new URL(`./ibm/`, xmltsUrl)),
		await getSunTests(new URL(`./sun/`, xmltsUrl)),
		await getOasisTests(new URL(`./oasis/`, xmltsUrl)),
		await getXmltestTests(new URL(`./xmltest/`, xmltsUrl)),
		await getJapTests(new URL(`./japanese/`, xmltsUrl)),
		await getEduniTests(new URL(`./eduni/`, xmltsUrl)),
		await getParserErrorDocTests(new URL(`./parsererror-docs/`, docUrl)));

	let testCount = tests.length;
	let passCount = 0;
	let failDetailsList = [];

	logInfo(`running ${testCount} tests`);

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

	logInfo(`${passCount}/${testCount} tests passed`);

	debugger;
};

const logInfo = function(...args) {
	console.info(...args);
	let log = document.getElementById(`log`);
	log.textContent += args.join(` `);
	log.textContent += `\n`;
};

const assert = function(cond, msg = `assertion failed`) {
	if (!cond) {
		throw new Error(msg);};
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

const selectorExclude = ``
	+`:not([TYPE='error'])`
	/* external entities cause unreliable results in general */
	+`:not([ENTITIES='parameter'])`
	+`:not([ENTITIES='both'])`
	/* gecko DOMParser doesn't support xml 1.1 */
	+`:not([VERSION='1.1'])`
	/* gecko DOMParser doesn't seem to support xml 1.0 5th edition */
	+`:not([EDITION='5'])`;

const oasisIgnoreList = new Set([
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
	`p09fail2.xml`,

	/* blink DOMParser doesn't conform: */
	`p28pass3.xml`,
	`p69pass1.xml`,]);

const getOasisTests = async function(baseUrl) {
	let doc = parseXmlNative(
		await tryHttpGetString(new URL(`./oasis.xml`, baseUrl)));

	if (!(doc instanceof XMLDocument)) {
		console.error(`failed to load oasis test case list`);
		return [];};

	let tests = [];

	for (let test of doc.querySelectorAll(
		`:root > TEST:not([TYPE='not-wf'])${selectorExclude}`))
	{
		let href = test.getAttribute(`URI`);
		if (!oasisIgnoreList.has(href)) {
			tests.push({
				url : new URL(href, baseUrl),
				wellformed : true});
		};
	};

	for (let test of doc.querySelectorAll(
		`:root > TEST[TYPE='not-wf']${selectorExclude}`))
	{
		let href = test.getAttribute(`URI`);
		if (!oasisIgnoreList.has(href)) {
			tests.push({
				url : new URL(href, baseUrl),
				wellformed : false});
		};
	};

	return tests;
};

const xmltestIgnoreList = new Set([
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
	`valid/sa/012.xml`,

	/* blink DOMParser doesn't conform: */
	`valid/sa/097.xml`,
	`valid/sa/070.xml`,
	`valid/not-sa/026.xml`,
	`not-wf/sa/140.xml`,
	`not-wf/sa/141.xml`,
	`valid/not-sa/011.xml`,
	`valid/not-sa/012.xml`,]);

const getXmltestTests = async function(baseUrl) {
	let doc = parseXmlNative(
		await tryHttpGetString(new URL(`./xmltest.xml`, baseUrl)));

	if (!(doc instanceof XMLDocument)) {
		console.error(`failed to load xmltest test case list`);
		return [];};

	let tests = [];

	for (let test of doc.querySelectorAll(
		`:root > TEST:not([TYPE='not-wf'])${selectorExclude}`))
	{
		let href = test.getAttribute(`URI`);
		if (!xmltestIgnoreList.has(href)) {
			tests.push({
				url : new URL(href, baseUrl),
				wellformed : true,});
		};
	};

	for (let test of doc.querySelectorAll(
		`:root > TEST[TYPE='not-wf']${selectorExclude}`))
	{
		let href = test.getAttribute(`URI`);
		if (!xmltestIgnoreList.has(href)) {
			tests.push({
				url : new URL(href, baseUrl),
				wellformed : false,});
		};
	};

	return tests;
};

const ibmIgnoreList = new Set([
	/* gecko DOMParser doesn't conform: */
	`not-wf/P02/ibm02n30.xml`,
	`not-wf/P02/ibm02n31.xml`,
	`not-wf/p28a/ibm28an01.xml`,
	`not-wf/P30/ibm30n01.xml`,
	`not-wf/P31/ibm31n01.xml`,
	`not-wf/P61/ibm61n01.xml`,
	`not-wf/P62/ibm62n01.xml`,
	`not-wf/P62/ibm62n02.xml`,
	`not-wf/P62/ibm62n03.xml`,
	`not-wf/P62/ibm62n04.xml`,
	`not-wf/P62/ibm62n05.xml`,
	`not-wf/P62/ibm62n06.xml`,
	`not-wf/P62/ibm62n07.xml`,
	`not-wf/P62/ibm62n08.xml`,
	`not-wf/P63/ibm63n01.xml`,
	`not-wf/P63/ibm63n02.xml`,
	`not-wf/P63/ibm63n03.xml`,
	`not-wf/P63/ibm63n04.xml`,
	`not-wf/P63/ibm63n05.xml`,
	`not-wf/P63/ibm63n06.xml`,
	`not-wf/P63/ibm63n07.xml`,
	`not-wf/P64/ibm64n01.xml`,
	`not-wf/P64/ibm64n02.xml`,
	`not-wf/P64/ibm64n03.xml`,
	`not-wf/P65/ibm65n01.xml`,
	`not-wf/P65/ibm65n02.xml`,
	`not-wf/P77/ibm77n01.xml`,
	`not-wf/P77/ibm77n02.xml`,
	`not-wf/P77/ibm77n03.xml`,
	`not-wf/P77/ibm77n04.xml`,
	`not-wf/P78/ibm78n01.xml`,
	`not-wf/P78/ibm78n02.xml`,
	`not-wf/P79/ibm79n01.xml`,
	`not-wf/P79/ibm79n02.xml`,
	`valid/P09/ibm09v03.xml`,
	`valid/P09/ibm09v05.xml`,
	`valid/P32/ibm32v02.xml`,]);

const getIbmTests = async function(baseUrl) {
	let tests = [];

	for (let [dir, name] of [
		/* gecko DOMParser doesn't support xml 1.1 */
		// [`./xml-1.1/`, `ibm_valid.xml`],
		// [`./xml-1.1/`, `ibm_not-wf.xml`],
		// [`./xml-1.1/`, `ibm_valid.xml`],

		[`./`, `ibm_oasis_invalid.xml`],
		[`./`, `ibm_oasis_not-wf.xml`],
		[`./`, `ibm_oasis_valid.xml`],])
	{
		let dirUrl = new URL(dir, baseUrl);

		let doc = parseXmlNative(
			await tryHttpGetString(new URL(name, dirUrl)));

		if (!(doc instanceof XMLDocument)) {
			console.error(`failed to load ibm test case list "${name}"`);
			continue;};

		for (let test of doc.querySelectorAll(
			`TEST:not([TYPE='not-wf'])${selectorExclude}`))
		{
			let href = test.getAttribute(`URI`);
			if (!ibmIgnoreList.has(href)) {
				tests.push({
					url : new URL(href, dirUrl),
					wellformed : true,});
			};
		};

		for (let test of doc.querySelectorAll(
			`TEST[TYPE='not-wf']${selectorExclude}`))
		{
			let href = test.getAttribute(`URI`);
			if (!ibmIgnoreList.has(href)) {
				tests.push({
					url : new URL(href, dirUrl),
					wellformed : false,});
			};
		};
	};

	return tests;
};

const sunIgnoreList = new Set([
	/* gecko DOMParser doesn't conform: */
	`not-wf/cond01.xml`,
	`not-wf/cond02.xml`,
	`not-wf/decl01.xml`,
	`not-wf/dtd07.xml`,
	`not-wf/encoding07.xml`,
	`valid/not-sa03.xml`,
	`valid/pe00.xml`,
	/* don't test non-utf8 encodings: */
	`invalid/utf16b.xml`,
	`invalid/utf16l.xml`,]);

const getSunTests = async function(baseUrl) {
	let tests = [];

	for (let name of [
		`sun-not-wf.xml`,
		`sun-valid.xml`,
		//`sun-error.xml`,
		`sun-invalid.xml`,])
	{
		/* the sun test-case lists are (ironically) malformed xml documents: */

		let xml = await tryHttpGetString(new URL(name, baseUrl));
		if (typeof xml !== `string`) {
			console.error(`failed to load sun test case list "${name}"`);
			return tests;};

		for (let s, offset = 0;
			({0 : s} = {.../<TEST[\s\S]+?<\/TEST>/g.exec(xml.slice(offset))})[0]
				!== undefined;
			offset += s.length)
		{
			let doc = parseXmlNative(s);
	
			if (!(doc instanceof XMLDocument)) {
				console.error(`failed to load sun test case list "${name}"`);
				return tests;};
	
			for (let test of doc.querySelectorAll(
				`TEST:not([TYPE='not-wf'])${selectorExclude}`))
			{
				let href = test.getAttribute(`URI`);
				if (!sunIgnoreList.has(href)) {
					tests.push({
						url : new URL(href, baseUrl),
						wellformed : true,});
				};
			};
	
			for (let test of doc.querySelectorAll(
				`TEST[TYPE='not-wf']${selectorExclude}`))
			{
				let href = test.getAttribute(`URI`);
				if (!sunIgnoreList.has(href)) {
					tests.push({
						url : new URL(href, baseUrl),
						wellformed : false,});
				};
			};
		};
	};

	return tests;
};

const japIgnoreList = new Set([
	/* don't test non-utf8 encodings: */
	`pr-xml-euc-jp.xml`,
	`pr-xml-iso-2022-jp.xml`,
	`pr-xml-little-endian.xml`,
	`pr-xml-shift_jis.xml`,
	`pr-xml-utf-16.xml`,
	`weekly-euc-jp.dtd`,
	`weekly-euc-jp.xml`,
	`weekly-iso-2022-jp.dtd`,
	`weekly-iso-2022-jp.xml`,
	`weekly-little-endian.xml`,
	`weekly-shift_jis.dtd`,
	`weekly-shift_jis.xml`,
	`weekly-utf-16.dtd`,
	`weekly-utf-16.xml`,]);

const getJapTests = async function(baseUrl) {
	let doc = parseXmlNative(
		await tryHttpGetString(new URL(`./japanese.xml`, baseUrl)));

	if (!(doc instanceof XMLDocument)) {
		console.error(`failed to load japanese test case list`);
		return [];};

	let tests = [];

	for (let test of doc.querySelectorAll(
		`:root > TEST:not([TYPE='not-wf'])${selectorExclude}`))
	{
		let href = test.getAttribute(`URI`);
		if (!japIgnoreList.has(href)) {
			tests.push({
				url : new URL(href, baseUrl),
				wellformed : true,});
		};
	};

	for (let test of doc.querySelectorAll(
		`:root > TEST[TYPE='not-wf']${selectorExclude}`))
	{
		let href = test.getAttribute(`URI`);
		if (!japIgnoreList.has(href)) {
			tests.push({
				url : new URL(href, baseUrl),
				wellformed : false,});
		};
	};

	return tests;
};

const eduniIgnoreList = new Set([
	`E27.xml`, /* malformed unicode */
	/* gecko DOMParser doesn't conform: */
	`E61.xml`,
	`E38.xml`,
	`E13.xml`,
]);

const getEduniTests = async function(baseUrl) {
	let tests = [];

	for (let [dir, name] of [
		/* gecko DOMParser doesn't support xml 1.1 */
		// [`./xml-1.1/`, `xml11.xml`],
		// [`./namespaces/1.1/`, `rmt-ns11.xml`],

		[`./errata-2e/`, `errata2e.xml`],
		[`./errata-3e/`, `errata3e.xml`],
		[`./errata-4e/`, `errata4e.xml`],
		[`./namespaces/1.0/`, `rmt-ns10.xml`],
		[`./namespaces/errata-1e/`, `errata1e.xml`],])
	{
		let dirUrl = new URL(dir, baseUrl);

		let doc = parseXmlNative(
			await tryHttpGetString(new URL(name, dirUrl)));

		if (!(doc instanceof XMLDocument)) {
			console.error(`failed to load eduni test case list "${name}"`);
			continue;};

		for (let test of doc.querySelectorAll(
			`TEST:not([TYPE='not-wf'])${selectorExclude}`))
		{
			let href = test.getAttribute(`URI`);
			if (!eduniIgnoreList.has(href)) {
				tests.push({
					url : new URL(href, dirUrl),
					wellformed : true,});
			};
		};

		for (let test of doc.querySelectorAll(
			`TEST[TYPE='not-wf']${selectorExclude}`))
		{
			let href = test.getAttribute(`URI`);
			if (!eduniIgnoreList.has(href)) {
				tests.push({
					url : new URL(href, dirUrl),
					wellformed : false,});
			};
		};
	};

	return tests;
};

const getParserErrorDocTests = async function(baseUrl) {
	return [
		`blink-75.0.3763.0-win64.xhtml`,
		`gecko-56.2.5-win64.xml`,]
		.map(href => ({
			url : new URL(href, baseUrl),
			wellformed : true,}));
};

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */

/*




























































*/

/* -------------------------------------------------------------------------- */
