/**
 * Conversation / Chat Routes — powered by Google Gemini API (via Replit AI Integrations)
 *
 * Google tech used here:
 *  - gemini-3-flash-preview streaming chat for the OPD symptom routing agent
 *    (POST /openai/conversations/:id/messages — SSE streaming)
 *
 * The Gemini client is initialized from @workspace/integrations-gemini-ai using
 * AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY provisioned
 * by Replit AI Integrations. No user-supplied API key is required.
 *
 * Note: The route paths remain at /openai/* for API compatibility with the frontend.
 * The underlying model is Google Gemini.
 */
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
// Google Gemini AI client — replaces all previous OpenAI usage in this file
import { ai } from "@workspace/integrations-gemini-ai";
import {
  CreateOpenaiConversationBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

/**
 * System prompt for the Gemini-powered symptom routing agent.
 * Google tech: this prompt is sent to Gemini on every conversation turn.
 */
const SYMPTOM_SYSTEM_PROMPT = `You are a compassionate hospital OPD routing assistant helping patients at a self-service kiosk.
Your job is to:
1. Ask clarifying questions to understand the patient's symptoms
2. Determine the most appropriate hospital department to route them to
3. Provide a brief, reassuring summary

Available departments: General Medicine, Cardiology, Dermatology, Orthopedics, ENT, Ophthalmology, Neurology, Gastroenterology, Gynecology, Pediatrics, Psychiatry, Emergency

Guidelines:
- Be warm, clear, and professional. Patients may be anxious.
- Ask 1-2 focused follow-up questions if needed for accurate routing.
- Once you have enough information, state: "Based on your symptoms, I recommend visiting the [Department Name] department."
- End with a brief 1-sentence summary of why.
- Keep responses concise — this is a kiosk, not a consultation.
- Never diagnose. Only route.`;

router.get("/openai/conversations", async (_req, res): Promise<void> => {
  const convs = await db
    .select()
    .from(conversations)
    .orderBy(conversations.createdAt);
  res.json(convs);
});

router.post("/openai/conversations", async (req, res): Promise<void> => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [conv] = await db
    .insert(conversations)
    .values({ title: parsed.data.title })
    .returning();
  res.status(201).json(conv);
});

router.get("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = GetOpenaiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(messages.createdAt);
  res.json({ ...conv, messages: msgs });
});

router.delete("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteOpenaiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await db.delete(messages).where(eq(messages.conversationId, params.data.id));
  const [deleted] = await db
    .delete(conversations)
    .where(eq(conversations.id, params.data.id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.sendStatus(204);
});

router.get(
  "/openai/conversations/:id/messages",
  async (req, res): Promise<void> => {
    const params = ListOpenaiMessagesParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, params.data.id))
      .orderBy(messages.createdAt);
    res.json(msgs);
  },
);

/**
 * POST /openai/conversations/:id/messages
 *
 * Google tech: Gemini API streaming (gemini-3-flash-preview)
 * Streams the Gemini response as Server-Sent Events (SSE) so the frontend
 * receives tokens in real-time. Gemini uses "model" where OpenAI used
 * "assistant" — messages from the DB are mapped before being sent to Gemini.
 */
router.post(
  "/openai/conversations/:id/messages",
  async (req, res): Promise<void> => {
    const params = SendOpenaiMessageParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = SendOpenaiMessageBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const convId = params.data.id;
    const userContent = parsed.data.content;

    // Persist the user's message before calling Gemini
    await db.insert(messages).values({
      conversationId: convId,
      role: "user",
      content: userContent,
    });

    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(messages.createdAt);

    // Build Gemini content array.
    // Gemini role mapping: DB stores "assistant", Gemini expects "model".
    const geminiContents = history.map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    // SSE headers — client reads the stream token by token
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let fullResponse = "";

    // Google Gemini API streaming call — symptom routing agent
    const stream = await ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: geminiContents,
      config: {
        maxOutputTokens: 8192,
        systemInstruction: SYMPTOM_SYSTEM_PROMPT,
      },
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    // Persist the assistant message from Gemini
    await db.insert(messages).values({
      conversationId: convId,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  },
);

export default router;
