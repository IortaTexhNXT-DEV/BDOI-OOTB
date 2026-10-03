import React from "react";
import { Avatar } from "primereact/avatar";

const initialsOf = (name) =>
  String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("") || "?";

/** Initials avatar for the signed-in user (defaults to the stored display name). */
const InitialsAvatar = ({ name, size = "40px", className }) => (
  <Avatar
    label={initialsOf(name ?? localStorage.getItem("USER_NAME"))}
    shape="circle"
    className={className}
    style={{ width: size, height: size, backgroundColor: "#0072d8", color: "#ffffff" }}
  />
);

export default InitialsAvatar;
