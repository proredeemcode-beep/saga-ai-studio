import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import RunwayML from "@runwayml/sdk";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

const runway = process.env.RUNWAY_API_KEY ? new RunwayML({ apiKey: process.env.RUNWAY_API_KEY }) : null;

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/voice", async (req, res) => {
  try {
    const { text, speaker } = req.body || {};
    const allowed = ["shubh", "manan", "shreya", "ishita"];
    if (typeof text !== "string" || !text.trim() || text.length > 2500) {
      return res.status(400).json({ error: "Script must be between 1 and 2500 characters." });
    }
    if (!allowed.includes(speaker)) return res.status(400).json({ error: "Choose a supported Hindi voice." });
    if (!process.env.SARVAM_API_KEY) return res.status(503).json({ error: "SARVAM_API_KEY is not configured on the server." });

    const response = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": process.env.SARVAM_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: text.trim(),
        language_code: "hi-IN",
        speaker,
        model: "bulbul:v3",
        output_audio_codec: "wav"
      })
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: data?.error?.message || data?.message || "Sarvam TTS request failed." });
    if (!data.audios?.[0]) return res.status(502).json({ error: "No audio returned by voice provider." });
    res.json({ audio: data.audios[0], requestId: data.request_id });
  } catch (e) {
    console.error("voice route:", e);
    res.status(500).json({ error: "Voice generation failed. Check server logs and API settings." });
  }
});

app.post("/api/video", async (req, res) => {
  try {
    const { script, duration = 5 } = req.body || {};
    if (typeof script !== "string" || !script.trim() || script.length > 4000) {
      return res.status(400).json({ error: "Script must be between 1 and 4000 characters." });
    }
    if (![5, 10].includes(Number(duration))) return res.status(400).json({ error: "Choose 5 or 10 seconds." });
    if (!runway) return res.status(503).json({ error: "RUNWAY_API_KEY is not configured on the server." });

    const promptText = `Anime cinematic video, 16:9, high quality Japanese animation, expressive characters, detailed background, dynamic camera movement. Visualize this story: ${script.trim()}`;
    const task = await runway.textToVideo.create({
      model: "gen4.5",
      promptText,
      ratio: "1280:720",
      duration: Number(duration)
    }).waitForTaskOutput();

    const videoUrl = task?.output?.[0];
    if (!videoUrl) return res.status(502).json({ error: "The video provider returned no video URL." });
    res.json({ videoUrl, taskId: task.id });
  } catch (e) {
    console.error("video route:", e);
    res.status(500).json({ error: "Video generation failed. Check Runway credits, API key, and server logs." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`SAGA AI STUDIO server running on port ${port}`));
