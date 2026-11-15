
const MODEL = "veo-3.1-fast-generate-preview";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "POST required" })
    };
  }

  try {
    const { prompt } = JSON.parse(event.body || "{}");

    if (!prompt || typeof prompt !== "string") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Enter a video prompt" })
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing");
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predictLongRunning`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            aspectRatio: "9:16",
            resolution: "720p"
          }
        })
      }
    );

    const data = await response.json();

if (response.ok && data.name) {
  const check = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/${data.name}`,
    { headers: { "x-goog-api-key": apiKey } }
  );
  const result = await check.json();
  if (check.ok && result.done) {
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  }
}

    return {
      statusCode: response.status,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        response.ok
          ? { operation: data.name, status: "processing" }
          : { error: data.error?.message || "Video request failed" }
      )
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
