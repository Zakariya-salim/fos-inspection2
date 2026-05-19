import type { Config } from "@netlify/functions";
import { db } from "../../db/index.js";
import { tenants, sections, accounts, questions, submissions } from "../../db/schema.js";
import { eq } from "drizzle-orm";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: HEADERS });
  }

  const url = new URL(req.url);
  const segments = url.pathname.replace(/^\/api\/db\/?/, "").split("/").filter(Boolean);
  const table = segments[0] || "";
  const id = segments[1] || "";

  try {
    if (req.method === "GET" && !table) {
      const [allTenants, allSections, allAccounts, allQuestions, allSubmissions] =
        await Promise.all([
          db.select().from(tenants),
          db.select().from(sections),
          db.select().from(accounts),
          db.select().from(questions),
          db.select().from(submissions),
        ]);

      const dbPayload = {
        version: "1.1",
        tenants: allTenants.map(toFrontendTenant),
        sections: allSections.map(toFrontendSection),
        accounts: allAccounts.map(toFrontendAccount),
        masterQuestions: allQuestions.filter((q) => q.is_master).map(toFrontendQuestion),
        questions: allQuestions.filter((q) => !q.is_master).map(toFrontendQuestion),
        submissions: allSubmissions.map(toFrontendSubmission),
      };
      return json({ ok: true, db: dbPayload });
    }

    if (req.method === "POST" && !table) {
      const body = await req.json();
      await syncFullDB(body);
      return json({ ok: true });
    }

    if (table === "tenants") return handleTenants(req, id);
    if (table === "sections") return handleSections(req, id);
    if (table === "accounts") return handleAccounts(req, id);
    if (table === "questions") return handleQuestions(req, id);
    if (table === "submissions") return handleSubmissions(req, id);

    return json({ ok: false, error: "Not found" }, 404);
  } catch (error: any) {
    return json({ ok: false, error: error.message }, 500);
  }
};

async function syncFullDB(data: any) {
  if (Array.isArray(data.tenants)) {
    await db.delete(tenants);
    if (data.tenants.length > 0) {
      await db.insert(tenants).values(
        data.tenants.map((t: any) => ({
          id: t.id,
          name: t.name,
          code: t.code,
          active: t.active !== false,
          created_at: t.createdAt ? new Date(t.createdAt) : new Date(),
        }))
      );
    }
  }

  if (Array.isArray(data.sections)) {
    await db.delete(sections);
    if (data.sections.length > 0) {
      await db.insert(sections).values(
        data.sections.map((s: any) => ({
          id: s.id,
          key: s.key,
          title: s.title,
          icon: s.icon || "",
          active: s.active !== false,
          sort_order: s.sortOrder || 0,
        }))
      );
    }
  }

  if (Array.isArray(data.accounts)) {
    await db.delete(accounts);
    if (data.accounts.length > 0) {
      await db.insert(accounts).values(
        data.accounts.map((a: any) => ({
          id: a.id,
          tenant_id: a.tenantId || null,
          role: a.role,
          full_name: a.fullName,
          email: a.email,
          password: a.password,
          active: a.active !== false,
        }))
      );
    }
  }

  const allQs: any[] = [];
  if (Array.isArray(data.masterQuestions)) {
    allQs.push(
      ...data.masterQuestions.map((q: any) => ({
        id: q.id,
        tenant_id: q.tenantId || null,
        section_key: q.sectionKey,
        label: q.label,
        type: q.type,
        required: !!q.required,
        active: q.active !== false,
        is_master: true,
      }))
    );
  }
  if (Array.isArray(data.questions)) {
    allQs.push(
      ...data.questions.map((q: any) => ({
        id: q.id,
        tenant_id: q.tenantId || null,
        section_key: q.sectionKey,
        label: q.label,
        type: q.type,
        required: !!q.required,
        active: q.active !== false,
        is_master: false,
      }))
    );
  }
  if (allQs.length > 0 || Array.isArray(data.questions) || Array.isArray(data.masterQuestions)) {
    await db.delete(questions);
    if (allQs.length > 0) {
      await db.insert(questions).values(allQs);
    }
  }

  if (Array.isArray(data.submissions)) {
    await db.delete(submissions);
    if (data.submissions.length > 0) {
      await db.insert(submissions).values(
        data.submissions.map((s: any) => ({
          id: s.id,
          tenant_id: s.tenantId || null,
          tenant_name: s.tenantName || "",
          submitter_name: s.submitterName,
          status: s.status,
          created_at: s.createdAt ? new Date(s.createdAt) : new Date(),
          answers: s.answers || {},
        }))
      );
    }
  }
}

