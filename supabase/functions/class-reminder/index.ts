// Supabase Edge Function: class-reminder
//
// Invoked every minute by a pg_cron job (see migration `schedule_class_reminders`)
// via pg_net. Checks today's Study Session events and posts a Discord webhook
// message 5 minutes before each one starts, so the reminder lands as a phone
// push notification through the Discord app rather than depending on a
// browser tab being open.
//
// `events.reminder_sent_at` marks an event as already notified so repeated
// cron ticks (every minute, 5-minute lead window) don't double-post.
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

  const { data: events, error } = await supabase
    .from('events')
    .select('id, title, location, start_time')
    .eq('date', todayISO)
    .eq('type', 'session')
    .is('reminder_sent_at', null)
    .not('start_time', 'is', null);

  if (error) {
    console.error('class-reminder query error', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let notified = 0;
  for (const ev of events ?? []) {
    const minutesUntilStart = minutesOf(ev.start_time) - nowMinutes;
    if (minutesUntilStart > LEAD_MINUTES || minutesUntilStart < 0) continue;

    const content = `\u{1F514} **${ev.title}** starts in ${LEAD_MINUTES} min${ev.location ? ` — ${ev.location}` : ''}`;
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });

    if (!resp.ok) {
      console.error('Discord webhook error', resp.status, await resp.text());
      continue;
    }

    await supabase.from('events').update({ reminder_sent_at: new Date().toISOString() }).eq('id', ev.id);
    notified += 1;
  }

  return new Response(JSON.stringify({ checked: events?.length ?? 0, notified }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
