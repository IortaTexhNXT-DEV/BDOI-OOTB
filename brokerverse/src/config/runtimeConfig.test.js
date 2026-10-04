import { render, screen } from "@testing-library/react";
import { execFileSync } from "child_process";
import path from "path";
import vm from "vm";
import { resolveConfig, normaliseApiBaseUrl, DEFAULT_API_BASE_URL, RUNTIME_CONFIG_GLOBAL } from "./runtimeConfig";
import EnvironmentBadge from "../components/EnvironmentBadge";

describe("resolveConfig: API address", () => {
  test("defaults to the same-origin /api when nothing is configured", () => {
    const c = resolveConfig(undefined, {});
    expect(c.apiBaseUrl).toBe(DEFAULT_API_BASE_URL);
    expect(c.apiBaseUrl).toBe("/api");
    expect(c.source).toBe("default");
  });

  test("the runtime file wins over the build-time value", () => {
    const c = resolveConfig({ API_BASE_URL: "https://api.uat.example.ph/api/" }, { REACT_APP_BASE_URL: "https://old.example.ph/api" });
    expect(c.apiBaseUrl).toBe("https://api.uat.example.ph/api");
    expect(c.source).toBe("runtime");
  });

  test("falls back to the build-time REACT_APP_BASE_URL when the runtime value is empty (older deployments)", () => {
    const c = resolveConfig({ API_BASE_URL: "" }, { REACT_APP_BASE_URL: "https://demo-api.example.ph/api" });
    expect(c.apiBaseUrl).toBe("https://demo-api.example.ph/api");
    expect(c.source).toBe("build");
  });

  test("ignores unfilled placeholders and unsafe values", () => {
    // eslint-disable-next-line no-template-curly-in-string -- an unfilled shell placeholder, on purpose
    expect(resolveConfig({ API_BASE_URL: "${API_BASE_URL}" }, {}).apiBaseUrl).toBe("/api");
    expect(resolveConfig({ API_BASE_URL: "__API_BASE_URL__" }, {}).apiBaseUrl).toBe("/api");
    // eslint-disable-next-line no-script-url -- the value that must be refused
    expect(resolveConfig({ API_BASE_URL: "javascript:alert(1)" }, {}).apiBaseUrl).toBe("/api");
    expect(normaliseApiBaseUrl("api.example.ph")).toBe("");
    expect(normaliseApiBaseUrl("/api///")).toBe("/api");
  });
});

describe("resolveConfig: environment label", () => {
  test("no label in production or when no name is set", () => {
    expect(resolveConfig({}, {}).showEnvironmentBanner).toBe(false);
    expect(resolveConfig({ ENVIRONMENT_NAME: "production" }, {}).showEnvironmentBanner).toBe(false);
    expect(resolveConfig({ ENVIRONMENT_NAME: "PROD" }, {}).isProduction).toBe(true);
  });

  test("non-production environments get a label with a default colour per name", () => {
    const uat = resolveConfig({ ENVIRONMENT_NAME: "uat" }, {});
    expect(uat).toMatchObject({ environmentName: "UAT", showEnvironmentBanner: true, isProduction: false, environmentColor: "#b45309" });
    expect(resolveConfig({ ENVIRONMENT_NAME: "SIT" }, {}).environmentColor).toBe("#6d28d9");
    expect(resolveConfig({ ENVIRONMENT_NAME: "Training" }, {}).environmentColor).toBe("#0f766e");
    expect(resolveConfig({ ENVIRONMENT_NAME: "SANDBOX" }, {}).environmentColor).toBe("#475569");
  });

  test("an explicit colour is used only when it is a hex colour", () => {
    expect(resolveConfig({ ENVIRONMENT_NAME: "UAT", ENVIRONMENT_COLOR: "#0a7" }, {}).environmentColor).toBe("#0a7");
    expect(resolveConfig({ ENVIRONMENT_NAME: "UAT", ENVIRONMENT_COLOR: "red;background:url(x)" }, {}).environmentColor).toBe("#b45309");
  });

  test("build-time name is the fallback; runtime name wins", () => {
    expect(resolveConfig({}, { REACT_APP_ENVIRONMENT_NAME: "DEV" }).environmentName).toBe("DEV");
    expect(resolveConfig({ ENVIRONMENT_NAME: "UAT" }, { REACT_APP_ENVIRONMENT_NAME: "DEV" }).environmentName).toBe("UAT");
  });

  test("analytics stay off unless explicitly enabled", () => {
    expect(resolveConfig({}, {}).analyticsEnabled).toBe(false);
    expect(resolveConfig({ ANALYTICS_ENABLED: true }, {}).analyticsEnabled).toBe(true);
    expect(resolveConfig({ ANALYTICS_ENABLED: "false" }, {}).analyticsEnabled).toBe(false);
  });

  test("the result cannot be changed by the app", () => {
    expect(Object.isFrozen(resolveConfig({}, {}))).toBe(true);
  });
});

describe("EnvironmentBadge", () => {
  test("shows the environment name in its colour", () => {
    render(<EnvironmentBadge config={resolveConfig({ ENVIRONMENT_NAME: "UAT" }, {})} />);
    const badge = screen.getByTestId("environment-badge");
    expect(badge).toHaveTextContent("UAT");
    expect(badge).toHaveStyle({ backgroundColor: "#b45309" });
  });

  test("renders nothing in production", () => {
    const { container } = render(<EnvironmentBadge config={resolveConfig({ ENVIRONMENT_NAME: "PRODUCTION" }, {})} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("scripts/env-config.sh", () => {
  const script = path.join(__dirname, "..", "..", "scripts", "env-config.sh");
  const run = (env) => execFileSync("sh", [script], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8", stdio: "pipe" });
  const load = (source) => {
    const sandbox = { window: {} };
    vm.runInNewContext(source, sandbox);
    return sandbox.window[RUNTIME_CONFIG_GLOBAL];
  };

  test("writes a file the config module reads", () => {
    const rt = load(run({ API_BASE_URL: "https://api.uat.example.ph/api", ENVIRONMENT_NAME: "UAT", ANALYTICS_ENABLED: "no" }));
    expect(rt).toEqual({ API_BASE_URL: "https://api.uat.example.ph/api", ENVIRONMENT_NAME: "UAT", ENVIRONMENT_COLOR: "", ANALYTICS_ENABLED: false });
    expect(resolveConfig(rt, {})).toMatchObject({ apiBaseUrl: "https://api.uat.example.ph/api", environmentName: "UAT", showEnvironmentBanner: true });
  });

  test("with no variables the app uses the same-origin /api and shows no label", () => {
    const c = resolveConfig(load(run({})), {});
    expect(c).toMatchObject({ apiBaseUrl: "/api", showEnvironmentBanner: false });
  });

  test("refuses values that could break out of the script", () => {
    expect(() => run({ API_BASE_URL: 'https://x/api";alert(1)//' })).toThrow();
    expect(() => run({ ENVIRONMENT_NAME: "</script><script>" })).toThrow();
    expect(() => run({ ENVIRONMENT_COLOR: "red" })).toThrow();
  });
});
