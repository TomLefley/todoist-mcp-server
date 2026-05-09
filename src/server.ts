import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { TodoistAPI } from "./todoist-api.js";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false } as const;
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true } as const;

export function createServer(api: TodoistAPI): McpServer {
  const server = new McpServer({
    name: "todoist-mcp-server",
    version: "1.0.0",
  });

  // ═══════════════════════════════════════════
  // INTERACTIVE TOOLS (1)
  // ═══════════════════════════════════════════

  server.tool(
    "find-tasks-by-date",
    "Find tasks filtered by due date range.",
    {
      due_date: z.string().optional().describe("Specific due date (YYYY-MM-DD)"),
      due_before: z.string().optional().describe("Tasks due before this date (YYYY-MM-DD)"),
      due_after: z.string().optional().describe("Tasks due after this date (YYYY-MM-DD)"),
      project_id: z.string().optional().describe("Filter by project ID"),
    },
    READ_ONLY,
    async (params) => {
      const allTasks = await api.getTasks(
        params.project_id ? { project_id: params.project_id } : undefined
      );
      const todayStr = new Date().toISOString().split("T")[0];
      const filtered = allTasks.filter((task) => {
        const t = task as Record<string, unknown>;
        const due = t.due as Record<string, string> | null;
        if (!due?.date) return false;
        if (params.due_date && due.date !== params.due_date) return false;
        if (params.due_before && due.date >= params.due_before) return false;
        if (params.due_after && due.date <= params.due_after) return false;
        if (!params.due_date && !params.due_before && !params.due_after) return due.date <= todayStr;
        return true;
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(filtered, null, 2) }] };
    }
  );

  // ═══════════════════════════════════════════
  // READ-ONLY TOOLS
  // ═══════════════════════════════════════════

  server.tool(
    "fetch",
    "Fetch any Todoist API URL directly.",
    {
      url: z.string().describe("Full Todoist API URL to fetch"),
      method: z.enum(["GET", "POST", "DELETE"]).optional().describe("HTTP method (default: GET)"),
      body: z.record(z.unknown()).optional().describe("Request body for POST requests"),
    },
    READ_ONLY,
    async (params) => {
      const result = await api.fetchUrl(params.url, params.method || "GET", params.body);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "fetch-object",
    "Fetch a specific Todoist object by type and ID.",
    {
      object_type: z.enum(["task", "project", "section", "comment", "label", "reminder"]).describe("Type of object"),
      id: z.string().describe("Object ID"),
    },
    READ_ONLY,
    async (params) => {
      let result: unknown;
      switch (params.object_type) {
        case "task": result = await api.getTask(params.id); break;
        case "project": result = await api.getProject(params.id); break;
        case "section": result = await api.getSection(params.id); break;
        case "comment": result = await api.getComment(params.id); break;
        case "label": result = await api.getLabel(params.id); break;
        case "reminder": result = await api.getReminder(params.id); break;
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "find-activity",
    "Find activity log events (created, updated, completed, deleted) across tasks/projects/sections/comments.",
    {
      object_type: z.string().optional().describe("Filter by object type (item, project, section, note, etc.)"),
      object_id: z.string().optional().describe("Filter by specific object ID"),
      event_type: z.string().optional().describe("Filter by event type (added, updated, completed, deleted, etc.)"),
      parent_project_id: z.string().optional().describe("Filter by parent project ID"),
      project_id: z.string().optional().describe("Filter by project ID"),
      initiator_id: z.string().optional().describe("Filter by user who initiated the event"),
      limit: z.number().optional().describe("Max items per page"),
    },
    READ_ONLY,
    async (params) => {
      const qs: Record<string, string> = {};
      if (params.object_type) qs.object_type = params.object_type;
      if (params.object_id) qs.object_id = params.object_id;
      if (params.event_type) qs.event_type = params.event_type;
      if (params.parent_project_id) qs.parent_project_id = params.parent_project_id;
      if (params.project_id) qs.project_id = params.project_id;
      if (params.initiator_id) qs.initiator_id = params.initiator_id;
      if (params.limit) qs.limit = String(params.limit);
      const result = await api.getActivityLogs(qs);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "find-comments",
    "Find comments on a task or project.",
    {
      task_id: z.string().optional().describe("Task ID to get comments for"),
      project_id: z.string().optional().describe("Project ID to get comments for"),
    },
    READ_ONLY,
    async (params) => {
      const qp: Record<string, string> = {};
      if (params.task_id) qp.task_id = params.task_id;
      if (params.project_id) qp.project_id = params.project_id;
      const result = await api.getComments(qp);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "find-completed-tasks",
    "Find completed tasks, optionally filtered by project or date range. Use `by` to query the v1 by_completion_date / by_due_date endpoints.",
    {
      by: z.enum(["completion_date", "due_date"]).optional().describe("Use the v1 by_completion_date or by_due_date endpoint instead of legacy /tasks/completed"),
      project_id: z.string().optional().describe("Filter by project ID"),
      section_id: z.string().optional().describe("Filter by section ID (by_*_date endpoints only)"),
      workspace_id: z.string().optional().describe("Filter by workspace ID (by_*_date endpoints only)"),
      filter_query: z.string().optional().describe("Filter query string (by_*_date endpoints only)"),
      since: z.string().optional().describe("Since date (YYYY-MM-DDTHH:MM)"),
      until: z.string().optional().describe("Until date (YYYY-MM-DDTHH:MM)"),
      limit: z.number().optional().describe("Max results"),
      offset: z.number().optional().describe("Offset for pagination (legacy endpoint only)"),
    },
    READ_ONLY,
    async (params) => {
      const qs: Record<string, string> = {};
      if (params.project_id) qs.project_id = params.project_id;
      if (params.section_id) qs.section_id = params.section_id;
      if (params.workspace_id) qs.workspace_id = params.workspace_id;
      if (params.filter_query) qs.filter_query = params.filter_query;
      if (params.since) qs.since = params.since;
      if (params.until) qs.until = params.until;
      if (params.limit) qs.limit = String(params.limit);
      if (params.offset) qs.offset = String(params.offset);
      let result: unknown;
      if (params.by === "completion_date") result = await api.getCompletedByCompletionDate(qs);
      else if (params.by === "due_date") result = await api.getCompletedByDueDate(qs);
      else result = await api.getCompletedTasks(qs);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "find-filters",
    "Find all user-defined filters.",
    {},
    READ_ONLY,
    async () => {
      const result = await api.getFilters();
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool("find-labels", "Find all personal labels.", {}, READ_ONLY, async () => {
    const result = await api.getLabels();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  server.tool(
    "find-project-collaborators",
    "Find collaborators on a shared project.",
    { project_id: z.string().describe("Project ID") },
    READ_ONLY,
    async (params) => {
      const result = await api.getProjectCollaborators(params.project_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool("find-projects", "Find all projects.", {}, READ_ONLY, async () => {
    const result = await api.getProjects();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  server.tool("find-reminders", "Find all reminders.", {}, READ_ONLY, async () => {
    const result = await api.getReminders();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  server.tool(
    "find-sections",
    "Find sections, optionally filtered by project.",
    { project_id: z.string().optional().describe("Filter by project ID") },
    READ_ONLY,
    async (params) => {
      const result = await api.getSections(params.project_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "find-tasks",
    "Find active tasks with optional filtering. Pass filter_query to use Todoist's filter DSL via /tasks/filter.",
    {
      project_id: z.string().optional().describe("Filter by project ID"),
      section_id: z.string().optional().describe("Filter by section ID"),
      label: z.string().optional().describe("Filter by label name"),
      ids: z.array(z.string()).optional().describe("Specific task IDs"),
      parent_id: z.string().optional().describe("Filter by parent task ID"),
      filter_query: z.string().optional().describe("Todoist filter DSL query, e.g. 'today & p1', 'overdue', 'search: foo'"),
      lang: z.string().optional().describe("Language for filter_query natural-language dates (e.g. 'en', 'fr')"),
    },
    READ_ONLY,
    async (params) => {
      let tasks: unknown[];
      if (params.filter_query) {
        tasks = await api.getTasksByFilter(params.filter_query, params.lang);
      } else {
        const qp: Record<string, string> = {};
        if (params.project_id) qp.project_id = params.project_id;
        if (params.section_id) qp.section_id = params.section_id;
        tasks = await api.getTasks(Object.keys(qp).length > 0 ? qp : undefined);
      }

      if (params.label) tasks = tasks.filter((t) => ((t as Record<string, unknown>).labels as string[] || []).includes(params.label!));
      if (params.ids) { const s = new Set(params.ids); tasks = tasks.filter((t) => s.has(String((t as Record<string, unknown>).id))); }
      if (params.parent_id) tasks = tasks.filter((t) => String((t as Record<string, unknown>).parent_id) === params.parent_id);

      return { content: [{ type: "text" as const, text: JSON.stringify(tasks, null, 2) }] };
    }
  );

  server.tool("get-overview", "Workspace overview: projects, task counts, upcoming items.", {}, READ_ONLY, async () => {
    const [projects, tasks, labels] = await Promise.all([api.getProjects(), api.getTasks(), api.getLabels()]);
    const tasksByProject: Record<string, number> = {};
    const overdueTasks: unknown[] = [];
    const todayTasks: unknown[] = [];
    const todayStr = new Date().toISOString().split("T")[0];

    for (const task of tasks) {
      const t = task as Record<string, unknown>;
      const pid = String(t.project_id || "none");
      tasksByProject[pid] = (tasksByProject[pid] || 0) + 1;
      const due = t.due as Record<string, string> | null;
      if (due?.date) {
        if (due.date < todayStr) overdueTasks.push(task);
        else if (due.date === todayStr) todayTasks.push(task);
      }
    }

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          total_projects: projects.length, total_active_tasks: tasks.length, total_labels: labels.length,
          overdue_count: overdueTasks.length, today_count: todayTasks.length,
          tasks_by_project: tasksByProject,
          overdue_tasks: overdueTasks.slice(0, 10), today_tasks: todayTasks.slice(0, 10),
        }, null, 2),
      }],
    };
  });

  server.tool("get-productivity-stats", "Productivity stats: karma, streaks, goals, trends.", {}, READ_ONLY, async () => {
    const result = await api.getProductivityStats();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  server.tool(
    "get-project-activity-stats",
    "Activity stats for a specific project (completed tasks).",
    { project_id: z.string().describe("Project ID"), limit: z.number().optional().describe("Max items") },
    READ_ONLY,
    async (params) => {
      const qs: Record<string, string> = { project_id: params.project_id };
      if (params.limit) qs.limit = String(params.limit);
      const result = await api.getCompletedTasks(qs);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get-project-health",
    "Analyze project health: task distribution, overdue items, completion rate.",
    { project_id: z.string().describe("Project ID to analyze") },
    READ_ONLY,
    async (params) => {
      const [tasks, sections, completedData] = await Promise.all([
        api.getTasks({ project_id: params.project_id }),
        api.getSections(params.project_id),
        api.getCompletedTasks({ project_id: params.project_id, limit: "50" }),
      ]);
      const todayStr = new Date().toISOString().split("T")[0];
      let overdue = 0, dueToday = 0, noDue = 0, highPriority = 0;
      const tasksBySection: Record<string, number> = {};
      for (const task of tasks) {
        const t = task as Record<string, unknown>;
        const due = t.due as Record<string, string> | null;
        if (!due) noDue++; else if (due.date < todayStr) overdue++; else if (due.date === todayStr) dueToday++;
        if ((t.priority as number) >= 3) highPriority++;
        const sid = String(t.section_id || "unsectioned");
        tasksBySection[sid] = (tasksBySection[sid] || 0) + 1;
      }
      const completed = completedData as Record<string, unknown>;
      const completedItems = (completed.items || []) as unknown[];
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            project_id: params.project_id, active_tasks: tasks.length, sections: sections.length,
            recently_completed: completedItems.length, overdue_tasks: overdue, due_today: dueToday,
            no_due_date: noDue, high_priority_tasks: highPriority, tasks_by_section: tasksBySection,
            health_score: overdue === 0 && noDue < tasks.length * 0.3 ? "healthy" : overdue > tasks.length * 0.5 ? "critical" : "needs_attention",
          }, null, 2),
        }],
      };
    }
  );

  server.tool("get-workspace-insights", "Cross-workspace analytics: task distribution, label usage, priorities.", {}, READ_ONLY, async () => {
    const [projects, tasks, labels] = await Promise.all([api.getProjects(), api.getTasks(), api.getLabels()]);
    const priorityBreakdown: Record<string, number> = { p1: 0, p2: 0, p3: 0, p4: 0 };
    const labelUsage: Record<string, number> = {};
    const tasksByProject: Record<string, number> = {};
    for (const task of tasks) {
      const t = task as Record<string, unknown>;
      priorityBreakdown[`p${t.priority}`] = (priorityBreakdown[`p${t.priority}`] || 0) + 1;
      for (const l of (t.labels as string[] || [])) labelUsage[l] = (labelUsage[l] || 0) + 1;
      const pid = String(t.project_id); tasksByProject[pid] = (tasksByProject[pid] || 0) + 1;
    }
    const projectSizes = projects.map((p) => {
      const proj = p as Record<string, unknown>;
      return { name: String(proj.name), id: String(proj.id), count: tasksByProject[String(proj.id)] || 0 };
    }).sort((a, b) => b.count - a.count);
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          total_projects: projects.length, total_tasks: tasks.length, total_labels: labels.length,
          priority_breakdown: priorityBreakdown, label_usage: labelUsage, projects_by_size: projectSizes.slice(0, 20),
        }, null, 2),
      }],
    };
  });

  server.tool("list-workspaces", "List all workspaces the user belongs to.", {}, READ_ONLY, async () => {
    const result = await api.getWorkspaces();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  server.tool(
    "search",
    "Search tasks by content, description, or label name.",
    { query: z.string().describe("Search text"), project_id: z.string().optional().describe("Narrow to project") },
    READ_ONLY,
    async (params) => {
      const qp: Record<string, string> = {};
      if (params.project_id) qp.project_id = params.project_id;
      const tasks = await api.getTasks(Object.keys(qp).length > 0 ? qp : undefined);
      const q = params.query.toLowerCase();
      const matches = tasks.filter((task) => {
        const t = task as Record<string, unknown>;
        return String(t.content || "").toLowerCase().includes(q)
          || String(t.description || "").toLowerCase().includes(q)
          || (t.labels as string[] || []).join(" ").toLowerCase().includes(q);
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(matches, null, 2) }] };
    }
  );

  server.tool("user-info", "Get authenticated user info: name, email, timezone, karma.", {}, READ_ONLY, async () => {
    const result = await api.getUserInfo();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  server.tool(
    "view-attachment",
    "View attachment details from a comment.",
    { comment_id: z.string().describe("Comment ID") },
    READ_ONLY,
    async (params) => {
      const comment = (await api.getComment(params.comment_id)) as Record<string, unknown>;
      const attachment = comment.file_attachment || null;
      return {
        content: [{
          type: "text" as const,
          text: attachment ? JSON.stringify(attachment, null, 2) : "No attachment found on this comment.",
        }],
      };
    }
  );

  // ═══════════════════════════════════════════
  // WRITE/DELETE TOOLS
  // ═══════════════════════════════════════════

  server.tool(
    "add-comments",
    "Add comments to tasks or projects.",
    {
      comments: z.array(z.object({
        task_id: z.string().optional().describe("Task ID"),
        project_id: z.string().optional().describe("Project ID"),
        content: z.string().describe("Comment text (Markdown supported)"),
      })).describe("Comments to add"),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const c of params.comments) {
        const data: Record<string, unknown> = { content: c.content };
        if (c.task_id) data.task_id = c.task_id;
        if (c.project_id) data.project_id = c.project_id;
        results.push(await api.createComment(data));
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "add-filters",
    "Create named search filters.",
    {
      filters: z.array(z.object({
        name: z.string().describe("Filter name"),
        query: z.string().describe("Filter query (Todoist filter DSL)"),
        color: z.string().optional(),
        order: z.number().optional(),
        is_favorite: z.boolean().optional(),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const f of params.filters) results.push(await api.createFilter(f));
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "add-labels",
    "Create personal labels.",
    {
      labels: z.array(z.object({
        name: z.string().describe("Label name"),
        color: z.string().optional(),
        order: z.number().optional(),
        is_favorite: z.boolean().optional(),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const l of params.labels) results.push(await api.createLabel(l));
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "add-projects",
    "Create projects.",
    {
      projects: z.array(z.object({
        name: z.string().describe("Project name"),
        parent_id: z.string().optional().describe("Parent project ID"),
        color: z.string().optional(),
        is_favorite: z.boolean().optional(),
        view_style: z.enum(["list", "board"]).optional(),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const p of params.projects) results.push(await api.createProject(p));
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "add-reminders",
    "Add task reminders. Requires Todoist Pro.",
    {
      reminders: z.array(z.object({
        task_id: z.string().describe("Task ID"),
        type: z.enum(["relative", "absolute", "location"]).optional(),
        due: z.object({
          date: z.string().optional(),
          timezone: z.string().optional(),
          string: z.string().optional(),
        }).optional(),
        minute_offset: z.number().optional().describe("Minutes before due date"),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const r of params.reminders) results.push(await api.createReminder(r));
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "add-sections",
    "Create sections in a project.",
    {
      sections: z.array(z.object({
        name: z.string().describe("Section name"),
        project_id: z.string().describe("Project ID"),
        order: z.number().optional(),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const s of params.sections) results.push(await api.createSection(s));
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "quick-add-task",
    "Create a task from a single natural-language string (parses '#Project @label p1 tomorrow at 5pm' etc).",
    {
      text: z.string().describe("Natural language task text"),
      note: z.string().optional().describe("Optional comment/note added to the new task"),
      reminder: z.string().optional().describe("Optional natural-language reminder time"),
      auto_reminder: z.boolean().optional().describe("Add a default reminder if the task has a due time"),
    },
    WRITE,
    async (params) => {
      const data: Record<string, unknown> = { text: params.text };
      if (params.note !== undefined) data.note = params.note;
      if (params.reminder !== undefined) data.reminder = params.reminder;
      if (params.auto_reminder !== undefined) data.auto_reminder = params.auto_reminder;
      const result = await api.quickAddTask(data);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "add-tasks",
    "Create tasks.",
    {
      tasks: z.array(z.object({
        content: z.string().describe("Task title"),
        description: z.string().optional(),
        project_id: z.string().optional(),
        section_id: z.string().optional(),
        parent_id: z.string().optional().describe("Parent task ID (subtask)"),
        order: z.number().optional(),
        labels: z.array(z.string()).optional(),
        priority: z.number().optional().describe("1=normal, 2=medium, 3=high, 4=urgent"),
        due_string: z.string().optional().describe("Natural language due date"),
        due_date: z.string().optional().describe("YYYY-MM-DD"),
        due_datetime: z.string().optional().describe("YYYY-MM-DDTHH:MM:SSZ"),
        due_lang: z.string().optional(),
        assignee_id: z.string().optional(),
        duration: z.number().optional(),
        duration_unit: z.enum(["minute", "day"]).optional(),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const t of params.tasks) results.push(await api.createTask(t as Record<string, unknown>));
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "analyze-project-health",
    "Deep project health analysis with actionable suggestions.",
    {
      project_id: z.string().describe("Project ID"),
      include_suggestions: z.boolean().optional().describe("Include suggestions (default true)"),
    },
    READ_ONLY,
    async (params) => {
      const [tasks, sections, project, completedData] = await Promise.all([
        api.getTasks({ project_id: params.project_id }),
        api.getSections(params.project_id),
        api.getProject(params.project_id) as Promise<Record<string, unknown>>,
        api.getCompletedTasks({ project_id: params.project_id, limit: "100" }),
      ]);
      const todayStr = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
      let overdue = 0, dueToday = 0, noDue = 0, p1 = 0, p2 = 0;
      const stale: unknown[] = [];
      for (const task of tasks) {
        const t = task as Record<string, unknown>;
        const due = t.due as Record<string, string> | null;
        if (!due) noDue++; else if (due.date < todayStr) overdue++; else if (due.date === todayStr) dueToday++;
        if ((t.priority as number) === 4) p1++;
        if ((t.priority as number) === 3) p2++;
        if (!due && t.added_at && (t.added_at as string) < weekAgo) stale.push(task);
      }
      const completed = completedData as Record<string, unknown>;
      const items = (completed.items || []) as unknown[];
      const suggestions: string[] = [];
      if (params.include_suggestions !== false) {
        if (overdue > 0) suggestions.push(`${overdue} overdue tasks need attention.`);
        if (noDue > tasks.length * 0.5) suggestions.push("Over half your tasks have no due date.");
        if (stale.length > 0) suggestions.push(`${stale.length} tasks over a week old with no due date.`);
        if (items.length === 0) suggestions.push("No recently completed tasks — project may be stalled.");
        if (p1 > 3) suggestions.push("Many urgent (p1) tasks — review priorities.");
      }
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            project: { name: project.name, id: project.id }, active_tasks: tasks.length, sections: sections.length,
            recently_completed: items.length,
            metrics: { overdue, due_today: dueToday, no_due_date: noDue, p1_urgent: p1, p2_high: p2, stale_tasks: stale.length },
            health_score: overdue === 0 && stale.length < 3 ? "healthy" : overdue > tasks.length * 0.3 ? "critical" : "needs_attention",
            suggestions,
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    "complete-tasks",
    "Mark tasks as complete.",
    { ids: z.array(z.string()).describe("Task IDs to complete") },
    WRITE,
    async (params) => {
      for (const id of params.ids) await api.closeTask(id);
      return { content: [{ type: "text" as const, text: `Completed ${params.ids.length} task(s).` }] };
    }
  );

  server.tool(
    "delete-object",
    "Delete a Todoist object.",
    {
      object_type: z.enum(["task", "project", "section", "comment", "label", "reminder", "filter"]).describe("Object type"),
      id: z.string().describe("Object ID"),
    },
    DESTRUCTIVE,
    async (params) => {
      switch (params.object_type) {
        case "task": await api.deleteTask(params.id); break;
        case "project": await api.deleteProject(params.id); break;
        case "section": await api.deleteSection(params.id); break;
        case "comment": await api.deleteComment(params.id); break;
        case "label": await api.deleteLabel(params.id); break;
        case "reminder": await api.deleteReminder(params.id); break;
        case "filter": await api.deleteFilter(params.id); break;
      }
      return { content: [{ type: "text" as const, text: `Deleted ${params.object_type} ${params.id}.` }] };
    }
  );

  server.tool(
    "manage-assignments",
    "Assign or unassign tasks in shared projects.",
    {
      assignments: z.array(z.object({
        task_id: z.string().describe("Task ID"),
        assignee_id: z.string().nullable().describe("User ID or null to unassign"),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const a of params.assignments) results.push(await api.updateTask(a.task_id, { assignee_id: a.assignee_id }));
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "project-management",
    "Bulk project operations: update, delete, archive, unarchive, or join shared/workspace project.",
    {
      operations: z.array(z.object({
        project_id: z.string().describe("Project ID"),
        action: z.enum(["update", "delete", "archive", "unarchive", "join"]).describe("Action"),
        data: z.record(z.unknown()).optional().describe("Update data (for action=update)"),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const op of params.operations) {
        switch (op.action) {
          case "update": results.push(await api.updateProject(op.project_id, op.data || {})); break;
          case "delete": results.push(await api.deleteProject(op.project_id)); break;
          case "archive": results.push(await api.archiveProject(op.project_id)); break;
          case "unarchive": results.push(await api.unarchiveProject(op.project_id)); break;
          case "join": results.push(await api.joinProject(op.project_id)); break;
        }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "project-move",
    "Reposition a project by updating its order.",
    {
      project_id: z.string().describe("Project ID"),
      child_order: z.number().optional().describe("New order position"),
      is_favorite: z.boolean().optional(),
    },
    WRITE,
    async (params) => {
      const data: Record<string, unknown> = {};
      if (params.child_order !== undefined) data.child_order = params.child_order;
      if (params.is_favorite !== undefined) data.is_favorite = params.is_favorite;
      if (Object.keys(data).length === 0) data.child_order = 0;
      const result = await api.updateProject(params.project_id, data);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "reorder-objects",
    "Reorder tasks, projects, or sections.",
    {
      object_type: z.enum(["task", "project", "section"]).describe("Object type"),
      items: z.array(z.object({ id: z.string(), child_order: z.number() })).describe("Items with new order"),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const item of params.items) {
        switch (params.object_type) {
          case "task": results.push(await api.updateTask(item.id, { child_order: item.child_order })); break;
          case "project": results.push(await api.updateProject(item.id, { child_order: item.child_order })); break;
          case "section": results.push(await api.updateSection(item.id, { order: item.child_order })); break;
        }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "reschedule-tasks",
    "Reschedule tasks with new due dates.",
    {
      tasks: z.array(z.object({
        id: z.string().describe("Task ID"),
        due_string: z.string().optional(),
        due_date: z.string().optional(),
        due_datetime: z.string().optional(),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const t of params.tasks) {
        const data: Record<string, unknown> = {};
        if (t.due_string) data.due_string = t.due_string;
        if (t.due_date) data.due_date = t.due_date;
        if (t.due_datetime) data.due_datetime = t.due_datetime;
        results.push(await api.updateTask(t.id, data));
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "uncomplete-tasks",
    "Reopen completed tasks.",
    { ids: z.array(z.string()).describe("Task IDs to reopen") },
    WRITE,
    async (params) => {
      for (const id of params.ids) await api.reopenTask(id);
      return { content: [{ type: "text" as const, text: `Reopened ${params.ids.length} task(s).` }] };
    }
  );

  server.tool(
    "update-comments",
    "Update comment content.",
    { comments: z.array(z.object({ id: z.string(), content: z.string() })) },
    WRITE,
    async (params) => {
      const results = [];
      for (const c of params.comments) results.push(await api.updateComment(c.id, { content: c.content }));
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "update-filters",
    "Update filters.",
    {
      filters: z.array(z.object({
        id: z.string(),
        name: z.string().optional(),
        query: z.string().optional(),
        color: z.string().optional(),
        order: z.number().optional(),
        is_favorite: z.boolean().optional(),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const f of params.filters) {
        const { id, ...data } = f;
        results.push(await api.updateFilter(id, data));
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "update-labels",
    "Update personal labels.",
    {
      labels: z.array(z.object({
        id: z.string().describe("Label ID"),
        name: z.string().optional(),
        color: z.string().optional(),
        order: z.number().optional(),
        is_favorite: z.boolean().optional(),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const l of params.labels) {
        const { id, ...data } = l;
        results.push(await api.updateLabel(id, data));
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "update-projects",
    "Update projects.",
    {
      projects: z.array(z.object({
        id: z.string(), name: z.string().optional(), color: z.string().optional(),
        is_favorite: z.boolean().optional(), view_style: z.enum(["list", "board"]).optional(),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const p of params.projects) { const { id, ...data } = p; results.push(await api.updateProject(id, data)); }
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "update-reminders",
    "Update reminders.",
    {
      reminders: z.array(z.object({
        id: z.string(),
        due: z.object({ date: z.string().optional(), timezone: z.string().optional(), string: z.string().optional() }).optional(),
        minute_offset: z.number().optional(),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const r of params.reminders) { const { id, ...data } = r; results.push(await api.updateReminder(id, data)); }
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "update-sections",
    "Update sections.",
    { sections: z.array(z.object({ id: z.string(), name: z.string().optional() })) },
    WRITE,
    async (params) => {
      const results = [];
      for (const s of params.sections) { const { id, ...data } = s; results.push(await api.updateSection(id, data)); }
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  server.tool(
    "update-tasks",
    "Update tasks. Supports moving between sections/projects.",
    {
      tasks: z.array(z.object({
        id: z.string(), content: z.string().optional(), description: z.string().optional(),
        labels: z.array(z.string()).optional(), priority: z.number().optional(),
        due_string: z.string().optional(), due_date: z.string().optional(), due_datetime: z.string().optional(),
        assignee_id: z.string().optional(), section_id: z.string().optional(),
        parent_id: z.string().optional(), project_id: z.string().optional(),
        order: z.number().optional(), duration: z.number().optional(),
        duration_unit: z.enum(["minute", "day"]).optional(),
      })),
    },
    WRITE,
    async (params) => {
      const results = [];
      for (const t of params.tasks) {
        const { id, section_id, parent_id, project_id, ...updateData } = t;
        if (section_id || parent_id !== undefined || project_id) {
          const moveData: Record<string, unknown> = {};
          if (section_id) moveData.section_id = section_id;
          if (parent_id !== undefined) moveData.parent_id = parent_id;
          if (project_id) moveData.project_id = project_id;
          await api.moveTask(id, moveData);
        }
        if (Object.keys(updateData).length > 0) {
          results.push(await api.updateTask(id, updateData as Record<string, unknown>));
        } else {
          results.push(await api.getTask(id));
        }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] };
    }
  );

  // ═══════════════════════════════════════════
  // ADDITIONAL v1 API TOOLS
  // ═══════════════════════════════════════════

  server.tool(
    "archive-project",
    "Archive a project.",
    { project_id: z.string().describe("Project ID to archive") },
    WRITE,
    async (params) => {
      const result = await api.archiveProject(params.project_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "unarchive-project",
    "Unarchive a project.",
    { project_id: z.string().describe("Project ID to unarchive") },
    WRITE,
    async (params) => {
      const result = await api.unarchiveProject(params.project_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "search-projects",
    "Search projects by name.",
    { query: z.string().describe("Search query") },
    READ_ONLY,
    async (params) => {
      const result = await api.searchProjects(params.query);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "archive-section",
    "Archive a section.",
    { section_id: z.string().describe("Section ID to archive") },
    WRITE,
    async (params) => {
      const result = await api.archiveSection(params.section_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "unarchive-section",
    "Unarchive a section.",
    { section_id: z.string().describe("Section ID to unarchive") },
    WRITE,
    async (params) => {
      const result = await api.unarchiveSection(params.section_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "search-sections",
    "Search sections by name.",
    {
      query: z.string().describe("Search query"),
      project_id: z.string().optional().describe("Filter by project ID"),
    },
    READ_ONLY,
    async (params) => {
      const result = await api.searchSections(params.query, params.project_id);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "search-labels",
    "Search labels by name.",
    { query: z.string().describe("Search query") },
    READ_ONLY,
    async (params) => {
      const result = await api.searchLabels(params.query);
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool("find-shared-labels", "List all shared labels.", {}, READ_ONLY, async () => {
    const result = await api.getSharedLabels();
    return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
  });

  return server;
}
