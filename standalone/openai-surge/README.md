# Independent YouTube OpenAI-compatible subtitles

This standalone Surge module does not depend on the DualSubs build chain. Import the `.sgmodule` in Surge, import the `.boxjs.json` in BoxJs, then fill URL, Key, model, and language in BoxJs. The API key stays in BoxJs persistent storage on each device and is never part of this repository.

The endpoint must support `POST /chat/completions`, Bearer authentication, and `choices[0].message.content`. It must return one JSON translation string per source subtitle row.
