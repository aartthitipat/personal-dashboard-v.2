// Supabase Edge Function: slip-scan
//
// Backs the "Scan Slip" feature on the dashboard's Finances page. Receives a
// (client-downscaled) photo of a payment slip or receipt, asks Gemini vision
// to extract the payment details as structured JSON, and returns them for the
// user to confirm before the expense is saved. Holds the Gemini API key
// server-side so it never reaches the public static frontend (see
// js/finances.js for the caller). The image is read and discarded — nothing
// is stored here.
//
// Request:  POST { image: string (base64, no data: prefix), mimeType: 'image/jpeg'|'image/png'|'image/webp' }
// Response: { ok: true, slip: { amount, vendor, date, category, confidence } }
//         | { ok: false, reason: 'not_a_slip'|'api_error'|'not_configured', message: string }
// Expected failures return 200 (not 4xx) so supabase-js invoke() doesn't
// throw; only a malformed request body gets a 400.
//
// Deployed with verify_jwt = false so it's callable with the app's public
// publishable key, consistent with this project's open "anon full access"
// RLS model — there is no per-user auth to check here.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GEMINI_MODEL = 'gemini-2.5-flash';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// The client downscales to ~1280px JPEG (~100-300 KB base64); anything near
// this cap means the client-side downscale was bypassed or failed.
const MAX_IMAGE_BASE64_LENGTH = 6_000_000; // ~4.5 MB decoded

const CATEGORIES = [
  'Food & Drink',
  'Groceries',
  'Housing',
  'Education',
  'Transport',
  'Subscriptions',
  'Salary',
  'Refund',
  'Other',
];

const SYSTEM_PROMPT = `You extract payment details from photos of payment slips and receipts for a personal expense tracker.

The slips are usually Thai: bank transfer slips (PromptPay, K PLUS, SCB Easy, Krungthai NEXT, TrueMoney Wallet) or store receipts, but they may be from any bank or in English.

Rules:
- amount: the total money paid, as a plain number. Parse Thai formats like "1,234.56 บาท", "฿1,234.56", "จำนวนเงิน 500.00". For receipts use the grand total, not subtotals.
- vendor: the recipient/merchant/store name. Keep Thai names in Thai as written; do not translate them.
- date: the transaction date as YYYY-MM-DD. Convert Thai Buddhist-era years by subtracting 543 (e.g. 15 ก.ค. 2569 → 2026-07-15). If no date is visible, use an empty string.
- category: pick the best fit from the allowed list based on the vendor and items; when unsure use "Other".
- confidence: 0 to 1, your overall confidence that amount, vendor, and date were read correctly.
- is_slip: false if the image is not a payment slip, transfer confirmation, or receipt (then the other fields don't matter).`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    is_slip: { type: 'BOOLEAN' },
    amount: { type: 'NUMBER' },
    vendor: { type: 'STRING' },
    date: { type: 'STRING' },
    category: { type: 'STRING', enum: CATEGORIES },
    confidence: { type: 'NUMBER' },
  },
  required: ['is_slip', 'amount', 'vendor', 'date', 'category', 'confidence'],
};

function failure(reason: 'not_a_slip' | 'api_error' | 'not_configured', message: string) {
  return new Response(JSON.stringify({ ok: false, reason, message }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return failure('not_configured', 'Slip scanning is not connected yet — add a Gemini API key to enable it.');
    }

    const { image, mimeType } = await req.json();
    if (
      typeof image !== 'string' || !image ||
      image.length > MAX_IMAGE_BASE64_LENGTH ||
      !ALLOWED_MIME_TYPES.includes(mimeType)
    ) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: expected { image, mimeType } with a jpeg/png/webp image under 4.5 MB' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: 'user',
              parts: [
                { inline_data: { mime_type: mimeType, data: image } },
                { text: 'Extract the payment details from this slip.' },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Gemini API error', resp.status, errText);
      return failure('api_error', `API returned ${resp.status}`);
    }

    const data = await resp.json();
    const text = ((data.candidates || [])[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || '')
      .join('')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('Unparseable Gemini response', text);
      return failure('api_error', 'The model returned an unreadable result.');
    }

    if (!parsed.is_slip || !(Number(parsed.amount) > 0)) {
      return failure('not_a_slip', "That doesn't look like a payment slip or receipt.");
    }

    const slip = {
      amount: Number(parsed.amount),
      vendor: String(parsed.vendor || '').trim(),
      date: /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : '',
      category: CATEGORIES.includes(parsed.category) ? parsed.category : 'Other',
      confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
    };

    return new Response(JSON.stringify({ ok: true, slip }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('slip-scan error', err);
    return failure('api_error', err instanceof Error ? err.message : String(err));
  }
});
