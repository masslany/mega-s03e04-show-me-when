import { fetchIncidents, ack } from './api.js';

const list = document.querySelector('[data-testid="incident-list"]');
const loader = document.querySelector('[data-testid="loader"]');
const empty = document.querySelector('[data-testid="empty"]');
const status = document.querySelector('.status');
const rows = new Map();
const timeFormat = new Intl.DateTimeFormat(navigator.language, {
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});
let loading = false;

function makeRow(incident) {
  const row = document.createElement('li');
  row.dataset.testid = 'incident-row';
  row.dataset.id = incident.id;
  row.className = `row ${incident.severity}`;

  for (const [className, text] of [
    ['id', incident.id], ['sev', incident.severity],
    ['what', `${incident.service} · ${incident.region} · ${incident.summary}`],
  ]) {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    row.append(span);
  }

  const time = document.createElement('time');
  time.dateTime = incident.openedAt;
  time.textContent = timeFormat.format(new Date(incident.openedAt));
  time.title = `${incident.openedAt} (UTC)`;
  row.append(time);

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.testid = 'ack';
  button.textContent = 'Ack';
  button.setAttribute('aria-label', `Ack ${incident.id}`);
  button.addEventListener('click', async () => {
    button.disabled = true;
    button.textContent = 'Acking…';
    try {
      await ack(incident.id);
      button.remove();
      const mark = document.createElement('span');
      mark.dataset.testid = 'acked';
      mark.className = 'acked';
      mark.textContent = 'Acked';
      row.append(mark);
      status.textContent = `${incident.id} acknowledged.`;
    } catch {
      button.disabled = false;
      button.textContent = 'Ack';
      status.textContent = `Could not acknowledge ${incident.id}. Try again.`;
    }
  });
  row.append(button);
  return row;
}

function render(incidents) {
  const sorted = [...incidents].sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt));
  const current = new Set(sorted.map(i => i.id));
  for (const [id, row] of rows) {
    if (!current.has(id)) { row.remove(); rows.delete(id); }
  }
  sorted.forEach((incident, index) => {
    if (!rows.has(incident.id)) rows.set(incident.id, makeRow(incident));
    const row = rows.get(incident.id);
    if (list.children[index] !== row) list.insertBefore(row, list.children[index] || null);
  });
  empty.hidden = incidents.length > 0;
  loader.remove();
  list.hidden = false;
}

async function refresh() {
  if (loading) return;
  loading = true;
  try {
    const page = await fetchIncidents();
    render(page.incidents);
    if (status.dataset.error) { status.textContent = ''; delete status.dataset.error; }
  } catch {
    status.textContent = 'Could not refresh incidents. Retrying every 2 seconds.';
    status.dataset.error = 'true';
  } finally {
    loading = false;
  }
}

void refresh();
setInterval(refresh, 2000);