async function handleTenants(req: Request, id: string) {
  if (req.method === "GET") {
    const rows = id
      ? await db.select().from(tenants).where(eq(tenants.id, id))
      : await db.select().from(tenants);
    return json({ ok: true, data: rows.map(toFrontendTenant) });
  }
  if (req.method === "POST") {
    const body = await req.json();
    const row = {
      id: body.id,
      name: body.name,
      code: body.code,
      active: body.active !== false,
      created_at: body.createdAt ? new Date(body.createdAt) : new Date(),
    };
    const [result] = await db.insert(tenants).values(row).returning();
    return json({ ok: true, data: toFrontendTenant(result) }, 201);
  }
  if (req.method === "PUT" && id) {
    const body = await req.json();
    const updates: any = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.code !== undefined) updates.code = body.code;
    if (body.active !== undefined) updates.active = body.active;
    await db.update(tenants).set(updates).where(eq(tenants.id, id));
    return json({ ok: true });
  }
  if (req.method === "DELETE" && id) {
    await db.delete(tenants).where(eq(tenants.id, id));
    return json({ ok: true });
  }
  return json({ ok: false, error: "Method not allowed" }, 405);
}

async function handleSections(req: Request, id: string) {
  if (req.method === "GET") {
    const rows = id
      ? await db.select().from(sections).where(eq(sections.id, id))
      : await db.select().from(sections);
    return json({ ok: true, data: rows.map(toFrontendSection) });
  }
  if (req.method === "POST") {
    const body = await req.json();
    const row = {
      id: body.id,
      key: body.key,
      title: body.title,
      icon: body.icon || "",
      active: body.active !== false,
      sort_order: body.sortOrder || 0,
    };
    const [result] = await db.insert(sections).values(row).returning();
    return json({ ok: true, data: toFrontendSection(result) }, 201);
  }
  if (req.method === "PUT" && id) {
    const body = await req.json();
    const updates: any = {};
    if (body.key !== undefined) updates.key = body.key;
    if (body.title !== undefined) updates.title = body.title;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.active !== undefined) updates.active = body.active;
    if (body.sortOrder !== undefined) updates.sort_order = body.sortOrder;
    await db.update(sections).set(updates).where(eq(sections.id, id));
    return json({ ok: true });
  }
  if (req.method === "DELETE" && id) {
    await db.delete(sections).where(eq(sections.id, id));
    return json({ ok: true });
  }
  return json({ ok: false, error: "Method not allowed" }, 405);
}

async function handleAccounts(req: Request, id: string) {
  if (req.method === "GET") {
    const rows = id
      ? await db.select().from(accounts).where(eq(accounts.id, id))
      : await db.select().from(accounts);
    return json({ ok: true, data: rows.map(toFrontendAccount) });
  }
  if (req.method === "POST") {
    const body = await req.json();
    const row = {
      id: body.id,
      tenant_id: body.tenantId || null,
      role: body.role,
      full_name: body.fullName,
      email: body.email,
      password: body.password,
      active: body.active !== false,
    };
    const [result] = await db.insert(accounts).values(row).returning();
    return json({ ok: true, data: toFrontendAccount(result) }, 201);
  }
  if (req.method === "PUT" && id) {
    const body = await req.json();
    const updates: any = {};
    if (body.tenantId !== undefined) updates.tenant_id = body.tenantId;
    if (body.role !== undefined) updates.role = body.role;
    if (body.fullName !== undefined) updates.full_name = body.fullName;
    if (body.email !== undefined) updates.email = body.email;
    if (body.password !== undefined) updates.password = body.password;
    if (body.active !== undefined) updates.active = body.active;
    await db.update(accounts).set(updates).where(eq(accounts.id, id));
    return json({ ok: true });
  }
  if (req.method === "DELETE" && id) {
    await db.delete(accounts).where(eq(accounts.id, id));
    return json({ ok: true });
  }
  return json({ ok: false, error: "Method not allowed" }, 405);
}

