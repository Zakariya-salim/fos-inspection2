const { getStore } = require('@netlify/blobs');

const HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: HEADERS, body: '' };
  }

  try {
    const store = getStore('fos-vehicle-inspection-v11');

    if (event.httpMethod === 'GET') {
      const db = await store.get('main-db', { type: 'json' });
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true, db: db || null }) };
    }

    if (event.httpMethod === 'POST') {
      const db = JSON.parse(event.body || '{}');
      db.updatedAt = new Date().toISOString();
      await store.setJSON('main-db', db);
      return { statusCode: 200, headers: HEADERS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: HEADERS, body: JSON.stringify({ ok: false, error: 'Method not allowed' }) };
  } catch (error) {
    return { statusCode: 500, headers: HEADERS, body: JSON.stringify({ ok: false, error: error.message }) };
  }
};
