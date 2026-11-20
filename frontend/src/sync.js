import { supabase } from "./supabase";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = value => typeof value === "string" && UUID_PATTERN.test(value);
const uuidOrNull = value => (isUuid(value) ? value : null);
const list = value => (Array.isArray(value) ? value : []);
const numberOrZero = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

async function run(query) {
  const { error } = await query;
  if (error) throw error;
}

async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw error;
  return data;
}

function projectRow(project, userId) {
  return {
    id: project.id,
    name: project.name || "Untitled project",
    status: project.status || "To Do",
    start_date: project.start || null,
    end_date: project.end || null,
    budget: numberOrZero(project.budget),
    customer_id: uuidOrNull(project.customerId),
    progress: Math.max(0, Math.min(100, Math.round(numberOrZero(project.progress)))),
    description: project.description || "",
    sprint: project.sprint || "Backlog",
    preview: project.preview || "stats",
    custom_fields: project.customFields || {},
    custom_statuses: list(project.customStatuses).length
      ? project.customStatuses
      : ["Backlog", "Todo", "In Progress", "Review", "Done"],
    ...(isUuid(userId) ? { created_by: userId } : {}),
  };
}

async function replaceJoin(table, parentColumn, parentId, childColumn, ids) {
  await run(supabase.from(table).delete().eq(parentColumn, parentId));
  const rows = [...new Set(ids.filter(isUuid))].map(id => ({
    [parentColumn]: parentId,
    [childColumn]: id,
  }));
  if (rows.length) await run(supabase.from(table).insert(rows));
}

async function replaceChildren(table, projectId, rows) {
  const ids = rows.map(row => row.id).filter(isUuid);
  let removal = supabase.from(table).delete().eq("project_id", projectId);
  if (ids.length) removal = removal.not("id", "in", `(${ids.join(",")})`);
  await run(removal);
  if (rows.length) await run(supabase.from(table).upsert(rows));
}

async function appendRows(table, rows) {
  const clean = rows.filter(row => isUuid(row.id));
  if (!clean.length) return;
  await run(supabase.from(table).upsert(clean, { onConflict: "id", ignoreDuplicates: true }));
}

async function syncProjectMembers(project) {
  const desired = list(project.members).filter(isUuid);
  const roles = project.memberRoles || {};
  const { data, error } = await supabase
    .from("project_members")
    .select("user_id, role")
    .eq("project_id", project.id);
  if (error) throw error;

  const existing = new Map((data || []).map(row => [row.user_id, row.role]));
  for (const userId of desired) {
    const role = roles[userId] || existing.get(userId) || "contributor";
    if (!existing.has(userId)) await addProjectMember(project.id, userId, role);
    else if (existing.get(userId) !== role) await setProjectMemberRole(project.id, userId, role);
  }
  for (const userId of existing.keys()) {
    if (!desired.includes(userId)) await removeProjectMember(project.id, userId);
  }
}

export async function saveProject(project, userId) {
  await run(supabase.from("projects").upsert(projectRow(project, userId)));
  await syncProjectMembers(project);
  await replaceJoin("project_labels", "project_id", project.id, "label_id", list(project.labels));

  await replaceChildren("milestones", project.id, list(project.milestones).map(milestone => ({
    id: milestone.id,
    project_id: project.id,
    title: milestone.title || "Milestone",
    date: milestone.date || null,
    done: Boolean(milestone.done),
  })));

  await replaceChildren("project_docs", project.id, list(project.docs).map(doc => ({
    id: doc.id,
    project_id: project.id,
    title: doc.title || "Untitled",
    body: doc.body || "",
  })));

  await replaceChildren("project_files", project.id, list(project.files).map(file => ({
    id: file.id,
    project_id: project.id,
    name: file.name || "File",
    size: file.size || "",
    type: file.type || "",
    url: file.url || null,
    owner_id: uuidOrNull(file.owner),
  })));

  await appendRows("chat_messages", list(project.chat).map(message => ({
    id: message.id,
    project_id: project.id,
    author_id: uuidOrNull(message.author),
    text: message.text || "",
  })));

  await appendRows("activities", list(project.activity).map(activity => ({
    id: activity.id,
    project_id: project.id,
    text: activity.text || "",
  })));
}

export async function deleteProject(projectId) {
  await run(supabase.from("projects").delete().eq("id", projectId));
}

export async function saveTask(task, projectId) {
  // The RPC owns all task children (assignees, labels, comments, subtasks and
  // attachments) and checks updatedAt so a stale client cannot overwrite a
  // newer edit. It returns the canonical task_json() for local reconciliation.
  return rpc("upsert_task_checked", {
    p_task: {
      ...task,
      projectId,
      updatedAt: task.updatedAt || null,
      assignees: list(task.assignees),
      labels: list(task.labels),
      subtasks: list(task.subtasks),
      attachments: list(task.attachments),
      comments: list(task.comments),
      checklist: list(task.checklist),
      dependencies: list(task.dependencies),
    },
    p_expected_updated_at: task.updatedAt || null,
  });
}

export async function deleteTask(taskId) {
  await run(supabase.from("tasks").delete().eq("id", taskId));
}

