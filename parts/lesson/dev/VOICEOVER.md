# Voice-over

Every line Swiftee says is a recorded clip: 118 clips, about 10 minutes of audio, in `assets/vo/` (Ogg Opus, 32 kbps,
mono). The game plays the clip for a line and types the words at the clip's pace.

| File | What it is |
|---|---|
| `assets/vo/voNNN.ogg` | one clip per line, numbered in the order a learner first hears them |
| `dev/tools/vo_script.json` | the script: `id`, `line` (exactly as the bubble shows it), `spoken` (what the voice was given), `devanagari` (what the studio actually spoke), `where` (screen and moment) |
| `js/vo_lines.js` | generated map, line as shown → `[clip, seconds, start of each word]`; never edit by hand |
| `js/voice.js` | the player |
| `dev/tools/vo_build.js` | rebuild tool: studio zip(s) → clips + map |

## How the clips were made

- **Studio:** *Ai Wala Human By Aamir*, https://ai-wala-human-by-aamir-809572708022.asia-southeast1.run.app/, tab
  **Batch Generation**. It takes an `.xlsx` with a header row; we use two columns, `filename` (the clip id) and `text`
  (the spoken form).
- **Settings:** Language **Hindi** · Format **.MP3** · Voice **Female Teacher (Standard)** (Gemini voice Kore, clear
  North Indian accent) · Text Column `text` · Filename Column `filename` · Start Row 1 · Quantity = rows · Concurrency
  **3 (Recommended)**. `DOWNLOAD ALL (.ZIP)` gives `voiceovers_batch.zip` with `voiceovers/<id>.mp3`.
- **Why Hindi for English lines:** the studio first rewrites each line in the language's script (a Gemini text call),
  then speaks that (a Gemini TTS call). English written in Devanagari ("Look again." → "लुक अगेन।") is spoken as English
  with an Indian accent, and the words stay English. Choosing English would give a neutral accent.
- **Rate limit:** 100 requests per 15 minutes per IP, at the studio's proxy (headers `ratelimit-limit`,
  `ratelimit-remaining`, `ratelimit-reset`; over the limit it answers `429 Too many requests from this IP`). Each line
  costs two requests, so at most about **48 lines per 15-minute window**. The 118 lines took three windows (and one
  re-run of 25 lines after an interrupted session).

## Spoken form

The bubble keeps the written form; the voice is given words. `spoken` in the script differs from `line` where needed:

- `=` → "equals", `+` → "plus", `∥` → "is parallel to", `∠A` → "angle A", `°` → "degrees", `cm` → "centimetres".
- Point names are spaced so they are read as letters: AB → "A B", AO → "A O".
- **Numbers are written as English words** ("seven", "sixty-eight", "one hundred and eighty"), never digits: the
  script step sometimes *translates* a digit into Hindi (7 → सात), and then the voice says it in Hindi.
- A sentence that now starts with a number word or "angle" is capitalised.
- "So, in any parallelogram…" keeps its trailing pause ("...").

**Devanagari check.** For every line, the Devanagari the studio produced (now in `vo_script.json`) was scanned for Hindi
number words (एक दो तीन … पचास सौ, and compounds such as सत्तर), leftover Latin letters or digits, and odd names or
letters. All 118 came out clean: numbers as transliterated English (सेवेन, वन हंड्रेड एंड एटी), letters as ए बी सी डी ओ.
One note: in vo070 the script step dropped the sentence break ("… सेवेन्टी टू डिग्रीज़ वॉट इज़ …"); its pace is normal.

**Pace check.** Spoken characters ÷ seconds is 7.4–15.6 for every clip (expected 6–22), so none is rushed or stalled.

## Conversion

`dev/tools/vo_build.js` turns the studio's MP3s (24 kHz, mono, 128 kbps) into Ogg Opus, 32 kbps, mono, with no ffmpeg:
headless Chromium decodes the MP3, resamples to 48 kHz and encodes Opus (WebCodecs `AudioEncoder`); the tool writes the
Ogg pages itself (RFC 7845: OpusHead with the encoder's pre-skip, granule positions at 48 kHz, the last page's granule
set to the real length so the padding is trimmed). Each new clip is decoded back and its length checked against the
granule length. It then measures every clip and regenerates `js/vo_lines.js`, deletes clips no line uses, and lists
lines that have no clip yet, and lesson lines missing from the script. Safe to run again.

Older Safari / iPad cannot play Ogg Opus; there the game speaks with the device voice instead (below).

## How the game uses the clips

All in `say()` (`js/game-engine.js`), the one function that puts a line in Swiftee's bubble, and `js/voice.js`:

