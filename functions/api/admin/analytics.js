// GET /api/admin/analytics — fetch Web Analytics stats from CF GraphQL (auth required)
import { requireAuth, json } from "../../_auth.js";

export async function onRequestGet(context) {
  const denied = await requireAuth(context.request, context.env);
  if (denied) return denied;

  const cfgRaw = await context.env.SBI.get("analytics:config");
  if (!cfgRaw) return json({ error: "analytics not configured" }, 404);

  const cfg = JSON.parse(cfgRaw);
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);
  const monthAgo = new Date(now - 30 * 86400000);

  const query = `{
    viewer {
      accounts(filter:{accountTag:"${cfg.accountId}"}) {
        week: rumPageloadEventsAdaptiveGroups(
          filter:{siteTag:"${cfg.siteTag}", datetime_geq:"${weekAgo.toISOString()}", datetime_leq:"${now.toISOString()}"}
          limit:1
        ) { count sum { visits } }
        month: rumPageloadEventsAdaptiveGroups(
          filter:{siteTag:"${cfg.siteTag}", datetime_geq:"${monthAgo.toISOString()}", datetime_leq:"${now.toISOString()}"}
          limit:1
        ) { count sum { visits } }
        daily: rumPageloadEventsAdaptiveGroups(
          filter:{siteTag:"${cfg.siteTag}", datetime_geq:"${weekAgo.toISOString()}", datetime_leq:"${now.toISOString()}"}
          limit:7
        ) { count dimensions { date: datetimeDay } }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { "Authorization": `Bearer ${cfg.apiToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });
    const data = await res.json();
    if (data.errors?.length) return json({ error: data.errors[0].message }, 502);

    const acc = data.data?.viewer?.accounts?.[0];
    if (!acc) return json({ error: "no data" }, 404);

    const week = acc.week?.[0] || { count: 0, sum: { visits: 0 } };
    const month = acc.month?.[0] || { count: 0, sum: { visits: 0 } };
    const daily = (acc.daily || []).map(d => ({ date: d.dimensions.date, views: d.count }));

    return json({
      week: { views: week.count, visits: week.sum.visits },
      month: { views: month.count, visits: month.sum.visits },
      daily
    });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}
