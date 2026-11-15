
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const { prompt } = JSON.parse(event.body || "{}");

    if (typeof prompt !== "string" || !prompt.trim() || prompt.length > 2000) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid prompt" })
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error("Gemini API key is missing");
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            { parts: [{ text: prompt }] }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error("Gemini request failed");
    }

    const result = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("") || "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ result })
    };

  } catch (error) {
    console.error("Gemini generation failed:", error.message);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AI generation failed" })
    };
  }
};
