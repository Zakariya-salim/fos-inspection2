// Redirect to new database API for backward compatibility
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  return {
    statusCode: 301,
    headers: { ...headers, Location: '/api/db' },
    body: JSON.stringify({ ok: false, error: 'Moved to /api/db' }),
  };
};
