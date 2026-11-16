
const MODEL = "gemini-omni-1.2-flash";
const API = "https://generativelanguage.googleapis.com/v1beta/interactions";

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json"
  };

  const reply = (statusCode, data) => ({
    statusCode,
    headers,
    body: JSON.stringify(data)
  });

  if (!["GET", "POST"].includes(event.httpMethod)) {
    return reply(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return reply(500, { error: "GEMINI_API_KEY missing" });
  }

  try {
    let url = API;
    let options = {
      headers: {
        ...headers,
        "x-goog-api-key": apiKey
      }
    };

    if (event.httpMethod === "GET") {
      const id = event.queryStringParameters?.id;
      if (!id || !/^v1_[A-Za-z0-9_-]+$/.test(id)) {
        return reply(400, { error: "Invalid video ID" });
      }
      url = `${API}/${encodeURIComponent(id)}`;
    } else {
      const body = JSON.parse(event.body || "{}");
      const prompt = body.prompt;

      if (typeof prompt !== "string" || !prompt.trim()) {
        return reply(400, { error: "Enter a video description" });
      }

      const seconds = Number.parseInt(body.duration, 10);
      const duration = Number.isFinite(seconds)
        ? Math.min(15, Math.max(3, seconds))
        : 5;

      const aspectRatio =
        body.aspectRatio === "16:9" || body.format === "16:9"
          ? "16:9"
          : "9:16";

      const input = prompt.trim();

      options.method = "POST";
      options.body = JSON.stringify({
        model: MODEL,
        input,
        background: true,
        store: true,
        response_format: {
          type: "video",
          duration: `${duration}s`,
          resolution: "720p",
          aspect_ratio: aspectRatio,
          delivery: "uri"
        }
      });
    }

    const response = await fetch(url, options);
    const data = await response.json();
console.log("GOOGLE VIDEO RESPONSE:", JSON.stringify(data));

    if (!response.ok) {
      return reply(response.status, {
        error: data.error?.message || "Video generation failed"
      });
    }

    const video = data.steps
      ?.flatMap(step => step.content || [])
      .find(item => item.type === "video");

    return reply(200, {
      id: data.id,
      operation: data.id,
      status: data.status || "in_progress",
      videoUrl: video?.uri || null,
     message: video?.uri ? "Video URL received" : "No video URL. Google status: " + (data.status || "unknown") + ". Response: " + JSON.stringify(data).slice(0, 500)
        
    });
  } catch (error) {
    return reply(500, {
      error: error.message || "Unexpected error"
    });
  }
};
