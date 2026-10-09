import authService from "../authService";

const answer = (body, ok = true, status = 200) => ({ ok, status, json: async () => body });

describe("Sign in with Microsoft", () => {
  const assign = jest.fn();
  const originalLocation = window.location;

  beforeAll(() => {
    delete window.location;
    window.location = { ...originalLocation, assign };
  });
  afterAll(() => {
    window.location = originalLocation;
  });
  beforeEach(() => {
    global.fetch = jest.fn();
    assign.mockClear();
    sessionStorage.clear();
    localStorage.clear();
  });

  test("start keeps the transaction for this tab and leaves for the Microsoft sign-in page", async () => {
    fetch.mockResolvedValueOnce(answer({ success: true, data: { authorizationUrl: "https://login.microsoftonline.com/t/oauth2/v2.0/authorize?x=1", transaction: "tx-token" } }));
    await authService.startMicrosoftSignIn();
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/auth\/sso\/start$/);
    expect(JSON.parse(init.body).deviceId).toBeTruthy();
    expect(sessionStorage.getItem("bvSsoTransaction")).toBe("tx-token");
    expect(assign).toHaveBeenCalledWith("https://login.microsoftonline.com/t/oauth2/v2.0/authorize?x=1");
  });

  test("the way back sends code, state and transaction once and stores the session", async () => {
    sessionStorage.setItem("bvSsoTransaction", "tx-token");
    fetch.mockResolvedValueOnce(answer({ accessToken: "a", refreshToken: "r", expiresIn: 1800, user: { userId: "usr_1", username: "maria", roles: ["sales"], permissions: [] } }));
    const result = await authService.completeMicrosoftSignIn("the-code", "the-state");
    expect(result.step).toBe("done");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/auth\/sso\/callback$/);
    expect(JSON.parse(init.body)).toMatchObject({ code: "the-code", state: "the-state", transaction: "tx-token" });
    expect(sessionStorage.getItem("bvSsoTransaction")).toBeNull();
    expect(localStorage.getItem("accessToken")).toBe("a");
  });

  test("without a transaction (another tab, or an old link) nothing is sent", async () => {
    await expect(authService.completeMicrosoftSignIn("the-code", "the-state")).rejects.toThrow(/interrupted/);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("the API's refusal is passed on as the message", async () => {
    sessionStorage.setItem("bvSsoTransaction", "tx-token");
    fetch.mockResolvedValueOnce(answer({ success: false, message: "Your Microsoft account is not set up for this application" }, false, 401));
    await expect(authService.completeMicrosoftSignIn("c", "s")).rejects.toThrow(/not set up/);
    expect(localStorage.getItem("accessToken")).toBeNull();
  });
});
