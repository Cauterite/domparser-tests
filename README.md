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
running 2606 tests
2606/2606 tests passed
```

# firefox 67:

```
userAgent: "Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:67.0) Gecko/20100101 Firefox/67.0"
running 2606 tests
2606/2606 tests passed
```

# chrome 75:

```
userAgent: "Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3764.0 Safari/537.36"
running 2606 tests
2606/2606 tests passed
```

# safari 12:

```
userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Safari/605.1.15"
running 2606 tests
2606/2606 tests passed
```

# firefox 66 (android):

```
userAgent: "Mozilla/5.0 (Android 7.1.2; Mobile; rv:66.0) Gecko/66.0 Firefox/66.0"
running 2606 tests
2606/2606 tests passed
```