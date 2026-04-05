#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const SUPABASE_URL = process.env.THREADFLOW_SUPABASE_URL || "https://xaoodbhmrkpcweedvoev.supabase.co";
const API_KEY = process.env.THREADFLOW_API_KEY || "";
const WEBHOOK_SECRET = process.env.THREADFLOW_WEBHOOK_SECRET || "";

async function supabaseRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "apikey": API_KEY,
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
      ...options.headers,
    },
  });
  return res.json();
}

async function invokeFunction(name: string, body?: any, token?: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
      ...(WEBHOOK_SECRET ? { "x-webhook-secret": WEBHOOK_SECRET } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

const server = new McpServer({
  name: "threadflow",
  version: "1.0.0",
});

// --- Tools ---

server.tool(
  "create_draft",
  "Create a new draft post in the Content Bank",
  {
    content: z.string().describe("The post content (max 500 characters)"),
    category: z.string().optional().describe("Content pillar category name"),
  },
  async ({ content, category }) => {
    const result = await invokeFunction("webhook-create-post", {
      content,
      category: category || undefined,
      status: "draft",
    });
    return {
      content: [{ type: "text", text: result.error ? `Error: ${result.error}` : `Draft created. Thread ID: ${result.thread_id}` }],
    };
  }
);

server.tool(
  "create_thread",
  "Create a multi-post thread (threadstorm) in the Content Bank",
  {
    posts: z.array(z.string()).describe("Array of post texts for the thread"),
    category: z.string().optional().describe("Content pillar category name"),
  },
  async ({ posts, category }) => {
    const result = await invokeFunction("webhook-create-post", {
      content: posts,
      category: category || undefined,
      status: "draft",
    });
    return {
      content: [{ type: "text", text: result.error ? `Error: ${result.error}` : `Thread created with ${result.posts_created} posts. Thread ID: ${result.thread_id}` }],
    };
  }
);

server.tool(
  "schedule_post",
  "Schedule a post for a specific date and time",
  {
    content: z.string().describe("The post content"),
    date: z.string().describe("Scheduled date (YYYY-MM-DD)"),
    time: z.string().optional().describe("Scheduled time (HH:MM)"),
    category: z.string().optional().describe("Content pillar category name"),
  },
  async ({ content, date, time, category }) => {
    const result = await invokeFunction("webhook-create-post", {
      content,
      scheduled_date: date,
      scheduled_time: time || undefined,
      category: category || undefined,
    });
    return {
      content: [{ type: "text", text: result.error ? `Error: ${result.error}` : `Post scheduled for ${date}${time ? ` at ${time}` : ""}. Thread ID: ${result.thread_id}` }],
    };
  }
);

server.tool(
  "list_drafts",
  "List all draft posts in the Content Bank",
  {},
  async () => {
    const data = await supabaseRequest(
      "posts?status=eq.draft&order=created_at.desc&limit=20&select=id,content,thread_id,thread_order,created_at"
    );
    if (!Array.isArray(data) || data.length === 0) {
      return { content: [{ type: "text", text: "No drafts found in the Content Bank." }] };
    }

    // Group by thread
    const threads = new Map<string, any[]>();
    for (const post of data) {
      const existing = threads.get(post.thread_id) || [];
      existing.push(post);
      threads.set(post.thread_id, existing);
    }

    let text = `**${threads.size} draft thread(s) in Content Bank:**\n\n`;
    for (const [threadId, posts] of threads) {
      posts.sort((a: any, b: any) => a.thread_order - b.thread_order);
      const preview = posts[0].content.slice(0, 100);
      text += `- **${posts.length} post(s):** ${preview}${posts[0].content.length > 100 ? "..." : ""}\n`;
    }

    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "list_scheduled",
  "List all scheduled posts",
  {},
  async () => {
    const data = await supabaseRequest(
      "posts?status=eq.scheduled&order=scheduled_date.asc,scheduled_time.asc&limit=20&select=id,content,scheduled_date,scheduled_time,thread_id"
    );
    if (!Array.isArray(data) || data.length === 0) {
      return { content: [{ type: "text", text: "No scheduled posts." }] };
    }

    const threads = new Map<string, any[]>();
    for (const post of data) {
      const existing = threads.get(post.thread_id) || [];
      existing.push(post);
      threads.set(post.thread_id, existing);
    }

    let text = `**${threads.size} scheduled thread(s):**\n\n`;
    for (const [, posts] of threads) {
      posts.sort((a: any, b: any) => a.thread_order - b.thread_order);
      const date = posts[0].scheduled_date;
      const time = posts[0].scheduled_time?.slice(0, 5) || "no time set";
      const preview = posts[0].content.slice(0, 80);
      text += `- **${date} ${time}** (${posts.length} post${posts.length > 1 ? "s" : ""}): ${preview}...\n`;
    }

    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "list_categories",
  "List all content categories (pillars and types)",
  {},
  async () => {
    const data = await supabaseRequest(
      "content_categories?order=category_type,name&select=id,name,color,category_type"
    );
    if (!Array.isArray(data) || data.length === 0) {
      return { content: [{ type: "text", text: "No categories created yet." }] };
    }

    const pillars = data.filter((c: any) => c.category_type === "pillar");
    const types = data.filter((c: any) => c.category_type === "content_type");

    let text = "**Content Pillars:**\n";
    for (const p of pillars) text += `- ${p.name}\n`;
    text += "\n**Content Types:**\n";
    for (const t of types) text += `- ${t.name}\n`;

    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "repurpose_content",
  "Use AI to generate thread posts from text content or a URL",
  {
    content: z.string().describe("The text content to repurpose, or a URL to fetch and repurpose"),
  },
  async ({ content }) => {
    // Check if it's a URL
    let textToRepurpose = content;
    if (content.startsWith("http://") || content.startsWith("https://")) {
      const fetched = await invokeFunction("fetch-url-content", { url: content });
      if (fetched.error) {
        return { content: [{ type: "text", text: `Error fetching URL: ${fetched.error}` }] };
      }
      textToRepurpose = fetched.content;
    }

    const result = await invokeFunction("generate-threads", {
      content: textToRepurpose,
      type: "repurpose",
    });

    if (result.error) {
      return { content: [{ type: "text", text: `Error: ${result.error}` }] };
    }

    // Format the generated content
    let text = "**Generated content:**\n\n";
    if (result.items) {
      for (const item of result.items) {
        if (item.type === "post") {
          text += `**[Post]** ${item.content}\n\n`;
        } else if (item.type === "thread") {
          text += `**[Thread]**\n`;
          for (let i = 0; i < item.posts.length; i++) {
            text += `  ${i + 1}. ${item.posts[i]}\n`;
          }
          text += "\n";
        }
      }
    } else if (result.posts) {
      for (const post of result.posts) {
        text += `- ${post}\n`;
      }
    }

    text += "\nUse `create_draft` or `create_thread` to save these to your Content Bank.";

    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "get_analytics",
  "Get your Threads performance summary",
  {},
  async () => {
    const posts = await supabaseRequest(
      "posts?select=id,status,scheduled_date,thread_id&limit=500"
    );

    if (!Array.isArray(posts)) {
      return { content: [{ type: "text", text: "Could not fetch analytics." }] };
    }

    const drafts = new Set(posts.filter((p: any) => p.status === "draft").map((p: any) => p.thread_id)).size;
    const scheduled = new Set(posts.filter((p: any) => p.status === "scheduled").map((p: any) => p.thread_id)).size;
    const published = new Set(posts.filter((p: any) => p.status === "published").map((p: any) => p.thread_id)).size;

    const followers = await supabaseRequest(
      "follower_history?order=recorded_at.desc&limit=2&select=follower_count,recorded_at"
    );

    let followerText = "";
    if (Array.isArray(followers) && followers.length > 0) {
      const current = followers[0].follower_count;
      const change = followers.length > 1 ? current - followers[1].follower_count : 0;
      followerText = `\n- **Followers:** ${current} (${change >= 0 ? "+" : ""}${change} since last sync)`;
    }

    const text = `**Threadflow Analytics:**\n
- **Drafts:** ${drafts}
- **Scheduled:** ${scheduled}
- **Published:** ${published}${followerText}
- **Total posts:** ${posts.length}`;

    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "get_follower_history",
  "Get your follower count history over time",
  {
    days: z.number().optional().describe("Number of days of history (default 30)"),
  },
  async ({ days }) => {
    const limit = days || 30;
    const data = await supabaseRequest(
      `follower_history?order=recorded_at.desc&limit=${limit}&select=follower_count,recorded_at`
    );

    if (!Array.isArray(data) || data.length === 0) {
      return { content: [{ type: "text", text: "No follower history yet. Data syncs daily at 6 AM UTC." }] };
    }

    let text = `**Follower history (last ${data.length} day${data.length > 1 ? "s" : ""}):**\n\n`;
    for (const row of data.reverse()) {
      const date = new Date(row.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      text += `- ${date}: ${row.follower_count}\n`;
    }

    const first = data[0].follower_count;
    const last = data[data.length - 1].follower_count;
    const change = last - first;
    text += `\n**Growth:** ${change >= 0 ? "+" : ""}${change} followers over this period`;

    return { content: [{ type: "text", text }] };
  }
);

server.tool(
  "delete_draft",
  "Delete a draft thread from the Content Bank",
  {
    thread_id: z.string().describe("The thread_id to delete"),
  },
  async ({ thread_id }) => {
    const data = await supabaseRequest(
      `posts?thread_id=eq.${thread_id}&status=eq.draft`,
      { method: "DELETE" }
    );
    return {
      content: [{ type: "text", text: `Draft thread ${thread_id} deleted.` }],
    };
  }
);

// --- Start server ---

async function main() {
  if (!API_KEY && !WEBHOOK_SECRET) {
    console.error("Set THREADFLOW_API_KEY or THREADFLOW_WEBHOOK_SECRET environment variable.");
    console.error("Get your API key from your Supabase project settings.");
    process.exit(1);
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
