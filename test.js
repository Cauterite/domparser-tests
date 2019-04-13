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

			//if (expectString.includes(`parsererror`)) {
			//	debugger;};

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
	`valid/P32/ibm32v02.xml`,

	/* blink DOMParser doesn't conform: */
	`invalid/P76/ibm76i01.xml`,
	`not-wf/P82/ibm82n03.xml`,
	`not-wf/P85/ibm85n03.xml`,
	`not-wf/P85/ibm85n04.xml`,
	`not-wf/P85/ibm85n05.xml`,
	`not-wf/P85/ibm85n06.xml`,
	`not-wf/P85/ibm85n07.xml`,
	`not-wf/P85/ibm85n08.xml`,
	`not-wf/P85/ibm85n09.xml`,
	`not-wf/P85/ibm85n10.xml`,
	`not-wf/P85/ibm85n100.xml`,
	`not-wf/P85/ibm85n101.xml`,
	`not-wf/P85/ibm85n102.xml`,
	`not-wf/P85/ibm85n103.xml`,
	`not-wf/P85/ibm85n104.xml`,
	`not-wf/P85/ibm85n105.xml`,
	`not-wf/P85/ibm85n106.xml`,
	`not-wf/P85/ibm85n107.xml`,
	`not-wf/P85/ibm85n108.xml`,
	`not-wf/P85/ibm85n109.xml`,
	`not-wf/P85/ibm85n11.xml`,
	`not-wf/P85/ibm85n110.xml`,
	`not-wf/P85/ibm85n111.xml`,
	`not-wf/P85/ibm85n112.xml`,
	`not-wf/P85/ibm85n113.xml`,
	`not-wf/P85/ibm85n114.xml`,
	`not-wf/P85/ibm85n115.xml`,
	`not-wf/P85/ibm85n116.xml`,
	`not-wf/P85/ibm85n117.xml`,
	`not-wf/P85/ibm85n118.xml`,
	`not-wf/P85/ibm85n119.xml`,
	`not-wf/P85/ibm85n12.xml`,
	`not-wf/P85/ibm85n120.xml`,
	`not-wf/P85/ibm85n121.xml`,
	`not-wf/P85/ibm85n122.xml`,
	`not-wf/P85/ibm85n123.xml`,
	`not-wf/P85/ibm85n124.xml`,
	`not-wf/P85/ibm85n125.xml`,
	`not-wf/P85/ibm85n126.xml`,
	`not-wf/P85/ibm85n127.xml`,
	`not-wf/P85/ibm85n128.xml`,
	`not-wf/P85/ibm85n129.xml`,
	`not-wf/P85/ibm85n13.xml`,
	`not-wf/P85/ibm85n130.xml`,
	`not-wf/P85/ibm85n131.xml`,
	`not-wf/P85/ibm85n132.xml`,
	`not-wf/P85/ibm85n133.xml`,
	`not-wf/P85/ibm85n134.xml`,
	`not-wf/P85/ibm85n135.xml`,
	`not-wf/P85/ibm85n136.xml`,
	`not-wf/P85/ibm85n137.xml`,
	`not-wf/P85/ibm85n138.xml`,
	`not-wf/P85/ibm85n139.xml`,
	`not-wf/P85/ibm85n14.xml`,
	`not-wf/P85/ibm85n140.xml`,
	`not-wf/P85/ibm85n141.xml`,
	`not-wf/P85/ibm85n142.xml`,
	`not-wf/P85/ibm85n143.xml`,
	`not-wf/P85/ibm85n144.xml`,
	`not-wf/P85/ibm85n145.xml`,
	`not-wf/P85/ibm85n146.xml`,
	`not-wf/P85/ibm85n147.xml`,
	`not-wf/P85/ibm85n148.xml`,
	`not-wf/P85/ibm85n149.xml`,
	`not-wf/P85/ibm85n15.xml`,
	`not-wf/P85/ibm85n150.xml`,
	`not-wf/P85/ibm85n151.xml`,
	`not-wf/P85/ibm85n152.xml`,
	`not-wf/P85/ibm85n153.xml`,
	`not-wf/P85/ibm85n154.xml`,
	`not-wf/P85/ibm85n155.xml`,
	`not-wf/P85/ibm85n156.xml`,
	`not-wf/P85/ibm85n157.xml`,
	`not-wf/P85/ibm85n158.xml`,
	`not-wf/P85/ibm85n159.xml`,
	`not-wf/P85/ibm85n16.xml`,
	`not-wf/P85/ibm85n160.xml`,
	`not-wf/P85/ibm85n161.xml`,
	`not-wf/P85/ibm85n162.xml`,
	`not-wf/P85/ibm85n163.xml`,
	`not-wf/P85/ibm85n164.xml`,
	`not-wf/P85/ibm85n165.xml`,
	`not-wf/P85/ibm85n166.xml`,
	`not-wf/P85/ibm85n167.xml`,
	`not-wf/P85/ibm85n168.xml`,
	`not-wf/P85/ibm85n169.xml`,
	`not-wf/P85/ibm85n17.xml`,
	`not-wf/P85/ibm85n170.xml`,
	`not-wf/P85/ibm85n171.xml`,
	`not-wf/P85/ibm85n172.xml`,
	`not-wf/P85/ibm85n173.xml`,
	`not-wf/P85/ibm85n174.xml`,
	`not-wf/P85/ibm85n175.xml`,
	`not-wf/P85/ibm85n176.xml`,
	`not-wf/P85/ibm85n177.xml`,
	`not-wf/P85/ibm85n178.xml`,
	`not-wf/P85/ibm85n179.xml`,
	`not-wf/P85/ibm85n18.xml`,
	`not-wf/P85/ibm85n180.xml`,
	`not-wf/P85/ibm85n181.xml`,
	`not-wf/P85/ibm85n182.xml`,
	`not-wf/P85/ibm85n183.xml`,
	`not-wf/P85/ibm85n184.xml`,
	`not-wf/P85/ibm85n185.xml`,
	`not-wf/P85/ibm85n186.xml`,
	`not-wf/P85/ibm85n187.xml`,
	`not-wf/P85/ibm85n188.xml`,
	`not-wf/P85/ibm85n189.xml`,
	`not-wf/P85/ibm85n19.xml`,
	`not-wf/P85/ibm85n190.xml`,
	`not-wf/P85/ibm85n191.xml`,
	`not-wf/P85/ibm85n192.xml`,
	`not-wf/P85/ibm85n193.xml`,
	`not-wf/P85/ibm85n194.xml`,
	`not-wf/P85/ibm85n195.xml`,
	`not-wf/P85/ibm85n196.xml`,
	`not-wf/P85/ibm85n197.xml`,
	`not-wf/P85/ibm85n198.xml`,
	`not-wf/P85/ibm85n20.xml`,
	`not-wf/P85/ibm85n21.xml`,
	`not-wf/P85/ibm85n22.xml`,
	`not-wf/P85/ibm85n23.xml`,
	`not-wf/P85/ibm85n24.xml`,
	`not-wf/P85/ibm85n25.xml`,
	`not-wf/P85/ibm85n26.xml`,
	`not-wf/P85/ibm85n27.xml`,
	`not-wf/P85/ibm85n28.xml`,
	`not-wf/P85/ibm85n29.xml`,
	`not-wf/P85/ibm85n30.xml`,
	`not-wf/P85/ibm85n31.xml`,
	`not-wf/P85/ibm85n32.xml`,
	`not-wf/P85/ibm85n33.xml`,
	`not-wf/P85/ibm85n34.xml`,
	`not-wf/P85/ibm85n35.xml`,
	`not-wf/P85/ibm85n36.xml`,
	`not-wf/P85/ibm85n37.xml`,
	`not-wf/P85/ibm85n38.xml`,
	`not-wf/P85/ibm85n39.xml`,
	`not-wf/P85/ibm85n40.xml`,
	`not-wf/P85/ibm85n41.xml`,
	`not-wf/P85/ibm85n42.xml`,
	`not-wf/P85/ibm85n43.xml`,
	`not-wf/P85/ibm85n44.xml`,
	`not-wf/P85/ibm85n45.xml`,
	`not-wf/P85/ibm85n46.xml`,
	`not-wf/P85/ibm85n47.xml`,
	`not-wf/P85/ibm85n48.xml`,
	`not-wf/P85/ibm85n49.xml`,
	`not-wf/P85/ibm85n50.xml`,
	`not-wf/P85/ibm85n51.xml`,
	`not-wf/P85/ibm85n52.xml`,
	`not-wf/P85/ibm85n53.xml`,
	`not-wf/P85/ibm85n54.xml`,
	`not-wf/P85/ibm85n55.xml`,
	`not-wf/P85/ibm85n56.xml`,
	`not-wf/P85/ibm85n57.xml`,
	`not-wf/P85/ibm85n58.xml`,
	`not-wf/P85/ibm85n59.xml`,
	`not-wf/P85/ibm85n60.xml`,
	`not-wf/P85/ibm85n61.xml`,
	`not-wf/P85/ibm85n62.xml`,
	`not-wf/P85/ibm85n63.xml`,
	`not-wf/P85/ibm85n64.xml`,
	`not-wf/P85/ibm85n65.xml`,
	`not-wf/P85/ibm85n66.xml`,
	`not-wf/P85/ibm85n67.xml`,
	`not-wf/P85/ibm85n68.xml`,
	`not-wf/P85/ibm85n69.xml`,
	`not-wf/P85/ibm85n70.xml`,
	`not-wf/P85/ibm85n71.xml`,
	`not-wf/P85/ibm85n72.xml`,
	`not-wf/P85/ibm85n73.xml`,
	`not-wf/P85/ibm85n74.xml`,
	`not-wf/P85/ibm85n75.xml`,
	`not-wf/P85/ibm85n76.xml`,
	`not-wf/P85/ibm85n77.xml`,
	`not-wf/P85/ibm85n78.xml`,
	`not-wf/P85/ibm85n79.xml`,
	`not-wf/P85/ibm85n80.xml`,
	`not-wf/P85/ibm85n81.xml`,
	`not-wf/P85/ibm85n82.xml`,
	`not-wf/P85/ibm85n83.xml`,
	`not-wf/P85/ibm85n84.xml`,
	`not-wf/P85/ibm85n85.xml`,
	`not-wf/P85/ibm85n86.xml`,
	`not-wf/P85/ibm85n87.xml`,
	`not-wf/P85/ibm85n88.xml`,
	`not-wf/P85/ibm85n89.xml`,
	`not-wf/P85/ibm85n90.xml`,
	`not-wf/P85/ibm85n91.xml`,
	`not-wf/P85/ibm85n92.xml`,
	`not-wf/P85/ibm85n93.xml`,
	`not-wf/P85/ibm85n94.xml`,
	`not-wf/P85/ibm85n95.xml`,
	`not-wf/P85/ibm85n96.xml`,
	`not-wf/P85/ibm85n97.xml`,
	`not-wf/P85/ibm85n98.xml`,
	`not-wf/P85/ibm85n99.xml`,
	`not-wf/P86/ibm86n01.xml`,
	`not-wf/P86/ibm86n02.xml`,
	`not-wf/P86/ibm86n03.xml`,
	`not-wf/P86/ibm86n04.xml`,
	`not-wf/P87/ibm87n01.xml`,
	`not-wf/P87/ibm87n02.xml`,
	`not-wf/P87/ibm87n03.xml`,
	`not-wf/P87/ibm87n04.xml`,
	`not-wf/P87/ibm87n05.xml`,
	`not-wf/P87/ibm87n06.xml`,
	`not-wf/P87/ibm87n07.xml`,
	`not-wf/P87/ibm87n08.xml`,
	`not-wf/P87/ibm87n09.xml`,
	`not-wf/P87/ibm87n10.xml`,
	`not-wf/P87/ibm87n11.xml`,
	`not-wf/P87/ibm87n12.xml`,
	`not-wf/P87/ibm87n13.xml`,
	`not-wf/P87/ibm87n14.xml`,
	`not-wf/P87/ibm87n15.xml`,
	`not-wf/P87/ibm87n16.xml`,
	`not-wf/P87/ibm87n17.xml`,
	`not-wf/P87/ibm87n18.xml`,
	`not-wf/P87/ibm87n19.xml`,
	`not-wf/P87/ibm87n20.xml`,
	`not-wf/P87/ibm87n21.xml`,
	`not-wf/P87/ibm87n22.xml`,
	`not-wf/P87/ibm87n23.xml`,
	`not-wf/P87/ibm87n24.xml`,
	`not-wf/P87/ibm87n25.xml`,
	`not-wf/P87/ibm87n26.xml`,
	`not-wf/P87/ibm87n27.xml`,
	`not-wf/P87/ibm87n28.xml`,
	`not-wf/P87/ibm87n29.xml`,
	`not-wf/P87/ibm87n30.xml`,
	`not-wf/P87/ibm87n31.xml`,
	`not-wf/P87/ibm87n32.xml`,
	`not-wf/P87/ibm87n33.xml`,
	`not-wf/P87/ibm87n34.xml`,
	`not-wf/P87/ibm87n35.xml`,
	`not-wf/P87/ibm87n36.xml`,
	`not-wf/P87/ibm87n37.xml`,
	`not-wf/P87/ibm87n38.xml`,
	`not-wf/P87/ibm87n39.xml`,
	`not-wf/P87/ibm87n40.xml`,
	`not-wf/P87/ibm87n41.xml`,
	`not-wf/P87/ibm87n42.xml`,
	`not-wf/P87/ibm87n43.xml`,
	`not-wf/P87/ibm87n44.xml`,
	`not-wf/P87/ibm87n45.xml`,
	`not-wf/P87/ibm87n46.xml`,
	`not-wf/P87/ibm87n47.xml`,
	`not-wf/P87/ibm87n48.xml`,
	`not-wf/P87/ibm87n49.xml`,
	`not-wf/P87/ibm87n50.xml`,
	`not-wf/P87/ibm87n51.xml`,
	`not-wf/P87/ibm87n52.xml`,
	`not-wf/P87/ibm87n53.xml`,
	`not-wf/P87/ibm87n54.xml`,
	`not-wf/P87/ibm87n55.xml`,
	`not-wf/P87/ibm87n56.xml`,
	`not-wf/P87/ibm87n57.xml`,
	`not-wf/P87/ibm87n58.xml`,
	`not-wf/P87/ibm87n59.xml`,
	`not-wf/P87/ibm87n60.xml`,
	`not-wf/P87/ibm87n61.xml`,
	`not-wf/P87/ibm87n62.xml`,
	`not-wf/P87/ibm87n63.xml`,
	`not-wf/P87/ibm87n64.xml`,
	`not-wf/P87/ibm87n66.xml`,
	`not-wf/P87/ibm87n67.xml`,
	`not-wf/P87/ibm87n68.xml`,
	`not-wf/P87/ibm87n69.xml`,
	`not-wf/P87/ibm87n70.xml`,
	`not-wf/P87/ibm87n71.xml`,
	`not-wf/P87/ibm87n72.xml`,
	`not-wf/P87/ibm87n73.xml`,
	`not-wf/P87/ibm87n74.xml`,
	`not-wf/P87/ibm87n75.xml`,
	`not-wf/P87/ibm87n76.xml`,
	`not-wf/P87/ibm87n77.xml`,
	`not-wf/P87/ibm87n78.xml`,
	`not-wf/P87/ibm87n79.xml`,
	`not-wf/P87/ibm87n80.xml`,
	`not-wf/P87/ibm87n81.xml`,
	`not-wf/P87/ibm87n82.xml`,
	`not-wf/P87/ibm87n83.xml`,
	`not-wf/P87/ibm87n84.xml`,
	`not-wf/P87/ibm87n85.xml`,
	`not-wf/P88/ibm88n03.xml`,
	`not-wf/P88/ibm88n04.xml`,
	`not-wf/P88/ibm88n05.xml`,
	`not-wf/P88/ibm88n06.xml`,
	`not-wf/P88/ibm88n08.xml`,
	`not-wf/P88/ibm88n09.xml`,
	`not-wf/P88/ibm88n10.xml`,
	`not-wf/P88/ibm88n11.xml`,
	`not-wf/P88/ibm88n12.xml`,
	`not-wf/P88/ibm88n13.xml`,
	`not-wf/P88/ibm88n14.xml`,
	`not-wf/P88/ibm88n15.xml`,
	`not-wf/P88/ibm88n16.xml`,
	`not-wf/P89/ibm89n03.xml`,
	`not-wf/P89/ibm89n04.xml`,
	`not-wf/P89/ibm89n05.xml`,]);

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
		`gecko-56.2.5-win64.xml`,
		`blink-75.0.3763.0-win64.xhtml`,]
		.map(href => ({
			url : new URL(href, baseUrl),
			wellformed : true,}));

	/* sometimes chrome doesn't even bother to omit the malformed element from
		the parsererror document: */
	// `blink-75.0.3763.0-win64-eduni-namespaces-1.0-009.xml`,
};

/* -------------------------------------------------------------------------- */

entrypoint();

/* -------------------------------------------------------------------------- */

/*




























































*/

/* -------------------------------------------------------------------------- */
