/**
 * ============================================================================
 * Vercel Serverless Function - Google Apps Script Secure Reverse Proxy
 * ============================================================================
 * Endpoint: /api/proxy
 * 
 * FUNGSI:
 * 1. Mencegah kendala CORS antara browser client dan Google Apps Script.
 * 2. Mengamankan URL Google Apps Script dan Secret API Token di sisi server Vercel.
 * 3. Menghindari kebocoran API Key di inspeksi browser (Network tab) & git repo.
 * 
 * VARIABLE ENVIRONMENT (Dikonfigurasi di Dashboard Vercel / .env.local):
 * - APPSCRIPT_URL     : URL Web App Google Apps Script (https://script.google.com/macros/s/.../exec)
 * - API_SECRET_TOKEN  : Token rahasia otentikasi
 */

export default async function handler(req, res) {
  // Setup CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, x-api-key'
  );

  // Tangani preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const appScriptUrl = process.env.APPSCRIPT_URL;
  const apiSecretToken = process.env.API_SECRET_TOKEN || '';

  // Validasi konfigurasi environment
  if (!appScriptUrl) {
    return res.status(500).json({
      success: false,
      message: 'Server Error: Environment variable APPSCRIPT_URL belum dikonfigurasi di Vercel.'
    });
  }

  try {
    let targetUrl = appScriptUrl;
    let fetchOptions = {
      method: req.method,
      headers: {
        'Accept': 'application/json'
      }
    };

    if (req.method === 'GET') {
      const urlObj = new URL(appScriptUrl);
      // Teruskan semua query parameter dari client
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          urlObj.searchParams.set(key, value);
        }
      }
      // Sisipkan secret token secara aman dari sisi server
      if (apiSecretToken) {
        urlObj.searchParams.set('token', apiSecretToken);
      }
      targetUrl = urlObj.toString();
    } else {
      // POST Request
      fetchOptions.headers['Content-Type'] = 'application/json';
      let payload = req.body;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch (e) {
          payload = { raw: payload };
        }
      }
      if (typeof payload === 'object' && payload !== null) {
        payload.token = apiSecretToken;
      }
      fetchOptions.body = JSON.stringify(payload);
    }

    // Forward request ke Google Apps Script Web App
    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const textData = await response.text();
      try {
        const jsonData = JSON.parse(textData);
        return res.status(response.status).json(jsonData);
      } catch (err) {
        return res.status(response.status).json({
          success: response.ok,
          raw: textData
        });
      }
    }
  } catch (error) {
    console.error('[Vercel Proxy Error]:', error);
    return res.status(502).json({
      success: false,
      message: 'Proxy Gateway Error: ' + (error.message || 'Gagal menghubungi Google Apps Script')
    });
  }
}

