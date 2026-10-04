import runtimeConfig from "../../config/runtimeConfig";
import "./index.scss";

/**
 * Small coloured label with the environment name (DEV, SIT, UAT, PREPROD...) shown next to the logo, so testers
 * always know which environment they are in. Nothing is rendered in production or when no name is configured.
 * The name and colour come from /env-config.js (ENVIRONMENT_NAME, ENVIRONMENT_COLOR).
 */
const EnvironmentBadge = ({ config = runtimeConfig, className = "" }) => {
  if (!config?.showEnvironmentBanner) return null;
  const name = config.environmentName;
  return (
    <span
      className={`bv-env-badge ${className}`.trim()}
      style={{ backgroundColor: config.environmentColor }}
      title={`${name} environment (not production)`}
      aria-label={`${name} environment`}
      data-testid="environment-badge"
    >
      {name}
    </span>
  );
};

export default EnvironmentBadge;
