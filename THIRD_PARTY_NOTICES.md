# Third-party notices

## Design reference: earth-moon-solar

Orrery's feature set was inspired by Ethan Rogers' *Earth, Moon, and Solar System explorer*
(https://github.com/ethanplusai/earth-moon-solar, live at https://earth.ethanplus.ai/), released
under the MIT License. Orrery's code is written independently; techniques we learned from that
project include projecting the star catalog at the far plane with a translation-free view rotation,
morphing between illustrated and true scale in log space, and analytic ring-to-planet shadowing.
No source was copied verbatim. If a snippet is ever ported, it will be marked in place and the
notice below applies to it.

```
MIT License

Copyright (c) 2026 Ethan Rogers

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

## npm dependencies

Runtime libraries (three.js, postprocessing, astronomy-engine, satellite.js, React, zustand,
wouter, cmdk) are MIT or zlib licensed. Run `npx license-checker --summary` for the full list.
