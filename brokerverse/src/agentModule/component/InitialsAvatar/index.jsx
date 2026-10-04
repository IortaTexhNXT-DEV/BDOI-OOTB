import React from "react";
import { currentUser, initialsOf } from "../../../utility/userIdentity";
import "./index.scss";

/**
 * Initials avatar. `person` is { firstName, lastName, displayName, username } (defaults to the signed-in user);
 * a plain `name` string is still accepted.
 */
const InitialsAvatar = ({ person, name, size = "40px", className = "" }) => {
  const who = person || (name != null ? { displayName: name } : currentUser());
  const initials = initialsOf(who) || "";
  return (
    <span
      className={`bv-avatar ${className}`}
      style={{ width: size, height: size, fontSize: `calc(${size} * 0.38)` }}
      aria-hidden="true"
    >
      {initials || <i className="pi pi-user" />}
    </span>
  );
};

export default InitialsAvatar;
