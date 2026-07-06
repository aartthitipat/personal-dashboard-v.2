// Supabase Edge Function: class-reminder
//
// Invoked every minute by a pg_cron job (see migration `schedule_class_reminders`)
// via pg_net. Checks today's Study Session events *and* today's occurrences of
// any recurring weekly class_schedule, and posts a Discord webhook message 5
// minutes before each one starts, so the reminder lands as a phone push
// notification through the Discord app rather than depending on a browser tab
// being open.
//
// One-off events use `events.reminder_sent_at` to avoid double-posting.
// Recurring occurrences have no row of their own (see class_schedule +
// class_schedule_exceptions in migration `add_recurring_class_schedule`), so
// they're deduped through `class_schedule_notifications` (schedule_id, date)
// instead.
//
// Timezone is hardcoded to Asia/Bangkok since events are entered using the
// user's local device clock but this function runs in UTC.
//
// Requires the DISCORD_WEBHOOK_URL secret to be set on this function
// (Supabase Dashboard -> Edge Functions -> class-reminder -> Secrets, or
// `supabase secrets set DISCORD_WEBHOOK_URL=...`). Not set here because it
// functions like a credential — anyone holding it can post to the channel.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const TIMEZONE = 'Asia/Bangkok';
const LEAD_MINUTES = 5;

function nowInTimezone() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  return { date, minutes };
}

function minutesOf(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function dayOfWeekOf(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

async function postReminder(webhookUrl: string, title: string, location: string | null) {
  const content = `\u{1F514} **${title}** starts in ${LEAD_MINUTES} min${location ? ` — ${location}` : ''}`;
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!resp.ok) {
    console.error('Discord webhook error', resp.status, await resp.text());
    return false;
  }
  return true;
}

Deno.serve(async () => {
  const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');
  if (!webhookUrl) {
    return new Response(JSON.stringify({ error: 'DISCORD_WEBHOOK_URL not configured' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { date: todayISO, minutes: nowMinutes } = nowInTimezone();
  const todayDow = dayOfWeekOf(todayISO);

  let notified = 0;
  let checked = 0;

  // --- One-off events (Study Session, but also exam/deadline/task rows with a start_time) ---
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, title, location, start_time')
    .eq('date', todayISO)
    .eq('type', 'session')
    .is('reminder_sent_at', null)
    .not('start_time', 'is', null);

  if (eventsError) {
    console.error('class-reminder events query error', eventsError);
    return new Response(JSON.stringify({ error: eventsError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  checked += events?.length ?? 0;
  for (const ev of events ?? []) {
    const minutesUntilStart = minutesOf(ev.start_time) - nowMinutes;
    if (minutesUntilStart > LEAD_MINUTES || minutesUntilStart < 0) continue;
    if (!(await postReminder(webhookUrl, ev.title, ev.location))) continue;
    await supabase.from('events').update({ reminder_sent_at: new Date().toISOString() }).eq('id', ev.id);
    notified += 1;
  }

  // --- Recurring weekly classes due today ---
  const { data: schedules, error: schedError } = await supabase
    .from('class_schedule')
    .select('id, title, day_of_week, start_time, location, valid_from, valid_until')
    .eq('day_of_week', todayDow)
    .lte('valid_from', todayISO)
    .or(`valid_until.is.null,valid_until.gte.${todayISO}`);

  if (schedError) {
    console.error('class-reminder schedule query error', schedError);
    return new Response(JSON.stringify({ error: schedError.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const dueToday = schedules ?? [];
  if (dueToday.length) {
    const scheduleIds = dueToday.map((s) => s.id);

    const { data: exceptions, error: excError } = await supabase
      .from('class_schedule_exceptions')
      .select('schedule_id')
      .eq('date', todayISO)
      .in('schedule_id', scheduleIds);
    if (excError) {
      console.error('class-reminder exceptions query error', excError);
      return new Response(JSON.stringify({ error: excError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const skippedIds = new Set((exceptions ?? []).map((e) => e.schedule_id));

    const { data: alreadyNotified, error: notifError } = await supabase
      .from('class_schedule_notifications')
      .select('schedule_id')
      .eq('date', todayISO)
      .in('schedule_id', scheduleIds);
    if (notifError) {
      console.error('class-reminder notifications query error', notifError);
      return new Response(JSON.stringify({ error: notifError.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const notifiedIds = new Set((alreadyNotified ?? []).map((n) => n.schedule_id));

    const pending = dueToday.filter((s) => !skippedIds.has(s.id) && !notifiedIds.has(s.id));
    checked += pending.length;

    for (const s of pending) {
      const minutesUntilStart = minutesOf(s.start_time) - nowMinutes;
      if (minutesUntilStart > LEAD_MINUTES || minutesUntilStart < 0) continue;
      if (!(await postReminder(webhookUrl, s.title, s.location))) continue;
      await supabase.from('class_schedule_notifications').insert({ schedule_id: s.id, date: todayISO });
      notified += 1;
    }
  }

  return new Response(JSON.stringify({ checked, notified }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
