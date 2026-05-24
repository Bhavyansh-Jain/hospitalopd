import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, patientsTable, visitsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  ExtractPatientFromIdBody,
  ExtractPatientFromIdResponse,
  CheckInsuranceBody,
  CheckInsuranceResponse,
  GetKioskStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/ai/extract-patient", async (req, res): Promise<void> => {
  const parsed = ExtractPatientFromIdBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { idText } = parsed.data;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 512,
    messages: [
      {
        role: "system",
        content: `You are a hospital ID extraction assistant. Extract patient details from ID card text and return ONLY valid JSON with these exact fields:
{
  "name": "full name as string",
  "age": age as integer or null,
  "gender": "Male" or "Female" or "Other" or null,
  "phone": "phone number as string or null",
  "insuranceId": "insurance ID as string or null"
}
If a field cannot be determined from the text, use null. Always return only the JSON object, no explanation.`,
      },
      {
        role: "user",
        content: `Extract patient information from this ID text:\n\n${idText}`,
      },
    ],
  });

  try {
    const content = completion.choices[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
    const extracted = JSON.parse(cleaned);
    res.json(ExtractPatientFromIdResponse.parse(extracted));
  } catch {
    req.log.warn("Failed to parse AI extraction response");
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

router.post("/ai/check-insurance", async (req, res): Promise<void> => {
  const parsed = CheckInsuranceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { insuranceId } = parsed.data;

  const completion = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 256,
    messages: [
      {
        role: "system",
        content: `You are an insurance verification assistant for a hospital OPD kiosk. Given an insurance ID, determine the status.
Return ONLY valid JSON with these exact fields:
{
  "status": "active" or "inactive" or "unknown",
  "details": "brief explanation string (1-2 sentences)"
}

Rules:
- IDs starting with "INS", "HLT", "MED" followed by numbers: status = "active"
- IDs starting with "EXP", "CAN", "OLD": status = "inactive"  
- Anything else or unclear: status = "unknown"
Always return only the JSON object.`,
      },
      {
        role: "user",
        content: `Check insurance status for ID: ${insuranceId}`,
      },
    ],
  });

  try {
    const content = completion.choices[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
    const parsed2 = JSON.parse(cleaned);
    res.json(
      CheckInsuranceResponse.parse({
        insuranceId,
        status: parsed2.status ?? "unknown",
        details: parsed2.details ?? "Unable to verify insurance status.",
      }),
    );
  } catch {
    req.log.warn("Failed to parse insurance check response");
    res.json(
      CheckInsuranceResponse.parse({
        insuranceId,
        status: "unknown",
        details: "Unable to verify insurance status at this time.",
      }),
    );
  }
});

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
