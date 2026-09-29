NIVARAN — COHERENT RESTORED PROJECT

This package restores one consistent frontend/backend contract.

Core flow:
NGO registration/login → unique NGO reporting link → consent → victim details → write/record/upload → Groq Whisper transcription → victim transcript review/edit → case submission → MongoDB → Gemini assessment when configured (safe fallback otherwise) → severity/priority/flags/summary → NGO dashboard → case detail → original audio → status/counsellor.

IMPORTANT
1. Keep your existing backend/.env. Do not replace your real API keys with the example file.
2. Required:
   PORT=5004
   MONGO_URI=mongodb://127.0.0.1:27017/nivaran
   GROQ_API_KEY=...
3. Optional but recommended for live AI assessment:
   GEMINI_API_KEY=...
4. Run `npm install` inside backend if needed.
5. Start MongoDB, then run `npm start` inside backend.
6. Open http://localhost:5004/.

The package intentionally does not contain your database or real API keys.
