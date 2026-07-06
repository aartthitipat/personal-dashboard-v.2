// Supabase Edge Function: study-chat
//
// Backs the 3 "Study team" assistants (hee/researcher, kuy/debater, tad/teacher)
// on the dashboard's Study page. Holds the Gemini API key server-side so it
// never reaches the public static frontend (see js/study.js for the caller).
// Uses Google's Gemini API free tier — no cost, rate-limited (see
// https://ai.google.dev/pricing).
//
// Request:  POST { member: 'researcher'|'debater'|'teacher', message: string, history: {role, content}[] }
// Response: { content: string, sources: {url, title}[] | null }
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

type Member = 'researcher' | 'debater' | 'teacher';

const PERSONAS: Record<Member, { system: string; useSearch?: boolean }> = {
  researcher: {
    system:
      "You are hee, a Web Researcher on the user's personal study team. " +
      'Use web search to find current, accurate information and answer with what you find. ' +
      'Be concise and factual. Always ground claims in your search results rather than guessing.',
    useSearch: true,
  },
  debater: {
    system:
      "You are kuy, a Debater on the user's personal study team. " +
      'Given a topic or claim, argue back — push on weak points, steelman the opposing side, ' +
      "and be direct and concise. Your job is to sharpen the user's thinking, not to simply agree.",
  },
  teacher: {
    system:
      "You are tad, a Teacher on the user's personal study team. " +
      'Explain things simply, with no unnecessary jargon. Break concepts into one step at a time ' +
      'and check that the fundamentals are clear before building on them.',
  },
};

function notConfiguredReply() {
  return {
    content: "⚙️ hee/kuy/tad isn't connected yet — add a (free) Gemini API key to enable real answers.",
    sources: null,
  };
}

function errorReply(message: string) {
  return { content: `⚠️ Something went wrong talking to the model: ${message}`, sources: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify(notConfiguredReply()), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { member, message, history } = await req.json();
    const persona = PERSONAS[member as Member];
    if (!persona || typeof message !== 'string' || !message.trim()) {
      return new Response(JSON.stringify({ error: 'Invalid request: expected { member, message }' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const contents = [
      ...(Array.isArray(history) ? history : []).map((m: { role: string; content: string }) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: persona.system }] },
          contents,
          ...(persona.useSearch ? { tools: [{ google_search: {} }] } : {}),
        }),
      },
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Gemini API error', resp.status, errText);
      return new Response(JSON.stringify(errorReply(`API returned ${resp.status}`)), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const data = await resp.json();
    const candidate = (data.candidates || [])[0];
    const content = ((candidate?.content?.parts || []) as { text?: string }[])
      .map((part) => part.text || '')
      .join('\n\n')
      .trim();

    const sourcesMap = new Map<string, { url: string; title: string }>();
    for (const chunk of candidate?.groundingMetadata?.groundingChunks || []) {
      const web = chunk.web;
      if (web?.uri && !sourcesMap.has(web.uri)) {
        sourcesMap.set(web.uri, { url: web.uri, title: web.title || web.uri });
      }
    }
    const sources = sourcesMap.size > 0 ? Array.from(sourcesMap.values()) : null;

    return new Response(JSON.stringify({ content: content || '(no response)', sources }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('study-chat error', err);
    return new Response(JSON.stringify(errorReply(err instanceof Error ? err.message : String(err))), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
