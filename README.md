this repository exists to address the following issue(s):

"DOMParser Error handling" —
https://developer.mozilla.org/en-US/docs/Web/API/DOMParser#Error_handling

"How do I detect XML parsing errors when using Javascript's DOMParser in a cross-browser way?" —
https://stackoverflow.com/questions/11563554/

"How to check if DOM Parser was successful?" —
https://stackoverflow.com/questions/41212080

---

test cases `/xmlts20080827/*` borrowed from: https://www.w3.org/XML/Test/xmlconf-20080827.html

---

# firefox 56:

```
userAgent: "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:56.0; Waterfox) Gecko/20100101 Firefox/56.2.5"
running 2597 tests
2597/2597 tests passed
```

# chrome 75:

```
userAgent: "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3764.0 Safari/537.36"
running 2597 tests
2540/2597 tests passed
```

unfortunately chrome appears to have a bug where certain classes of XML malformities cause the resulting document to retain comments and processing instructions from the source.

example:

```javascript
let doc = (new DOMParser).parseFromString(
	`<a xmlns="http://www.w3.org/XML/1998/namespace"/><?b?>`, `application/xml`);

console.log(doc.lastChild instanceof ProcessingInstruction);
// → true

console.log(doc.getElementsByTagName(`parsererror`));
// → HTMLCollection [parsererror]
```