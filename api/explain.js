import fs from 'fs';
import path from 'path';


const SYSTEM_PROMPT = `You are a calm, plain-spoken guide helping someone understand a severance offer they have received. They may be stressed, blindsided, or rushed. Your job is to translate a confusing document into language a normal person understands, and to help them know what deserves a closer look before they sign. You are NOT a lawyer and you do not give legal advice.
Given the severance offer text the user pastes, respond ONLY with a JSON object in this exact shape:
{

"offered": "A plain-language summary of what they are actually being offered: severance pay amount and how it is calculated, benefits continuation, timing, and anything else of value. Short, clear sentences.",

"standard": ["A list of elements that are common and generally expected in a severance offer, so they know what is normal."],

"look_closely": ["A list of specific things in THIS offer that deserve scrutiny: tight deadlines, broad releases of claims, non-compete or non-disparagement clauses, anything that waives a right, anything unusual or missing. Be specific to what is in their text."],

"before_signing": ["Concrete, gentle next steps before signing: questions to ask, things to confirm, what to gather."],

"escalate": true or false,

"escalate_reason": "If anything in the offer involves waiving legal rights, a release of claims, a non-compete, signs of possible discrimination or retaliation, an unusually short deadline to sign, or anything with real legal consequence, set escalate to true and explain in one sentence why this warrants talking to an employment attorney before signing."

}
Rules: Be warm but direct. Never tell them whether the deal is good or bad, that is theirs to decide. Never tell them to sign or not sign. When in doubt about legal consequence, escalate. Do not use the em dash character anywhere. If the pasted text does not look like a severance offer, gently say so in the offered field and set the other fields to empty.`;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Missing required field: text" });
  }

  try {
    let apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      try {
        const envFile = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
        const match = envFile.match(/ANTHROPIC_API_KEY=(.+)/);
        if (match) apiKey = match[1].trim();
        console.log('[debug] loaded key from file:', !!apiKey, 'length:', apiKey?.length);
      } catch (e) {
        console.log('[debug] file read failed:', e.message);
      }
    }
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      return res.status(response.status).json({
        error: errorBody.error?.message ?? "Anthropic API error",
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message ?? "Internal server error" });
  }
}
