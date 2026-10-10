import { useEffect, useState } from "react";
import { featureList, featureStatus, subscribeFeatures } from "./entitlements";

/**
 * The state of a feature for a screen: "on", "read-only" or "off" (features/entitlements.js). Re-renders when the state
 * of the environment changes.
 * @param {string} name feature key of the catalogue (backend modules/features/catalogue.js)
 */
export const useFeature = (name) => {
  const [status, setStatus] = useState(() => featureStatus(name, featureList()));
  useEffect(() => subscribeFeatures((list) => setStatus(featureStatus(name, list))), [name]);
  return { status, on: status === "on", readOnly: status === "read-only", visible: status !== "off" };
};

/** The features that are not plainly on, re-read when the state of the environment changes (menus, route guard). */
export const useFeatureList = () => {
  const [list, setList] = useState(featureList);
  useEffect(() => subscribeFeatures(setList), []);
  return list;
};

/**
 * A section, tab, panel or widget of an in-scope screen that belongs to a feature of another release: shown while the
 * feature is on (and, with `readOnly`, while it is read-only); `fallback` otherwise.
 *
 *   <Feature name="coinsurance"><ParticipantsGrid /></Feature>
 */
const Feature = ({ name, readOnly = false, fallback = null, children }) => {
  const { on, readOnly: ro } = useFeature(name);
  return on || (readOnly && ro) ? children : fallback;
};

export default Feature;