async function handleQuestions(req: Request, id: string) {
  if (req.method === "GET") {
    const rows = id
      ? await db.select().from(questions).where(eq(questions.id, id))
      : await db.select().from(questions);
    return json({ ok: true, data: rows.map(toFrontendQuestion) });
  }
  if (req.method === "POST") {
    const body = await req.json();
    const row = {
      id: body.id,
      tenant_id: body.tenantId || null,
      section_key: body.sectionKey,
      label: body.label,
      type: body.type,
      required: !!body.required,
      active: body.active !== false,
      is_master: !!body.isMaster,
    };
    const [result] = await db.insert(questions).values(row).returning();
    return json({ ok: true, data: toFrontendQuestion(result) }, 201);
  }
  if (req.method === "PUT" && id) {
    const body = await req.json();
    const updates: any = {};
    if (body.tenantId !== undefined) updates.tenant_id = body.tenantId;
    if (body.sectionKey !== undefined) updates.section_key = body.sectionKey;
    if (body.label !== undefined) updates.label = body.label;
    if (body.type !== undefined) updates.type = body.type;
    if (body.required !== undefined) updates.required = body.required;
    if (body.active !== undefined) updates.active = body.active;
    if (body.isMaster !== undefined) updates.is_master = body.isMaster;
    await db.update(questions).set(updates).where(eq(questions.id, id));
    return json({ ok: true });
  }
  if (req.method === "DELETE" && id) {
    await db.delete(questions).where(eq(questions.id, id));
    return json({ ok: true });
  }
  return json({ ok: false, error: "Method not allowed" }, 405);
}

async function handleSubmissions(req: Request, id: string) {
  if (req.method === "GET") {
    const rows = id
      ? await db.select().from(submissions).where(eq(submissions.id, id))
      : await db.select().from(submissions);
    return json({ ok: true, data: rows.map(toFrontendSubmission) });
  }
  if (req.method === "POST") {
    const body = await req.json();
    const row = {
      id: body.id,
      tenant_id: body.tenantId || null,
      tenant_name: body.tenantName || "",
      submitter_name: body.submitterName,
      status: body.status,
      created_at: body.createdAt ? new Date(body.createdAt) : new Date(),
      answers: body.answers || {},
    };
    const [result] = await db.insert(submissions).values(row).returning();
    return json({ ok: true, data: toFrontendSubmission(result) }, 201);
  }
  if (req.method === "DELETE" && id) {
    await db.delete(submissions).where(eq(submissions.id, id));
    return json({ ok: true });
  }
  return json({ ok: false, error: "Method not allowed" }, 405);
}

function toFrontendTenant(row: any) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    active: row.active,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
  };
}

function toFrontendSection(row: any) {
  return {
    id: row.id,
    key: row.key,
    title: row.title,
    icon: row.icon,
    active: row.active,
    sortOrder: row.sort_order,
  };
}

function toFrontendAccount(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    password: row.password,
    active: row.active,
  };
}

function toFrontendQuestion(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    sectionKey: row.section_key,
    label: row.label,
    type: row.type,
    required: row.required,
    active: row.active,
    isMaster: row.is_master,
  };
}

function toFrontendSubmission(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    submitterName: row.submitter_name,
    status: row.status,
    createdAt: row.created_at?.toISOString?.() || row.created_at,
    answers: row.answers,
  };
}

export const config: Config = {
  path: ["/api/db", "/api/db/*"],
};