export async function setTaskStatus(task, status) {
  return saveTask({ ...task, status }, task.projectId || task.project_id);
}

export async function saveLabel(label) {
  await run(supabase.from("labels").upsert({
    id: label.id,
    name: label.name,
    color: label.color || "#6366f1",
  }));
}

export async function deleteLabel(labelId) {
  await run(supabase.from("labels").delete().eq("id", labelId));
}

export async function saveLead(lead) {
  await run(supabase.from("leads").upsert({
    id: lead.id,
    company: lead.company || "Lead",
    contact: lead.contact || "",
    value: numberOrZero(lead.value),
    stage: lead.stage || "New",
    owner_id: uuidOrNull(lead.owner),
    source: lead.source || "Inbound",
  }));
}

export async function saveCustomer(customer) {
  await run(supabase.from("customers").upsert({
    id: customer.id,
    name: customer.name || "Customer",
    contact: customer.contact || "",
    email: customer.email || "",
    status: customer.status || "Active",
    value: numberOrZero(customer.value),
  }));
}

export async function convertLead(action, userId) {
  await run(supabase.from("leads").update({ stage: "Won" }).eq("id", action.leadId));
  await saveCustomer(action.customer);
  await saveProject(action.project, userId);
}

export async function saveInvoice(invoice) {
  await run(supabase.from("invoices").upsert({
    id: invoice.id,
    client: invoice.client || "",
    project_id: uuidOrNull(invoice.project),
    amount: numberOrZero(invoice.amount),
    status: invoice.status || "Draft",
    issued: invoice.issued || new Date().toISOString().slice(0, 10),
    due: invoice.due || null,
  }));
}

export async function saveExpense(expense) {
  await run(supabase.from("expenses").upsert({
    id: expense.id,
    project_id: uuidOrNull(expense.project),
    category: expense.category || "General",
    vendor: expense.vendor || "",
    amount: numberOrZero(expense.amount),
    date: expense.date || new Date().toISOString().slice(0, 10),
    receipt: expense.receipt || null,
    note: expense.note || "",
  }));
}

export async function saveView(view, userId) {
  await run(supabase.from("saved_views").upsert({
    id: view.id,
    user_id: userId,
    name: view.name || "View",
    filters: view.filters || {},
    project_id: uuidOrNull(view.projectId),
  }));
}

export async function addChat(action) {
  await run(supabase.from("chat_messages").insert({
    id: action.id,
    project_id: action.projectId,
    author_id: uuidOrNull(action.author),
    text: action.text,
  }));
  await run(supabase.from("activities").insert({
    id: action.id,
    project_id: action.projectId,
    actor_id: uuidOrNull(action.author),
    text: "sent a message",
  }));
}

export async function addTimeEntry(entry, userId) {
  await run(supabase.from("time_entries").insert({
    id: entry.id,
    user_id: uuidOrNull(entry.member) || userId,
    project_id: uuidOrNull(entry.project),
    task: entry.task || "",
    hours: numberOrZero(entry.hours),
    date: entry.date || new Date().toISOString().slice(0, 10),
    note: entry.note || "",
  }));
}

export async function saveSettings(settings) {
  const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
  if (!rows.length) return;
  await run(supabase.from("workspace_settings").upsert(rows));
}

export async function savePreferences(userId, prefs) {
  await run(supabase.from("profiles").update({ notification_prefs: prefs }).eq("id", userId));
}

export async function markNotificationRead(notificationId) {
  await run(supabase.from("notifications").update({ read: true }).eq("id", notificationId));
}

export async function markAllNotificationsRead(userId) {
  await run(supabase.from("notifications").update({ read: true }).eq("user_id", userId));
}

export async function toggleAutomation(id, enabled) {
  await run(supabase.from("automations").update({ enabled }).eq("id", id));
}

export async function updateMember(member) {
  await run(supabase.from("profiles").update({
    name: member.name,
    title: member.title,
    status: member.status,
    capacity: member.capacity,
    hours: member.hours,
    leave: member.leave,
  }).eq("id", member.id));
}

export function addProjectMember(projectId, userId, role) {
  return rpc("add_project_member", {
    p_project: projectId,
    p_user: userId,
    p_role: role,
  });
}

export function setProjectMemberRole(projectId, userId, role) {
  return rpc("set_project_member_role", {
    p_project: projectId,
    p_user: userId,
    p_role: role,
  });
}

export function removeProjectMember(projectId, userId) {
  return rpc("remove_project_member", { p_project: projectId, p_user: userId });
}

export function addTeamToProject(projectId, teamId, role) {
  return rpc("add_team_to_project", {
    p_project: projectId,
    p_team: teamId,
    p_role: role,
  });
}

export function inviteToProject({ email, name, role, title, projectIds, projectRole, expiresAt }) {
  return rpc("invite_member", {
    p_email: email,
    p_name: name || "",
    p_role: role || "member",
    p_title: title || "",
    p_project_ids: projectIds || [],
    p_project_role: projectRole || "contributor",
    p_expires_at: expiresAt || null,
  });
}
