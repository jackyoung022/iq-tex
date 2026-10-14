export async function GET() {
  return Response.json({ llmConfigured: !!process.env.OPENAI_API_KEY && !!process.env.OPENAI_MODEL, searchConfigured: !!process.env.TAVILY_API_KEY || !!process.env.SEARXNG_URL, baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', model: process.env.OPENAI_MODEL || '' }, { headers: { 'Cache-Control': 'no-store' } });
}
