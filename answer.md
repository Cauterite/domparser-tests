(TLDR: scroll to end)

---

In current browsers, the DOMParser appears to have two possible behaviours when given malformed XML:

1. Discard the resulting document entirely — return a `<parsererror>` document with error details. Firefox and Edge seem to always take this approach; browsers from the Chrome family do this in *most* cases.

2. Return the resulting document with one extra `<parsererror>` inserted as the root element's first child. Chrome's parser does this in cases where it's able to produce a root element despite finding errors in the source XML. The inserted `<parsererror>` may or may not have a namespace. The rest of the document seems to be left intact, including comments, etc. Refer to [xml_errors.cc](https://cs.chromium.org/chromium/src/third_party/blink/renderer/core/xml/parser/xml_errors.cc) — search for `XMLErrors::InsertErrorMessageBlock`.

For (1), the way to detect an error is to add a node to the source string, parse it, check whether the node exists in the resulting document, then remove it. As far as I'm aware, the only way to achieve this without potentially affecting the result is to append a processing instruction or comment to the end of the source.

Example:

```javascript
let key = `a`+Math.random().toString(32);

let doc = (new DOMParser).parseFromString(src+`<?${key}?>`, `application/xml`);

let lastNode = doc.lastChild;
if (!(lastNode instanceof ProcessingInstruction)
	|| lastNode.target !== key
	|| lastNode.data !== ``)
{
	/* the XML was malformed */
} else {
	/* the XML was well-formed */
	doc.removeChild(lastNode);
}
```

If case (2) occurs, the error won't be detected by the above technique, so another step is required.

We can leverage the fact that only one `<parsererror>` is inserted, even if there are multiple errors found in different places within the source. By parsing the source string again, by this time with a syntax error appended, we can ensure the (2) behaviour is triggered, then check whether the number of `<parsererror>` elements has changed — if not, the first `parseFromString` result already contained a true `<parsererror>`.

Example:

```javascript
let errCount = doc.documentElement.getElementsByTagName(`parsererror`).length;
if (errCount !== 0) {
	let doc2 = parser.parseFromString(src+`<?`, `application/xml`);
	if (doc2.documentElement.getElementsByTagName(`parsererror`).length === errCount) {
		/* the XML was malformed */
	}
}
```

---

I put together a test suite to verify this approach: [https://github.com/Cauterite/domparser-tests](https://github.com/Cauterite/domparser-tests).

It tests against the entire [XML W3C Conformance Test Suite](https://www.w3.org/XML/Test/xmlconf-20080827.html), plus a few extra samples to ensure it can distinguish documents containing `<parsererror>` elements from actual errors emitted by the DOMParser. Only a handful of test cases are excluded becase they contain invalid unicode sequences.

To be clear, the suite is only testing whether the result is identical to `XMLHttpRequest.responseXML` for a given document.

You can run the suite yourself at [https://cauterite.github.io/domparser-tests/index.html](https://cauterite.github.io/domparser-tests/index.html), but note that it requires ECMAScript 2018 support.

At time of writing, all tests pass in recent versions of Firefox, Chrome, Safari and Firefox on Android.
Edge should pass since its DOMParser appears to behave like Firefox's, and Opera should pass since it's based on Chromium.
