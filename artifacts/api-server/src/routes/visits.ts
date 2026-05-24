import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, visitsTable, patientsTable } from "@workspace/db";
import {
  CreateVisitBody,
  GetVisitParams,
  GetVisitResponse,
  ListVisitsResponse,
  GetPatientVisitsParams,
  GetPatientVisitsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/visits", async (_req, res): Promise<void> => {
  const visits = await db
    .select()
    .from(visitsTable)
    .orderBy(visitsTable.createdAt);
  res.json(ListVisitsResponse.parse(visits));
});

router.get("/visits/patient/:patientId", async (req, res): Promise<void> => {
  const params = GetPatientVisitsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const visits = await db
    .select()
    .from(visitsTable)
    .where(eq(visitsTable.patientId, params.data.patientId))
    .orderBy(visitsTable.createdAt);
  res.json(GetPatientVisitsResponse.parse(visits));
});

router.get("/visits/:id", async (req, res): Promise<void> => {
  const params = GetVisitParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const result = await db
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
    .where(eq(visitsTable.id, params.data.id));
  if (!result[0]) {
    res.status(404).json({ error: "Visit not found" });
    return;
  }
  res.json(GetVisitResponse.parse(result[0]));
});

router.post("/visits", async (req, res): Promise<void> => {
  const parsed = CreateVisitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [visit] = await db
    .insert(visitsTable)
    .values(parsed.data)
    .returning();
  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, visit.patientId));
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }
  res.status(201).json({
    ...visit,
    patient,
  });
});

export default router;
