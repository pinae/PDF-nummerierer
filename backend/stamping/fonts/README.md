# Bundled fonts

The fonts a number can be stamped in. The list itself is defined in
`../fonts.py`; the same TTF files are used for the PDF output and the browser
preview. All are static TrueType files (reportlab cannot embed CFF/OTF).

| File | Font | Source | License |
|---|---|---|---|
| `cmu-serif.ttf` | CMU Serif Roman (Computer Modern Unicode 0.7.0, `cmunrm.ttf`) | [cm-unicode on SourceForge](https://sourceforge.net/projects/cm-unicode/) | SIL OFL 1.1 (`licenses/cmu.txt`) |
| `cmu-sans-serif.ttf` | CMU Sans Serif (`cmunss.ttf`) | same | SIL OFL 1.1 (`licenses/cmu.txt`) |
| `libertinus-serif.ttf` | Libertinus Serif Regular | [google/fonts](https://github.com/google/fonts/tree/main/ofl/libertinusserif) | SIL OFL 1.1 |
| `noto-serif.ttf` | Noto Serif Regular (hinted, static) | [notofonts](https://github.com/notofonts/notofonts.github.io) | SIL OFL 1.1 |
| `source-sans-3.ttf` | Source Sans 3 Regular | [adobe-fonts/source-sans](https://github.com/adobe-fonts/source-sans) (release branch) | SIL OFL 1.1 |
| `dejavu-sans.ttf` | DejaVu Sans 2.37 | [DejaVu on SourceForge](https://sourceforge.net/projects/dejavu/) | Bitstream Vera license + public domain changes |
| `caveat.ttf` | Caveat Regular (static) | [googlefonts/caveat](https://github.com/googlefonts/caveat) | SIL OFL 1.1 |
| `patrick-hand.ttf` | Patrick Hand Regular | [google/fonts](https://github.com/google/fonts/tree/main/ofl/patrickhand) | SIL OFL 1.1 |
| `indie-flower.ttf` | Indie Flower Regular | [google/fonts](https://github.com/google/fonts/tree/main/ofl/indieflower) | SIL OFL 1.1 |

To change the list: add/remove the TTF and its license here, update `FONTS`
in `../fonts.py`, keep the total below 10 entries, and run the tests (they
check that every font loads and can print digits and common punctuation).
