(TLDR: scroll to end)

---

In current browsers, the DOMParser appears to have two possible behaviours when given malformed XML:

1. Discard the resulting document entirely — return a `<parsererror>` document with error details. Firefox and Edge seem to always take this approach; browsers from the Chrome family do this in *most* cases.

2. Return the resulting document with one extra `<parsererror>` inserted as the root element's first child. Chrome's parser does this in cases where it's able to produce a root element despite finding errors in the source XML. The inserted `<parsererror>` may or may not have a namespace. The rest of the document seems to be left intact, including comments, etc.

For (1), the way to detect an error is to add a node to the source string, parse it, check whether the node exists in the resulting document, then remove it. As far as I'm aware, the only way to achieve this without potentially affecting the result is to append a processing instruction or comment to the end of the source.

Example:

```javascript
let key = `a`+Math.random().toString(32);

let doc = (new DOMParser).parseFromString(
	src+`<?${key}?>`, `application/xml`);

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
