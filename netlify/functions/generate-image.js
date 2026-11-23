
exports.handler = async (event) => {
  const json = (statusCode, data) => ({
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  });
try {
  const token = (event.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return json(401, { error: "Please log in to generate images." });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return json(503, { error: "Authentication is not configured." });
  }

  const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`
    }
  });

  if (!authResponse.ok) {
    return json(401, { error: "Please log in again." });
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  
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

const user = await authResponse.json();
const userId = user.id;

const today = new Date().toISOString().slice(0, 10);
const feature = "image";

const subscriptionResponse = await fetch(
  `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(userId)}&select=subscription_status&limit=1`,
  {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  }
);

if (!subscriptionResponse.ok) {
  return json(503, { error: "Could not check subscription." });
}

const subscriptions = await subscriptionResponse.json();
const isPro = subscriptions[0]?.subscription_status === "active";
const dailyLimit = isPro ? 5 : 0;

const usageResponse = await fetch(
  `${supabaseUrl}/rest/v1/daily_usage?user_id=eq.${encodeURIComponent(userId)}&usage_date=eq.${today}&feature=eq.${feature}&select=usage_count`,
  {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  }
);

if (!usageResponse.ok) {
  return json(503, { error: "Could not check daily usage." });
}

const usageRows = await usageResponse.json();
const usedToday = usageRows.reduce(
  (total, row) => total + row.usage_count, 0
);

if (usedToday >= dailyLimit) {
  return json(429, {
    error: "Daily image limit reached. Upgrade to Pro or try tomorrow."
  });
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

const usageUpdate = await fetch(
  `${supabaseUrl}/rest/v1/daily_usage`,
  {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates"
    },
    body: JSON.stringify({
      user_id: userId,
      usage_date: today,
      feature: feature,
      usage_count: usedToday + 1
    })
  }
);

if (!usageUpdate.ok) {
  return json(503, { error: "Could not record image usage." });
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
