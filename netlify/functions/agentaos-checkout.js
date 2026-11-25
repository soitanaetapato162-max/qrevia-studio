exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method not allowed"
    };
  }

  return {
    statusCode: 503,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      error: "Subscription checkout is not enabled yet."
    })
  };
};
