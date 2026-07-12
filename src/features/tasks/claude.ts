const GROQ_MODEL = 'llama-3.3-70b-versatile';
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT =
  "Split the user's task into the SMALLEST number of short, actionable subtasks that make " +
  'sense - default to as few as possible. If the task already describes 2 distinct things ' +
  '("buy milk and eggs"), return exactly 2 subtasks, not 3. If it is one simple action, return ' +
  '1 subtask, or even 0 if splitting would be pointless. Never pad the list to hit a round ' +
  'number. Only use more than 2-3 subtasks when the task genuinely has that many distinct steps. ' +
  'Respond with ONLY a JSON object of shape {"subtasks": string[]} - no markdown, no explanation, no code fences.';

/**
 * Raw fetch instead of an SDK: keeps this off Node built-ins that don't
 * work under React Native's Hermes/Metro bundle without extra polyfills.
 * A single JSON POST doesn't need one.
 *
 * Only network call in the whole app - sends task text only, never
 * financial or usage data.
 */
export async function splitTaskIntoSubtasks(taskTitle: string): Promise<string[]> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!apiKey) throw new Error('EXPO_PUBLIC_GROQ_API_KEY is not set');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: 512,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: taskTitle },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const text: string = data.choices?.[0]?.message?.content ?? '';
  const parsed = JSON.parse(text)?.subtasks;

  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('Unexpected subtask response shape');
  }
  return parsed;
}
