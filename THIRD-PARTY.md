# Third-party material

## busycode — the chrome

`src/chrome.ts` carries per-client decor — spinner and thinking frames,
banners, tips, status rows, and the grammar of a tool call — taken from
[**busycode**](https://github.com/monk-lee/busycode) by monk-lee
(MonkLabs). busycode is a browser app that draws these clients in a web
page; it runs no command and speaks no hook. What it carries, and what
was borrowed, is the observed screen.

**Nothing else came from it.** The dialects, the hook call, the capture
and the comparison are this repo's own.

**And borrowed is not measured.** Those constants are one developer's
rendering of a screen, second-hand — unlike every dialect in
`src/dialects.ts`, each of which was read in its client's own reference.
`src/chrome.ts` marks each block `borrowed` for that reason. The way to
promote one is `simcli capture` against the real client and `simcli
compare` against what this plays.

### busycode licence

```
MIT License

Copyright (c) 2026 MonkLabs

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```
