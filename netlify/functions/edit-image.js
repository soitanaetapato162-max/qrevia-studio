
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
   
const token = (event.headers.authorization || "")
  .replace(/^Bearer\s+/i, "").trim();

if (!token) {
  return reply(401, {
    error: "Please log in and subscribe to Pro to edit images."
  });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  return reply(503, {
    error: "Subscription verification is unavailable."
  });
}

const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: {
    apikey: supabaseKey,
    Authorization: `Bearer ${token}`
  }
});

if (!authResponse.ok) {
  return reply(401, { error: "Please log in again." });
}

const user = await authResponse.json();

const subscriptionResponse = await fetch(
  `${supabaseUrl}/rest/v1/subscriptions?user_id=eq.${encodeURIComponent(user.id)}&subscription_status=eq.active&select=id&limit=1`,
  {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  }
);

if (!subscriptionResponse.ok) {
  return reply(503, { error: "Could not verify subscription." });
}

const subscriptions = await subscriptionResponse.json();

if (subscriptions.length === 0) {
  return reply(403, {
    error: "Image editing is available only to Pro subscribers."
  });
}
 
    const { image, prompt } = JSON.parse(event.body || "{}");

    if (!image || !prompt?.trim()) {
      return reply(400, {
        error: "Please upload a photo and describe the edit."
      });
    }

const blockedFaceEdits = [
  /\bface[\s-]?swap(?:ping)?\b/i,
 
/\b(?:swap|switch|exchange)\s+(?:(?:my|his|her|their|the|our|a|another\s+person'?s)\s+)?faces?\b/i,

  /\breplace\s+(?:the\s+|my\s+|his\s+|her\s+)?face\b/i,
  /\bchange\s+(?:the\s+|my\s+|his\s+|her\s+)?face\b/i,
  /\bmodify\s+(?:the\s+|my\s+|his\s+|her\s+)?face\b/i,
  /\bchange\s+(?:the\s+)?(?:eyes|nose|mouth|facial features)\b/i,
  /\bmake\s+(?:me|him|her|them)\s+look\s+(?:younger|older)\b/i
];

if (blockedFaceEdits.some(rule => rule.test(prompt))) {
  return reply(400, {
    error: "Face-swapping and facial manipulation are not supported. Please request another type of photo edit."
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
form.append("quality", "low");
    form.append(
      "image",
      new Blob([buffer], { type: types[match[1]] }),
      "photo." + (match[1] === "jpeg" ? "jpg" : match[1])
    );
const quotaResponse = await fetch(
  `${supabaseUrl}/rest/v1/rpc/reserve_image_edit`,
  {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      p_user_id: user.id
    })
  }
);

if (!quotaResponse.ok) {
  return reply(503, {
    error: "Unable to verify daily usage."
  });
}

const allowed = await quotaResponse.json();

if (allowed !== true) {
  return reply(429, {
    error: "Daily limit of 5 photo edits reached. Try again tomorrow."
  });
}
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
