# Service levels

Master > System Configuration > Service Levels holds the turnaround of every status a document waits in (table
`sla_targets`): hours, measured in working time (the working week and the Holiday master, `calendar.working_day_hours`
per day; `src/lib/workingCalendar.js`) or in calendar time, and the roles escalated to on a breach. The delivered rows
are the Pre-BSM M15 workflow statuses (POL-KYC, POL-PEND, POL-PLACED, POL-RECVD, END-REQ, END-PLACED, CAN-REQ,
CAN-DONE), the prospect first contact, the quotation despatch and the claim handling.

`src/lib/sla.js` computes the deadline (`deadlineOf`) and runs the monitor (`slaMonitor`, scheduled job `sla-monitor`
every 30 minutes): for every active target with an open-items query (`OPEN_ITEMS`) it opens a clock (`sla_clocks`) per
open item, closes the clocks of items that left the status, marks the breaches and escalates each breach once (a
notification to the users of the target's roles and to the owner; `sla.escalation_enabled`). My Work shows the open
clocks under Service levels (category `sla`); the register screen lists them with Run now.

Routes: `GET /service-levels`, `GET /service-levels/clocks`, `POST /service-levels/run`, `PUT /service-levels/:code`
(read:settings / write:settings, audited as `sla_target`).