1. **Lookup** by the exact plain text the bubble shows (line breaks as spaces); a voice-only line (`keep`) by its `s`.
2. **One reused audio element**, unlocked by the learner's first tap anywhere (played muted, then paused; tablets
   refuse audio otherwise). Browsers block audio before that first tap, so on a fresh load screen 1 may type without
   its voice (the device voice is blocked too). Every clip is prefetched quietly, one at a time, from the start.
3. **Words when they are said:** `vo_build.js` measures every clip's loudness (10 ms steps): where speech starts and
   ends (each clip opens with ~0.3 s of silence) and its pauses, which it matches in order to the line's commas and full
   stops (88 of 97 found); inside each phrase the words share the time by their spoken length. The map stores each
   word's start, and the game reveals a word when the clip's own playhead (`currentTime`) reaches it, so start-up lag
   or buffering never puts words ahead of the voice (measured: within ~0.05 s). Every word cue - side glows, cards,
   pulses, the angle focus - fires on its word. A line without timings falls back to its share of the spoken
   characters, `max(16, (seconds − 0.35) × 1000 / characters)` ms each. Screen 1's outline is drawn in the clip's length.
4. **The clip is the clock:** the line ends when the clip ends (safety: its length + 600 ms), and only then does a
   screen move on, an answer unlock, or the next line start. A new line, a screen change, mute, Back/Next or restart
   stops the voice.
5. **Fallbacks:** no clip, a missing file, `play()` refused, a clip that never starts (2.5 s), no Ogg Opus support, or
   `?vo=0` → the device's built-in voice speaks the line, as before; with no voice at all the words reveal on a timer.
   Nothing ever blocks the lesson.
6. `?speed=2` plays clips faster (0.5–4), for QA. There is no background music, so nothing needs ducking.

## Remake a line

1. Edit the line's `spoken` in `dev/tools/vo_script.json` (keep `id` and `line`; for a new line, add a row with the
   next id and its `line` exactly as the bubble shows it).
2. In the studio's Batch Generation tab, upload a two-column `.xlsx` (`filename`, `text`) with that id and spoken form,
   choose the settings above, generate, and download `voiceovers_batch.zip`.
