# TubeTale AI

React + Vite app: watch a YouTube video (or upload one), capture webcam reactions, interview the viewer, and write a final sentiment report.

## Setup

```bash
npm install
```

Create a local `.env` file (**never commit this**):

```bash
cp .env.example .env
```

Set your OpenAI key:

```
VITE_OPENAI_API_KEY=sk-...
```

## Run

```bash
npm run dev
```

Open the printed local URL (usually http://localhost:5173).

## Requirements covered

| Requirement | How |
| --- | --- |
| YouTube metadata | Paste a live URL → title, duration (seconds), description, transcript via `/api/youtube-metadata` |
| Visual evaluation | Up to **20** webcam frames analyzed with **`gpt-5.6`** (`const MODEL = 'gpt-5.6'`) |
| Interview | **Start Interview** chatbot; system prompt includes video metadata + visual evaluation |
| Final synthesis | **End Chat** sends chat history + metadata + visual evaluation → formatted report |
| Secrets | `.env` is gitignored; only `.env.example` is committed |

Test video: https://www.youtube.com/watch?v=daXaTug8rL4

## AI grading folder

Repo root includes `ai_grading/` from a real app test run on the Spider-Man: Brand New Day trailer:

- `video_metadata.json`
- `visual_evaluation.txt`
- `final_prompt.txt`
- `final_report.txt`

Regenerate after code/prompt changes:

```bash
npm run grade:outputs
```
