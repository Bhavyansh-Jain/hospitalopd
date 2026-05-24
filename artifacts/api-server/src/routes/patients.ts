import { Router, type IRouter } from "express";
import { eq, ilike, or } from "drizzle-orm";
import { db, patientsTable } from "@workspace/db";
import {
  CreatePatientBody,
  GetPatientParams,
  GetPatientResponse,
  ListPatientsResponse,
  SearchPatientsQueryParams,
  SearchPatientsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/patients", async (_req, res): Promise<void> => {
  const patients = await db
    .select()
    .from(patientsTable)
    .orderBy(patientsTable.createdAt);
  res.json(ListPatientsResponse.parse(patients));
});

router.get("/patients/search", async (req, res): Promise<void> => {
  const query = SearchPatientsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  const { q } = query.data;
  const patients = await db
    .select()
    .from(patientsTable)
    .where(or(ilike(patientsTable.name, `%${q}%`), ilike(patientsTable.phone, `%${q}%`)))
    .orderBy(patientsTable.createdAt);
  res.json(SearchPatientsResponse.parse(patients));
});

router.get("/patients/:id", async (req, res): Promise<void> => {
  const params = GetPatientParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [patient] = await db
    .select()
    .from(patientsTable)
    .where(eq(patientsTable.id, params.data.id));
  if (!patient) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }
  res.json(GetPatientResponse.parse(patient));
});

router.post("/patients", async (req, res): Promise<void> => {
  const parsed = CreatePatientBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [patient] = await db
    .insert(patientsTable)
    .values(parsed.data)
    .returning();
  res.status(201).json(GetPatientResponse.parse(patient));
});

export default router;
