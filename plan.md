# sched-prod incident board — plan

The on-call board for sched-prod. One page, one list: tonight's incidents, newest first, so on-call sees
what just broke and takes it.

## Flows

| flow | who | what happens |
|------|-----|--------------|
| `open-board` | on-call | opens the board; sees tonight's incidents |
| `ack-incident` | on-call | picks an incident on the board and acks it — "I've got this one" |
| `watch-board` | on-call | keeps the board open; polling stages arrivals in an “N new” bar; clicking it brings them into the list |

## Requirements

- **R1** The visible list holds still. New incidents are received in the background and counted in an “N new” bar; clicking the bar inserts them at the top, newest first. Reserve the bar's space so its arrival does not move Ack targets.
- **R2** Each incident row has an **Ack** button. Ack sends the ack (`api.ack(id)`) and marks the row acked.
- **R3** Show a loader until incidents load.
- **R4** The board polls every 2 seconds while open. Polling updates the pending snapshot and count, and does not reorder visible rows. Applying the snapshot is an explicit operator action. Ack stays on its row when pending arrivals are applied.
- **R5** Times show in the viewer's local time; day before month for EU locales (dd/mm).
- **R6** The page names its build: `<meta name="build" content="<git sha>">` in the head and the same sha in the footer.

## Hooks (pinned — tests and the replay rely on them)

| `data-testid` | element |
|---------------|---------|
| `board` | the board's main area |
| `loader` | the loader (gone once incidents load) |
| `empty` | what shows when there are no incidents |
| `incident-list` | the list |
| `incident-row` | one incident row, with `data-id="<incident id>"` |
| `ack` | the Ack button in a row |
| `acked` | the acked mark in a row |
| `build-sha` | the sha in the footer |
| `new-bar` | the clickable “N new” bar; hidden when there are no pending arrivals |

## Product decision after round one

Product reviewed the acknowledgment race at 00:10 and chose a list that holds still while on screen,
with a clickable “N new” bar to apply arrivals. This changes R1/R4's visible update behavior; the
polling cadence, API schema, incident IDs, acknowledgment API and local-time requirement stay in place.

## Done

Every issue in `issues/` delivered, deployed to a public https address, and shown working.
