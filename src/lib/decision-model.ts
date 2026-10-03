import OpenAI from "openai";
import type { DecisionNode } from "@/lib/types";

const DECISION_SYSTEM_PROMPT =
  "You are a strict binary decision engine. Evaluate the user's input against the decision prompt. Respond with ONLY the single word YES or NO. Do not include punctuation, explanation, or any other text.";

export const DECISION_MODEL = "gpt-4o-mini";

function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "replace-me" || apiKey === "your-openai-api-key") {
    throw new Error("Set a valid OPENAI_API_KEY before running a workflow.");
  }

  return new OpenAI({ apiKey, timeout: 20_000, maxRetries: 0 });
}

async function requestDecision(
  node: DecisionNode,
  input: string,
  stricter: boolean,
): Promise<string> {
  const systemPrompt = stricter
    ? `${DECISION_SYSTEM_PROMPT} Your entire response must be exactly YES or exactly NO.`
    : DECISION_SYSTEM_PROMPT;
  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: DECISION_MODEL,
      temperature: 0,
      max_tokens: 5,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Decision prompt:\n${node.data.prompt}\n\nUser input:\n${input}`,
        },
      ],
    });

    return completion.choices[0]?.message.content?.trim().toUpperCase() ?? "";
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      if (error.status === 401 || error.status === 403) {
        throw new Error("OpenAI rejected the API key. Check OPENAI_API_KEY.");
      }
      if (error.status === 429) {
        throw new Error(
          "OpenAI rate limit or quota exceeded. Wait, check your quota, then retry this node.",
        );
      }
      if (error.status && error.status >= 500) {
        throw new Error("OpenAI is temporarily unavailable. Retry this node.");
      }
    }
    if (
      error instanceof OpenAI.APIConnectionTimeoutError ||
      (error instanceof Error &&
        (error.name === "AbortError" || /timed? ?out/i.test(error.message)))
    ) {
      throw new Error("OpenAI request timed out after 20 seconds. Retry this node.");
    }
    if (error instanceof Error && error.message.startsWith("Set a valid")) {
      throw error;
    }
    throw new Error(
      `OpenAI request failed: ${error instanceof Error ? error.message : "Unknown error."}`,
    );
  }
}

export async function executeDecisionNode(
  node: DecisionNode,
  input: string,
): Promise<"YES" | "NO"> {
  const firstAnswer = await requestDecision(node, input, false);
  if (firstAnswer === "YES" || firstAnswer === "NO") return firstAnswer;

  const retriedAnswer = await requestDecision(node, input, true);
  if (retriedAnswer === "YES" || retriedAnswer === "NO") return retriedAnswer;

  throw new Error(
    `The model returned an invalid answer twice for "${node.data.title}". Expected only YES or NO.`,
  );
}
