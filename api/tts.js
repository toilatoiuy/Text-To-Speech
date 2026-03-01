export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { text, voice, rate } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Missing text" });
    }

    const response = await fetch(
      "https://texttospeech.googleapis.com/v1/text:synthesize?key=" +
        process.env.GOOGLE_API_KEY,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: "vi-VN",
            name: voice || "vi-VN-Standard-A",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: rate || 1.0,
          },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: data });
    }

    return res.status(200).json({
      audioContent: data.audioContent,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
}
