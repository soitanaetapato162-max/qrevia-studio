
exports.handler = async (event) => {
  const json = (statusCode, data) => ({
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  try {
    const { prompt, size = "1024x1024" } =
      JSON.parse(event.body || "{}");

    if (typeof prompt !== "string" ||
        !prompt.trim() ||
        prompt.length > 2000) {
      return json(400, {
        error: "Enter an image description (up to 2000 characters)."
      });
    }

    const allowedSizes = [
      "1024x1024",
      "1536x1024",
      "1024x1536"
    ];

    if (!allowedSizes.includes(size)) {
      return json(400, { error: "Invalid image size." });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return json(500, { error: "AI service is not configured." });
    }

    const response = await fetch(
      "https://api.openai.com/v1/images/generations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-image-1-mini",
          prompt: prompt.trim(),
          size,
          quality: "low",
          n: 1
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Image API error:", response.status);
      return json(response.status, {
        error: data.error?.message || "Image generation failed."
      });
    }

    const image = data.data?.[0]?.b64_json;

    if (!image) {
      return json(502, {
        error: "The image service returned no image."
      });
    }

    return json(200, {
      image: `data:image/png;base64,${image}`
    });

  } catch (error) {
    console.error("Image generation error:", error.message);
    return json(500, {
      error: "Could not generate the image. Please try again."
    });
  }
};
