
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json"
  };

  const reply = (statusCode, data) => ({
    statusCode,
    headers,
    body: JSON.stringify(data)
  });

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "POST required" });
  }

  try {
    const { image, prompt } = JSON.parse(event.body || "{}");

    if (!image || !prompt?.trim()) {
      return reply(400, {
        error: "Please upload a photo and describe the edit."
      });
    }

    if (!process.env.OPENAI_API_KEY) {
      return reply(500, { error: "API key not configured" });
    }

    const match = image.match(
      /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/
    );

    if (!match) {
      return reply(400, {
        error: "Please upload a PNG, JPEG or WebP photo."
      });
    }

    const buffer = Buffer.from(match[2], "base64");

    if (buffer.length > 3 * 1024 * 1024) {
      return reply(413, {
        error: "Photo is too large. Use one under 3 MB."
      });
    }

    const types = {
      png: "image/png",
      jpeg: "image/jpeg",
      webp: "image/webp"
    };

    const form = new FormData();
    form.append("model", "gpt-image-1-mini");
    form.append("prompt", prompt.trim());
    form.append("size", "1024x1024");
    form.append(
      "image",
      new Blob([buffer], { type: types[match[1]] }),
      "photo." + (match[1] === "jpeg" ? "jpg" : match[1])
    );

    const response = await fetch(
      "https://api.openai.com/v1/images/edits",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: form
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return reply(response.status, {
        error: data.error?.message || "Image editing failed"
      });
    }

    const result = data.data?.[0]?.b64_json;

    if (!result) {
      return reply(500, {
        error: "No edited image was returned"
      });
    }

    return reply(200, {
      image: "data:image/png;base64," + result
    });
  } catch (error) {
    console.error("Image edit error:", error);
    return reply(500, {
      error: "Unable to edit image. Please try again."
    });
  }
};