3. In the game folder: `npm i --no-save playwright` (once), then

   ```
   node dev/tools/vo_build.js voiceovers_batch.zip
   ```

   (`CHROME=/path/to/chrome` if Playwright's own Chromium is not installed). Several zips can be passed at once.

## All lines

`=` means the voice was given exactly the text shown.

| Clip | Line as shown | Spoken as | Devanagari sent to the voice | s |
|---|---|---|---|---|
| vo001 | We learnt about quadrilaterals earlier. | = | वी लर्न्ट अबाउट क्वाड्रिलैटरल्स अर्लियर। | 3.22 |
| vo002 | Any polygon with 4 sides is called a quadrilateral. | Any polygon with four sides is called a quadrilateral. | एनी पॉलीगन विद फोर साइड्स इज कॉल्ड ए क्वाड्रिलैटरल। | 4.37 |
| vo003 | This is a special type of quadrilateral called Trapezium. | = | दिस इज ए स्पेशल टाइप ऑफ क्वाड्रीलैटरल कॉल्ड ट्रेपीज़ियम। | 4.73 |
| vo004 | A trapezium has one pair of opposite sides parallel. | = | ए ट्रेपेज़ियम हैज़ वन पेयर ऑफ अपोजिट साइड्स पैरेलल। | 4.34 |
| vo005 | Which pair of sides are parallel to each other? | = | विच पेयर ऑफ साइड्स आर पैरेलल टू ईच अदर? | 3.62 |
| vo006 | Look again. AD and BC lean towards each other, so they would meet if we made them longer. | Look again. A D and B C lean towards each other, so they would meet if we made them longer. | लुक अगेन। ए डी एंड बी सी लीन टुवर्ड्स ईच अदर, सो दे वुड मीट इफ वी मेड देम लॉन्गर। | 7.10 |
| vo007 | That's correct! AB ∥ CD. | That's correct! A B is parallel to C D. | दैट्स करेक्ट! ए बी इज पैरेलल टू सी डी। | 3.86 |
| vo008 | What if we made the other pair of opposite sides parallel too? | = | वॉट इफ वी मेड द अदर पेयर ऑफ अपोजिट साइड्स पैरेलल टू? | 3.98 |
| vo009 | Drag vertex B to make BC parallel to AD. | Drag vertex B to make B C parallel to A D. | ड्रैग वर्टेक्स बी टू मेक बी सी पैरेलल टू ए डी। | 4.73 |
| vo010 | BC is not parallel to AD yet. Keep dragging B to the right. | B C is not parallel to A D yet. Keep dragging B to the right. | बी सी इज़ नॉट पैरेलल टू ए डी येट. कीप ड्रैगिंग बी टू द राइट. | 5.26 |
| vo011 | B went too far. Drag it back a little. | = | बी वेंट टू फ़ार। ड्रैग इट बैक अ लिटिल। | 3.94 |
| vo012 | Drag B to the right until BC leans the same way as AD. | Drag B to the right until B C leans the same way as A D. | ड्रैग बी टू द राइट अंटिल बी सी लीन्स द सेम वे एज़ ए डी। | 5.66 |
| vo013 | Well done! Now BC is parallel to AD. | Well done! Now B C is parallel to A D. | वेल डन! नाउ बी सी इज पैरेलल टू ए डी। | 4.66 |
| vo014 | Now both pairs of opposite sides are parallel. | = | नाउ बोथ पेयर्स ऑफ ऑपोजिट साइड्स आर पैरेलल। | 3.94 |
| vo015 | A D is parallel to B C. | = | ए डी इज पैरलेल टू बी सी। | 3.10 |
| vo016 | We call this a Parallelogram. | = | वी कॉल दिस अ पैरेललोग्राम। | 3.02 |
| vo017 | A quadrilateral where both pairs of opposite sides are parallel is called a parallelogram. | = | अ क्वाड्रिलैटरल व्हेयर बोथ पेयर्स ऑफ ऑपोजिट साइड्स आर पैरेलल इज कॉल्ड अ पैरेललोग्राम। | 6.74 |
| vo018 | But what about the side lengths? | = | बट वॉट अबाउट द साइड लेंथ्स? | 3.26 |
| vo019 | Are they equal too? | = | आर दे इक्वल टू? | 2.18 |
| vo020 | Let's measure them. | = | लेट्स मेज़र देम। | 1.85 |
| vo021 | There is something interesting about the lengths. | = | देयर इज़ समथिंग इंटरेस्टिंग अबाउट द लेंग्थ्स। | 3.34 |
| vo022 | What do you notice about the sides? | = | वॉट डू यू नोटिस अबाउट द साइड्स? | 2.69 |
| vo023 | Look at the lengths again. AB is 6 cm, but AD is only 3 cm. | Look at the lengths again. A B is six centimetres, but A D is only three centimetres. | लुक एट द लेंग्थ्स अगेन. ए बी इज़ सिक्स सेंटीमीटर, बट ए डी इज़ ओनली थ्री सेंटीमीटर. | 6.86 |
| vo024 | That's correct! Opposite sides are equal. | = | दैट्स करेक्ट! अपोजिट साइड्स आर इक्वल। | 3.50 |
| vo025 | In any parallelogram, opposite sides are of equal lengths. | = | इन एनी पैरेललोग्राम, ऑपोजिट साइड्स आर ऑफ इक्वल लेंग्थ्स। | 4.54 |
| vo026 | So, in any parallelogram… | = | सो, इन एनी पैरेललोग्राम... | 3.02 |
| vo027 | So, in any parallelogram, opposite sides are parallel and equal. | = | सो, इन एनी पैरेललोग्राम, अपोजिट साइड्स आर पैरेलल एंड इक्वल। | 5.74 |
| vo028 | Which of these are parallelograms? Select all that apply. | = | विच ऑफ़ दीज़ आर पैरेलेलोग्राम्स? सिलेक्ट ऑल दैट अप्लाई। | 4.54 |
| vo029 | Shape B is a trapezium. Only one pair of its sides is parallel. | = | शेप बी इज अ ट्रेपीजियम। ओनली वन पेयर ऑफ इट्स साइड्स इज पैरेलल। | 5.30 |
| vo030 | Shape D has five sides, so it is not even a quadrilateral. | = | शेप डी हैज फाइव साइड्स, सो इट इज नॉट इवन अ क्वाड्रिलैटरल। | 4.90 |
| vo031 | Look for shapes where both pairs of opposite sides are parallel. | = | लुक फॉर शेप्स वेयर बोथ पेयर्स ऑफ़ ऑपोजिट साइड्स आर पैरेलल. | 4.54 |
| vo032 | Yes! Shapes A and C both have two pairs of parallel sides. | = | यस! शेप्स ए एंड सी बोथ हैव टू पेयर्स ऑफ पैरेलल साइड्स। | 6.10 |
| vo033 | In this parallelogram, AB = 7 cm. What is the length of CD? | In this parallelogram, A B equals seven centimetres. What is the length of C D? | इन दिस पैरेललोग्राम, ए बी इक्वल्स सेवन सेंटीमीटर। वॉट इज द लेंथ ऑफ सी डी? | 6.17 |
| vo034 | CD is not double AB. Opposite sides of a parallelogram are equal. | C D is not double A B. Opposite sides of a parallelogram are equal. | सी डी इज़ नॉट डबल ए बी। ऑपोजिट साइड्स ऑफ ए पैरेललोग्राम आर इक्वल। | 6.34 |
| vo035 | CD is not half of AB. Opposite sides of a parallelogram are equal. | C D is not half of A B. Opposite sides of a parallelogram are equal. | सी डी इज नॉट हाफ ऑफ़ ए बी। अपोजिट साइड्स ऑफ़ ए पैरलेलोग्राम आर इक्वल। | 5.86 |
| vo036 | CD is opposite AB. Opposite sides of a parallelogram are equal. | C D is opposite A B. Opposite sides of a parallelogram are equal. | सी डी इज ऑपोजिट ए बी। ऑपोजिट साइड्स ऑफ अ पैरेललोग्राम आर इक्वल। | 5.90 |
| vo037 | That's right! Opposite sides are equal, so CD = 7 cm. | That's right! Opposite sides are equal, so C D equals seven centimetres. | दैट्स राइट! ऑपोजिट साइड्स आर इक्वल, सो सी डी इक्वल्स सेवन सेंटीमीटर। | 5.62 |
| vo038 | In this parallelogram, AB = 8 cm and BC = 5 cm. Find the lengths of CD and AD. | In this parallelogram, A B equals eight centimetres and B C equals five centimetres. Find the lengths of C D and A D. | इन दिस पैरेललोग्राम, ए बी इक्वल्स ऐट सेंटीमीटर्स एंड बी सी इक्वल्स फाइव सेंटीमीटर्स। फाइंड द लेंथ्स ऑफ सी डी एंड ए डी। | 9.82 |
| vo039 | Look at which side is opposite. CD is opposite AB, and AD is opposite BC. | Look at which side is opposite. C D is opposite A B, and A D is opposite B C. | लुक एट विच साइड इज ऑपोजिट। सी डी इज ऑपोजिट ए बी, एंड ए डी इज ऑपोजिट बी सी। | 6.70 |
| vo040 | CD is opposite AB, and AD is opposite BC. | C D is opposite A B, and A D is opposite B C. | सी डी इज ऑपोजिट ए बी, एंड ए डी इज ऑपोजिट बी सी। | 5.69 |
| vo041 | Brilliant! CD = AB = 8 cm and AD = BC = 5 cm. | Brilliant! C D equals A B equals eight centimetres and A D equals B C equals five centimetres. | ब्रिलियंट! सी डी इक्वल्स ए बी इक्वल्स एट सेंटीमीटर्स एंड ए डी इक्वल्स बी सी इक्वल्स फाइव सेंटीमीटर्स. | 8.93 |
| vo042 | We learnt all about the sides of a parallelogram. | = | वी लर्न्ट ऑल अबाऊट द साइड्स ऑफ ए पैरेललोग्राम। | 3.65 |
| vo043 | But what about its angles? Are they equal too? | = | बट वॉट अबाउट इट्स एंगल्स? आर दे इक्वल टू? | 3.94 |
| vo044 | Let's measure the angles and find out. | = | लेट्स मेजर द एंगल्स एंड फाइंड आउट। | 2.86 |
| vo045 | There is something interesting here too. | = | देयर इज़ समथिंग इंटरेस्टिंग हियर टू। | 2.93 |
| vo046 | Some angles are equal to one another. | = | सम एंगल्स आर इक्वल टू वन अनदर। | 3.02 |
| vo047 | Tap the angle which is equal to ∠A. | Tap the angle which is equal to angle A. | टैप द एंगल विच इज़ इक्वल टू एंगल ए। | 3.29 |
| vo048 | Not quite. Compare its size with ∠A. Look at the corner opposite A. | Not quite. Compare its size with angle A. Look at the corner opposite A. | नॉट क्वाइट। कंपेयर इट्स साइज विद एंगल ए। लुक एट द कॉर्नर ऑपोजिट ए। | 6.02 |
| vo049 | Find the angle that is the same size as ∠A, and tap it. | Find the angle that is the same size as angle A, and tap it. | फाइंड द एंगल दैट इज द सेम साइज एज एंगल ए, एंड टैप इट। | 5.14 |
| vo050 | That's correct! ∠A is equal to ∠C. | That's correct! Angle A is equal to angle C. | दैट्स करेक्ट! एंगल ए इज़ इक्वल टू एंगल सी. | 4.42 |
| vo051 | Tap the angle which is equal to ∠D. | Tap the angle which is equal to angle D. | टैप द एंगल विच इज इक्वल टू एंगल डी। | 3.58 |
| vo052 | Not quite. Compare its size with ∠D. Look at the corner opposite D. | Not quite. Compare its size with angle D. Look at the corner opposite D. | नॉट क्वाइट। कम्पेयर इट्स साइज विद एंगल डी। लुक एट द कॉर्नर अपोजिट डी। | 6.74 |
| vo053 | Find the angle that is the same size as ∠D, and tap it. | Find the angle that is the same size as angle D, and tap it. | फाइंड द एंगल दैट इज़ द सेम साइज़ ऐज़ एंगल डी, एंड टैप इट। | 4.70 |
| vo054 | That's correct! ∠D is equal to ∠B. | That's correct! Angle D is equal to angle B. | दैट्स करेक्ट! एंगल डी इज इक्वल टू एंगल बी। | 3.94 |
| vo055 | So in any parallelogram, the pairs of opposite angles are also equal. | = | सो इन एनी पैरेललोग्राम द पेयर्स ऑफ अपोजिट एंगल्स आर ऑल्सो इक्वल। | 5.69 |
| vo056 | But I see something else too. | = | बट आई सी समथिंग एल्स टू। | 2.78 |
| vo057 | Look at ∠A and ∠D. | Look at angle A and angle D. | लुक एट एंगल ए एंड एंगल डी। | 2.98 |
| vo058 | They add up to make 180°. | They add up to make one hundred and eighty degrees. | दे ऐड अप टू मेक वन हंड्रेड एंड एटी डिग्रीज़। | 3.82 |
| vo059 | Which other angles add up to 180°? | Which other angles add up to one hundred and eighty degrees? | विच अदर एंगल्स ऐड अप टू वन हंड्रेड एंड एटी डिग्रीज़? | 3.89 |
| vo060 | ∠B and ∠D are opposite angles. 70° + 70° is not 180°. | Angle B and angle D are opposite angles. Seventy degrees plus seventy degrees is not one hundred and eighty degrees. | एंगल बी एंड एंगल डी आर ऑपोज़िट एंगल्स। सेवेंटी डिग्रीज़ प्लस सेवेंटी डिग्रीज़ इज़ नॉट वन हंड्रेड एंड एटी डिग्रीज़। | 7.97 |
| vo061 | Yes, but we found that pair already! Find the other pairs. | = | येस, बट वी फाउंड दैट पेयर ऑलरेडी! फाइंड द अदर पेयर्स। | 4.61 |
| vo062 | Add the two angles in each card. Which pairs make 180°? | Add the two angles in each card. Which pairs make one hundred and eighty degrees? | एड द टू एंगल्स इन ईच कार्ड। विच पेअर्स मेक वन हंड्रेड एंड एटी डिग्रीज़? | 5.90 |
| vo063 | Yes! ∠B + ∠C = 180° and ∠A + ∠B = 180°. | Yes! Angle B plus angle C equals one hundred and eighty degrees and angle A plus angle B equals one hundred and eighty degrees. | येस! एंगल बी प्लस एंगल सी इक्वल्स वन हंड्रेड एंड एटी डिग्रीज़ एंड एंगल ए प्लस एंगल बी इक्वल्स वन हंड्रेड एंड एटी डिग्रीज़। | 9.65 |
| vo064 | All the adjacent angles of this parallelogram add up to 180°. | All the adjacent angles of this parallelogram add up to one hundred and eighty degrees. | ऑल द एडजेसेंट एंगल्स ऑफ दिस पैरेललोग्राम ऐड अप टू वन हंड्रेड एंड एटी डिग्रीज़। | 5.98 |
| vo065 | In this parallelogram, ∠A = 68°. What is the measure of ∠C? | In this parallelogram, angle A equals sixty-eight degrees. What is the measure of angle C? | इन दिस पैरेललोग्राम, एंगल ए इक्वल्स सिक्सटी-एट डिग्रीज़. वाट इज़ द मेज़र ऑफ़ एंगल सी? | 6.74 |
| vo066 | 112° would add up with ∠A to 180°. But ∠C is opposite ∠A, not next to it. | One hundred and twelve degrees would add up with angle A to one hundred and eighty degrees. But angle C is opposite angle A, not next to it. | वन हंड्रेड एंड ट्वेल्व डिग्रीज़ वुड ऐड अप विद एंगल ए टू वन हंड्रेड एंड एइटी डिग्रीज़। बट एंगल सी इज़ अपोजिट एंगल ए, नॉट नेक्स्ट टू इट। | 9.50 |
| vo067 | Look again. Opposite angles of a parallelogram are equal. | = | लुक अगेन। अपोजिट एंगल्स ऑफ ए पैरेललोग्राम आर इक्वल। | 4.70 |
| vo068 | ∠C is opposite ∠A. What do you know about opposite angles? | Angle C is opposite angle A. What do you know about opposite angles? | एंगल सी इज़ ऑपोजिट एंगल ए. वॉट डू यू नो अबाउट ऑपोजिट एंगल्स? | 5.90 |
| vo069 | That's right! Opposite angles are equal, so ∠C = 68°. | That's right! Opposite angles are equal, so angle C equals sixty-eight degrees. | दैट्स राइट! अपोजिट एंगल्स आर इक्वल, सो एंगल सी इक्वल्स सिक्सटी-एट डिग्रीज़। | 6.17 |
| vo070 | In this parallelogram, ∠A = 72°. What is the measure of ∠B? | In this parallelogram, angle A equals seventy-two degrees. What is the measure of angle B? | इन दिस पैरेललोग्राम एंगल ए इक्वल्स सेवेन्टी टू डिग्रीज़ वॉट इज़ द मेजर ऑफ़ एंगल बी? | 6.77 |
| vo071 | ∠B is next to ∠A, not opposite it. Adjacent angles add up to 180°. | Angle B is next to angle A, not opposite it. Adjacent angles add up to one hundred and eighty degrees. | एंगल बी इज नेक्स्ट टू एंगल ए, नॉट ऑपोजिट इट। एडजेसेंट एंगल्स ऐड अप टू वन हंड्रेड एंड एटी डिग्रीज। | 8.26 |
| vo072 | 180° is the sum of ∠A and ∠B, not ∠B by itself. | One hundred and eighty degrees is the sum of angle A and angle B, not angle B by itself. | वन हंड्रेड एंड एटी डिग्रीज़ इज़ द सम ऑफ एंगल ए एंड एंगल बी, नॉट एंगल बी बाय इटसेल्फ। | 6.94 |
| vo073 | ∠B is next to ∠A. Adjacent angles add up to 180°. | Angle B is next to angle A. Adjacent angles add up to one hundred and eighty degrees. | एंगल बी इज नेक्स्ट टू एंगल ए। एडजेसेंट एंगल्स ऐड अप टू वन हंड्रेड एंड एटी डिग्रीज। | 6.14 |
| vo074 | Correct! 72° + 108° = 180°. | Correct! Seventy-two degrees plus one hundred and eight degrees equals one hundred and eighty degrees. | करेक्ट! सेवेंटी-टू डिग्रीज़ प्लस वन हंड्रेड एंड एट डिग्रीज़ इक्वल्स वन हंड्रेड एंड एटी डिग्रीज़। | 6.86 |
| vo075 | In this parallelogram, ∠A = 65°. Find the measures of ∠B, ∠C and ∠D. | In this parallelogram, angle A equals sixty-five degrees. Find the measures of angle B, angle C and angle D. | इन दिस पैरेललोग्राम, एंगल ए इक्वल्स सिक्सटी-फाइव डिग्रीज़। फाइंड द मेज़र्स ऑफ़ एंगल बी, एंगल सी एंड एंगल डी। | 9.10 |
| vo076 | ∠C is opposite ∠A, so they are equal. ∠B and ∠D are next to ∠A, so each adds with 65° to make 180°. | Angle C is opposite angle A, so they are equal. Angle B and angle D are next to angle A, so each adds with sixty-five degrees to make one hundred and eighty degrees. | एंगल सी इज अपोजिट एंगल ए, सो दे आर इक्वल। एंगल बी एंड एंगल डी आर नेक्स्ट टू एंगल ए, सो ईच ऐड्स विद सिक्सटी फाइव डिग्रीज़ टू मेक वन हंड्रेड एंड एटी डिग्रीज़। | 12.22 |
| vo077 | Opposite angles are equal, and adjacent angles add up to 180°. | Opposite angles are equal, and adjacent angles add up to one hundred and eighty degrees. | ऑपोजिट एंगल्स आर इक्वल, एंड एडजसेंट एंगल्स ऐड अप टू वन हंड्रेड एंड एटी डिग्रीज़। | 6.17 |
| vo078 | Amazing! ∠B = 115°, ∠C = 65° and ∠D = 115°. | Amazing! Angle B equals one hundred and fifteen degrees, angle C equals sixty-five degrees and angle D equals one hundred and fifteen degrees. | अमेजिंग! एंगल बी इक्वल्स वन हंड्रेड एंड फिफ्टीन डिग्रीज़, एंगल सी इक्वल्स सिक्स्टी-फाइव डिग्रीज़ एंड एंगल डी इक्वल्स वन हंड्रेड एंड फिफ्टीन डिग्रीज़। | 9.74 |
| vo079 | We have explored all about the sides and angles of a parallelogram. | = | वी हैव एक्सप्लोर्ड ऑल अबाउट द साइड्स एंड एंगल्स ऑफ अ पैरेलेलोग्राम। | 4.94 |
| vo080 | Let's learn about its diagonals. | = | लेट्स लर्न अबाउट इट्स डायगोनल्स। | 2.45 |
| vo081 | Draw all the diagonals of this parallelogram. | = | ड्रॉ ऑल द डायगोनल्स ऑफ दिस पैरेललोग्राम। | 3.74 |
| vo082 | That is a side. A diagonal joins two opposite corners. | = | दैट इज़ अ साइड। अ डायगोनल जॉइन्स टू ऑपोज़िट कॉर्नर्स। | 5.02 |
| vo083 | A diagonal joins two opposite corners. Drag from A to C. | = | ए डायगोनल जॉइन्स टू ऑपोजिट कॉर्नर्स। ड्रैग फ्रॉम ए टू सी। | 5.78 |
| vo084 | Great! You drew both diagonals. | = | ग्रेट! यू ड्रू बोथ डायगोनल्स. | 3.62 |
| vo085 | AC and BD are the diagonals of this parallelogram. | A C and B D are the diagonals of this parallelogram. | ए सी एंड बी डी आर द डायगोनल्स ऑफ दिस पैरेललोग्राम। | 4.46 |
| vo086 | They meet each other at point O. | = | दे मीट ईच अदर एट पॉइंट ओ। | 2.69 |
| vo087 | Each diagonal divides the other into 2 segments. | Each diagonal divides the other into two segments. | ईच डायगनल डिवाइड्स द अदर इनटू टू सेगमेंट्स। | 3.74 |
| vo088 | Let's measure each segment. | = | लेट्स मेजर ईच सेगमेंट। | 2.50 |
| vo089 | Let's compare the lengths of these segments. | = | लेट्स कंपेयर द लेंथ्स ऑफ दीज़ सेगमेंट्स। | 3.17 |
| vo090 | Drag the segments to their correct place. | = | ड्रैग द सेगमेंट्स टू देयर करेक्ट प्लेस। | 3.26 |
| vo091 | Those two are not the same length. Look at the lengths again. | = | दोज़ टू आर नॉट द सेम लेंथ। लुक एट द लेंथ्स अगेन। | 4.22 |
| vo092 | Compare the lengths. Which two segments are the same length? | = | कम्पेयर द लेंग्थ्स। विच टू सेगमेंट्स आर द सेम लेंग्थ? | 4.37 |
| vo093 | That's correct! The segments of the same diagonal are equal. | = | दैट्स करेक्ट! द सेगमेंट्स ऑफ़ द सेम डायगनल आर इक्वल। | 4.66 |
| vo094 | Each diagonal is divided into two equal parts by the other. | = | ईच डायगोनल इज डिवाइडेड इनटू टू इक्वल पार्ट्स बाय द अदर। | 5.02 |
| vo095 | So the diagonals of a parallelogram bisect each other. | = | सो द डायगोनल्स ऑफ अ पैरेललोग्राम बाईसेक्ट ईच अदर। | 4.10 |
| vo096 | In this parallelogram, AO = 6 cm. What is the length of OC? | In this parallelogram, A O equals six centimetres. What is the length of O C? | इन दिस पैरेललोग्राम, ए ओ इक्वल्स सिक्स सेंटीमीटर. वॉट इज द लेंथ ऑफ ओ सी? | 7.85 |
| vo097 | OC is not half of AO. The diagonals bisect each other, so OC is the same length as AO. | O C is not half of A O. The diagonals bisect each other, so O C is the same length as A O. | ओ सी इज़ नॉट हाफ ऑफ ए ओ। द डायगोनल्स बाईसेक्ट ईच अदर, सो ओ सी इज़ द सेम लेंथ एज़ ए ओ। | 7.25 |
| vo098 | 12 cm would be the whole diagonal AC. OC is only one half of it. | Twelve centimetres would be the whole diagonal A C. O C is only one half of it. | ट्वेल्व सेंटीमीटर वुड बी द होल डायगोनल ए सी। ओ सी इज ओनली वन हाफ ऑफ इट। | 5.74 |
| vo099 | O is where the diagonals meet. The diagonals bisect each other. | = | ओ इज व्हेयर द डायगोनल्स मीट। द डायगोनल्स बाईसेक्ट ईच अदर। | 5.06 |
| vo100 | Yes! The diagonals bisect each other, so OC = AO = 6 cm. | Yes! The diagonals bisect each other, so O C equals A O equals six centimetres. | येस! द डायगोनल्स बाईसेक्ट ईच अदर, सो ओ सी इक्वल्स ए ओ इक्वल्स सिक्स सेंटीमीटर्स। | 7.82 |
| vo101 | In this parallelogram, AO = 5 cm and BO = 3 cm. Find the lengths of OC and OD. | In this parallelogram, A O equals five centimetres and B O equals three centimetres. Find the lengths of O C and O D. | इन दिस पैरेललोग्राम, ए ओ इक्वल्स फाइव सेंटीमीटर्स एंड बी ओ इक्वल्स थ्री सेंटीमीटर्स। फाइंड द लेंथ्स ऑफ़ ओ सी एंड ओ डी। | 9.98 |
| vo102 | OC is the other half of AC, so it equals AO. OD is the other half of BD, so it equals BO. | O C is the other half of A C, so it equals A O. O D is the other half of B D, so it equals B O. | ओ सी इज द अदर हाफ ऑफ ए सी, सो इट इक्वल्स ए ओ। ओ डी इज द अदर हाफ ऑफ बी डी, सो इट इक्वल्स बी ओ। | 9.74 |
| vo103 | OC is the other half of AC, and OD is the other half of BD. | O C is the other half of A C, and O D is the other half of B D. | ओ सी इज द अदर हाफ ऑफ ए सी, एंड ओ डी इज द अदर हाफ ऑफ बी डी। | 5.57 |
| vo104 | Well done! OC = AO = 5 cm and OD = BO = 3 cm. | Well done! O C equals A O equals five centimetres and O D equals B O equals three centimetres. | वेल डन! ओ सी इक्वल्स ए ओ इक्वल्स फाइव सेंटीमीटर्स एंड ओ डी इक्वल्स बी ओ इक्वल्स थ्री सेंटीमीटर्स। | 8.74 |
| vo105 | Which of the following are true for this parallelogram? Select all that apply. | = | विच ऑफ द फॉलोइंग आर ट्रू फॉर दिस पैरेललोग्राम? सिलेक्ट ऑल दैट अप्लाई। | 5.45 |
| vo106 | AO and BO are parts of different diagonals, so they need not be equal. | A O and B O are parts of different diagonals, so they need not be equal. | ए ओ एंड बी ओ आर पार्ट्स ऑफ डिफरेंट डायग्नल्स, सो दे नीड नॉट बी इक्वल। | 6.02 |
| vo107 | The two diagonals of this parallelogram have different lengths. | = | द टू डायगोनल्स ऑफ दिस पैरेललोग्राम हैव डिफरेंट लेंथ्स। | 4.54 |
| vo108 | The diagonals bisect each other. Which statements say that? | = | द डायग्नल्स बाईसेक्ट ईच अदर. विच स्टेटमेंट्स से दैट? | 4.70 |
| vo109 | Perfect! AO = OC, BO = OD, so the diagonals bisect each other. | Perfect! A O equals O C, B O equals O D, so the diagonals bisect each other. | परफेक्ट! ए ओ इक्वल्स ओ सी, बी ओ इक्वल्स ओ डी, सो द डायगोनल्स बाईसेक्ट ईच अदर। | 7.22 |
| vo110 | Let's recall what we learnt about parallelograms. | = | लेट्स रिकॉल वॉट वी लर्न्ट अबाउट पैरेललोग्राम्स. | 3.58 |
| vo111 | A parallelogram is a quadrilateral with two pairs of opposite sides parallel. | = | ए पैरेललोग्राम इज ए क्वाड्रिलैटरल विद टू पेयर्स ऑफ ऑपोजिट साइड्स पैरेलल। | 5.57 |
| vo112 | Opposite sides are parallel. | = | ऑपोजिट साइड्स आर पैरेलल। | 2.69 |
| vo113 | B C is parallel to A D. | = | बी सी इज पैरेलल टू ए डी। | 2.90 |
| vo114 | Opposite sides are equal. | = | ऑपोजिट साइड्स आर इक्वल। | 2.74 |
| vo115 | Opposite angles are equal. | = | ऑपोजिट एंगल्स आर इक्वल. | 2.30 |
| vo116 | Adjacent angles are supplementary. | Adjacent angles are supplementary. They add up to one hundred and eighty degrees. | एडजेसेंट एंगल्स आर सप्लीमेंट्री। दे ऐड अप टू वन हंड्रेड एंड एट्टी डिग्रीज़। | 5.42 |
| vo117 | Diagonals bisect each other. | = | डायगनल्स बाईसेक्ट ईच अदर। | 2.69 |
| vo118 | Amazing work! You know all about parallelograms now. | = | अमेज़िंग वर्क! यू नो ऑल अबाउट पैरेललोग्राम्स नाउ. | 4.25 |
