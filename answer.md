(TLDR: scroll to end)

---

In current browsers, the DOMParser appears to have two possible behaviours when given malformed XML:

1. Discard the original document entirely — return a `<parsererror>` document with error details. Firefox and Edge seem to always take this approach; browsers from the Chrome family do this in *most* cases.
