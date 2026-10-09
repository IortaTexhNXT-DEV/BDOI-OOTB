import React from "react";
import PropTypes from "prop-types";

/** Icon of where a change came from. */
export const SOURCE_ICON = {
  screen: "pi pi-desktop", api: "pi pi-server", job: "pi pi-cog", portal: "pi pi-globe", upload: "pi pi-upload", application: "pi pi-desktop",
};

/** Colour family of an event's marker: creations, removals / refusals, status moves, other changes. */
export const eventTone = (e) => {
  const a = `${e.action || ""} ${e.title || ""}`.toLowerCase();
  if (/(delete|deactivat|reject|cancel|void|revers|declin|lapse|purge|remove)/.test(a)) return "negative";
  if (/(create|registered|issue|activated|added|new )/.test(a) && !/deactivat/.test(a)) return "positive";
  if (/(status|approv|settl|submit|closed|confirm|post)/.test(a)) return "status";
  return "neutral";
};

/** "Ana Reyes · Claims Officer" */
export const UserText = ({ user }) => (
  <span className="bv-audit-user">
    <span className="bv-audit-user__name">{user?.displayName || "System"}</span>
    {user?.roles?.length ? <span className="bv-audit-user__role">{user.roles.join(", ")}</span> : null}
  </span>
);
UserText.propTypes = { user: PropTypes.shape({ displayName: PropTypes.string, roles: PropTypes.arrayOf(PropTypes.string) }) };
UserText.defaultProps = { user: null };

/** "Screen: Operations > Claims > Request approval" with its icon; the API path is kept for the tooltip. */
export const SourceText = ({ source }) => {
  if (!source) return null;
  const screen = source.channel === "screen" && source.name;
  const text = screen ? source.name : source.label;
  return (
    <span className="bv-audit-source" title={source.name ? `${source.label}: ${source.name}` : source.label}>
      <i className={SOURCE_ICON[source.channel] || "pi pi-desktop"} aria-hidden="true" />
      {text}
    </span>
  );
};
SourceText.propTypes = { source: PropTypes.shape({ channel: PropTypes.string, label: PropTypes.string, name: PropTypes.string }) };
SourceText.defaultProps = { source: null };

/** Who and from where, under the headline of an event. */
export const EventMeta = ({ event }) => (
  <div className="bv-audit-event__meta">
    <UserText user={event.user} />
    <span className="bv-audit-sep" aria-hidden="true">·</span>
    <SourceText source={event.source} />
  </div>
);
EventMeta.propTypes = { event: PropTypes.shape({ user: PropTypes.object, source: PropTypes.object }).isRequired };
