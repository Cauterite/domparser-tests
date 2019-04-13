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
running 1641 tests
1641/1641 tests passed
```

# chrome 75:

```

```

unfortunately chrome appears to have a bug where certain classes of XML malformities cause the resulting document to retain comments and processing instructions from the source.

example:

```
let doc = (new DOMParser).parseFromString(
	`<a xmlns="http://www.w3.org/XML/1998/namespace"/><?b?>`, `application/xml`);

console.log(doc.lastChild instanceof ProcessingInstruction);
// → true

console.log(doc.getElementsByTagName(`parsererror`));
// → HTMLCollection [parsererror]
```

this issue has only been observed with namespace-related malformities and causes the following tests to fail:

```
eduni/namespaces/1.0/009.xml
eduni/namespaces/1.0/010.xml
eduni/namespaces/1.0/011.xml
eduni/namespaces/1.0/012.xml
eduni/namespaces/1.0/014.xml
eduni/namespaces/1.0/015.xml
eduni/namespaces/1.0/023.xml
eduni/namespaces/1.0/025.xml
eduni/namespaces/1.0/029.xml
eduni/namespaces/1.0/030.xml
eduni/namespaces/1.0/031.xml
eduni/namespaces/1.0/032.xml
eduni/namespaces/1.0/033.xml
eduni/namespaces/1.0/036.xml
eduni/namespaces/1.0/042.xml
eduni/namespaces/1.0/043.xml
eduni/namespaces/1.0/044.xml
eduni/namespaces/errata-1e/NE13a.xml
eduni/namespaces/errata-1e/NE13b.xml
eduni/namespaces/errata-1e/NE13c.xml
```