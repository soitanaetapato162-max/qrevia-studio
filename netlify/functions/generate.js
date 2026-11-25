exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const { tool, topic, platform, language, tone } =
      JSON.parse(event.body || "{}");

    if (!topic || !tool) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Please provide a topic and tool." })
      };
    }

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const auth = event.headers.authorization ||
  event.headers.Authorization;

if (!auth || !auth.startsWith("Bearer ")) {
  return {
    statusCode: 401,
    body: JSON.stringify({ error: "Please log in." })
  };
}

const userResponse = await fetch(
  `${supabaseUrl}/auth/v1/user`,
  {
    headers: {
      apikey: supabaseKey,
      Authorization: auth
    }
  }
);

if (!userResponse.ok) {
  return {
    statusCode: 401,
    body: JSON.stringify({ error: "Invalid session. Please log in again." })
  };
}

const user = await userResponse.json();

const quotaResponse = await fetch(
  `${supabaseUrl}/rest/v1/rpc/reserve_text_generation`,
  {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ p_user_id: user.id })
  }
);

if (!quotaResponse.ok) {
  return {
    statusCode: 503,
    body: JSON.stringify({ error: "Unable to verify daily usage." })
  };
}

const allowed = await quotaResponse.json();

if (allowed !== true) {
  return {
    statusCode: 429,
    body: JSON.stringify({
      error: "Daily text limit reached. Upgrade to Pro or try tomorrow."
    })
  };
}


    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "API key is not configured." })
      };
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: "You are QREVIA Studio, a professional social media content assistant. Create useful, original content. Return only the requested content."
          },
          {
            role: "user",
            content: `Tool: ${tool}
Topic: ${topic}
Platform: ${platform || "All platforms"}
Language: ${language || "English"}
Tone: ${tone || "Engaging"}

Create the requested social media content.`
          }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: data.error?.message || "AI request failed."
        })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        result: data.choices?.[0]?.message?.content || ""
      })
    };
  } catch (error) {
   console.error("Generation failed:", error); 
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Something went wrong." })
    };
  }
};
