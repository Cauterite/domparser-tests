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

const requestTimeoutMs = 60 * 1000;

const tryHttpGetString = async function(url) {
	let resp = await tryHttpGetXml(url);
	if (resp === null) {
		return null;};
	return resp.string;
};

const tryHttpGetXmlDoc = async function(url) {
	let resp = await tryHttpGetXml(url);
	if (resp === null) {
		return null;};
	return resp.document;
};

const tryHttpGetXml = async function(url) {
	try {
		let xhr = await httpGet(url, ``, `application/xml;charset=utf-8`);
		if (!(xhr instanceof XMLHttpRequest)) {
			return null;};
		return {
			string : xhr.responseText,
			document : xhr.responseXML,};
	} catch (x) {
		console.error(x.message);
		return null;};
};

const httpGet = function(url, responseType, respMimeType) {
	if (!(url instanceof URL)) {
		throw new TypeError();};

	return new Promise((resolve, reject) => {
		let onFailure = function() {
			return reject(new Error(
				`GET request to ${url.href} failed with status `
				+`"${this.statusText}"`));
		};

		let onSuccess = function() {
			if (this.status === 200
				/* chrome workaround: */
				|| (this.status === 0 && url.protocol === `file:`))
			{
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

		if (respMimeType !== undefined) {
			xhr.overrideMimeType(respMimeType);};

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
	let resp = await tryHttpGetXml(test.url);
	if (resp === null) {
		console.error(`failed to load test xml ${test.url.href}`);
		return {result : false};
	};

	let expectDoc = resp.document;

	let expectString = ``;
	if (expectDoc !== null) {
		expectString = serialiseXmlNative(expectDoc);
		assert(typeof expectString === `string`);};

	try {
		let actualDoc = tryParseXml(resp.string);

		if (expectDoc === null) {
			assert(actualDoc === null,
				`tryParseXml returned document, but xhr returned null`);
		} else {
			assert(actualDoc !== null,
				`tryParseXml returned null, but xhr returned document`);

			let actualString = serialiseXmlNative(actualDoc);
			assert(actualString === expectString,
				`tryParseXml should not affect the resulting document`);
		};
	} catch (x) {
		let nativeParserDoc = parseXmlNative(resp.string);
		let nativeParserResult =
			nativeParserDoc ? serialiseXmlNative(nativeParserDoc) : null;

		let details = {
			href : test.url.href,
			error : x.message,
			expectWellformed : test.wellformed,
			testXml : resp.string,
			nativeParserResult};

		console.error(`test case failed`, details);
		return {result : false, details};
	};

	return {result : true};
};

const selectorExclude = ``;

const oasisIgnoreList = new Set([]);

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
	/* contain invalid unicode sequences: */
	`not-wf/sa/168.xml`,
	`not-wf/sa/169.xml`,
	`not-wf/sa/170.xml`,]);

const getXmltestTests = async function(baseUrl) {
	let doc = await tryHttpGetXmlDoc(new URL(`./xmltest.xml`, baseUrl));

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
	/* contain invalid unicode sequences: */
	`not-wf/P02/ibm02n30.xml`,
	`not-wf/P02/ibm02n31.xml`,]);

const getIbmTests = async function(baseUrl) {
	let tests = [];

	for (let [dir, name] of [
		/* gecko DOMParser doesn't support xml 1.1 */
		[`./xml-1.1/`, `ibm_valid.xml`],
		[`./xml-1.1/`, `ibm_not-wf.xml`],
		[`./xml-1.1/`, `ibm_valid.xml`],
		[`./`, `ibm_oasis_invalid.xml`],
		[`./`, `ibm_oasis_not-wf.xml`],
		[`./`, `ibm_oasis_valid.xml`],])
	{
		let dirUrl = new URL(dir, baseUrl);

		let doc = await tryHttpGetXmlDoc(new URL(name, dirUrl));

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

const sunIgnoreList = new Set([]);

const getSunTests = async function(baseUrl) {
	let tests = [];

	for (let name of [
		`sun-not-wf.xml`,
		`sun-valid.xml`,
		`sun-error.xml`,
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
	let doc = await tryHttpGetXmlDoc(new URL(`./japanese.xml`, baseUrl));

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
	/* contain invalid unicode sequences: */
	`010.xml`,
	`022.xml`,
	`026.xml`,
	`030.xml`,
	`040.xml`,
	`046.xml`,
	`E27.xml`,
	`006.xml`,]);

const getEduniTests = async function(baseUrl) {
	let tests = [];

	for (let [dir, name] of [
		/* gecko DOMParser doesn't support xml 1.1 */
		[`./xml-1.1/`, `xml11.xml`],
		[`./namespaces/1.1/`, `rmt-ns11.xml`],

		[`./errata-2e/`, `errata2e.xml`],
		[`./errata-3e/`, `errata3e.xml`],
		[`./errata-4e/`, `errata4e.xml`],
		[`./namespaces/1.0/`, `rmt-ns10.xml`],
		[`./namespaces/errata-1e/`, `errata1e.xml`],])
	{
		let dirUrl = new URL(dir, baseUrl);

		let doc = await tryHttpGetXmlDoc(new URL(name, dirUrl));

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
		`blink-75.0.3763.0-win64-eduni-namespaces-1.0-009.xml`,
		`gecko-56.2.5-win64.xml`,
		`blink-75.0.3763.0-win64.xhtml`,]
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
