/**
 * AI Routes — powered by Google Gemini API (via Replit AI Integrations)
 *
 * Google tech used here:
 *  - gemini-3-flash-preview for ID extraction (POST /ai/extract-patient)
 *  - gemini-3-flash-preview for insurance verification (POST /ai/check-insurance)
 *
 * The Gemini client is initialized from @workspace/integrations-gemini-ai using
 * the AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY env vars
 * provisioned by Replit AI Integrations.
 */
import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, patientsTable, visitsTable } from "@workspace/db";
// Google Gemini AI client — replaces all previous OpenAI usage in this file
import { ai } from "@workspace/integrations-gemini-ai";
import {
  ExtractPatientFromIdBody,
  ExtractPatientFromIdResponse,
  CheckInsuranceBody,
  CheckInsuranceResponse,
  GetKioskStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const EXTRACTION_INSTRUCTION = `You are a hospital ID extraction assistant. Extract patient details and return ONLY valid JSON with these exact fields:
{
  "name": "full name as string",
  "age": age as integer or null,
  "gender": "Male" or "Female" or "Other" or null,
  "phone": "phone number as string or null",
  "insuranceId": "insurance ID as string or null"
}
If a field cannot be determined, use null. Return only the JSON object, no explanation.`;

/**
 * POST /ai/extract-patient
 *
 * Google tech: Gemini API (gemini-3-flash-preview) — supports both modes:
 *  - Vision mode: receives a base64 JPEG image of the ID card (idImage),
 *    Gemini reads text directly from the photo using its vision capability.
 *  - Text mode: receives pasted ID card text (idText), Gemini extracts fields.
 */
router.post("/ai/extract-patient", async (req, res): Promise<void> => {
  const parsed = ExtractPatientFromIdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { idText, idImage } = parsed.data;

  if (!idText && !idImage) {
    res.status(400).json({ error: "Provide either idText or idImage." });
    return;
  }

  // Build Gemini parts — image takes priority over text when both are present
  const parts = idImage
    ? [
        // Google Gemini Vision — reads ID fields directly from the photo
        { inlineData: { mimeType: "image/jpeg", data: idImage } },
        { text: EXTRACTION_INSTRUCTION },
      ]
    : [
        {
          text: `${EXTRACTION_INSTRUCTION}\n\nID text:\n${idText}`,
        },
      ];

  // Google Gemini API call — extract patient details (vision or text mode)
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts }],
    config: { maxOutputTokens: 512, responseMimeType: "application/json" },
  });

  try {
    const text = response.text ?? "{}";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const extracted = JSON.parse(cleaned);
    res.json(ExtractPatientFromIdResponse.parse(extracted));
  } catch {
    req.log.warn({ mode: idImage ? "vision" : "text" }, "Failed to parse Gemini extraction response");
    res.json(
      ExtractPatientFromIdResponse.parse({
        name: "",
        age: null,
        gender: null,
        phone: null,
        insuranceId: null,
      }),
    );
  }
});

/**
 * POST /ai/check-insurance
 *
 * Google tech: Gemini API (gemini-3-flash-preview)
 * Accepts an insurance ID and uses Gemini to determine active/inactive/unknown status.
 */
router.post("/ai/check-insurance", async (req, res): Promise<void> => {
  const parsed = CheckInsuranceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { insuranceId } = parsed.data;

  // Google Gemini API call — verify insurance status
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an insurance verification assistant for a hospital OPD kiosk. Given an insurance ID, determine its status.
Return ONLY valid JSON with these exact fields:
{
  "status": "active" or "inactive" or "unknown",
  "details": "brief explanation string (1-2 sentences)"
}

Rules:
- IDs starting with "INS", "HLT", "MED" followed by numbers: status = "active"
- IDs starting with "EXP", "CAN", "OLD": status = "inactive"
- Anything else or unclear: status = "unknown"

Insurance ID: ${insuranceId}`,
          },
        ],
      },
    ],
    config: { maxOutputTokens: 256, responseMimeType: "application/json" },
  });

  try {
    const text = response.text ?? "{}";
    const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed2 = JSON.parse(cleaned);
    res.json(
      CheckInsuranceResponse.parse({
        insuranceId,
        status: parsed2.status ?? "unknown",
        details: parsed2.details ?? "Unable to verify insurance status.",
      }),
    );
  } catch {
    req.log.warn("Failed to parse Gemini insurance check response");
    res.json(
      CheckInsuranceResponse.parse({
        insuranceId,
        status: "unknown",
        details: "Unable to verify insurance status at this time.",
      }),
    );
  }
});

/**
 * GET /ai/stats
 *
 * No AI call — pure DB aggregation for the dashboard stats panel.
 */
router.get("/ai/stats", async (_req, res): Promise<void> => {
  const totalPatientsResult = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(patientsTable);
  const totalPatients = totalPatientsResult[0]?.count ?? 0;

  const totalVisitsResult = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(visitsTable);
  const totalVisits = totalVisitsResult[0]?.count ?? 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const visitsTodayResult = await db
    .select({ count: sql<number>`cast(count(*) as int)` })
    .from(visitsTable)
    .where(sql`${visitsTable.createdAt} >= ${today.toISOString()}`);
  const visitsToday = visitsTodayResult[0]?.count ?? 0;

  const departmentBreakdown = await db
    .select({
      department: visitsTable.suggestedDepartment,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(visitsTable)
    .groupBy(visitsTable.suggestedDepartment)
    .orderBy(sql`count(*) desc`);

  const recentVisitRows = await db
    .select({
      id: visitsTable.id,
      patientId: visitsTable.patientId,
      symptoms: visitsTable.symptoms,
      suggestedDepartment: visitsTable.suggestedDepartment,
      insuranceStatus: visitsTable.insuranceStatus,
      chatSummary: visitsTable.chatSummary,
      createdAt: visitsTable.createdAt,
      patient: patientsTable,
    })
    .from(visitsTable)
    .innerJoin(patientsTable, eq(visitsTable.patientId, patientsTable.id))
    .orderBy(sql`${visitsTable.createdAt} desc`)
    .limit(5);

  res.json(
    GetKioskStatsResponse.parse({
      totalPatients,
      visitsToday,
      totalVisits,
      departmentBreakdown,
      recentVisits: recentVisitRows,
    }),
  );
});

export default router;
