import { describe, expect, it } from "vitest";
import { authMessage } from "./AuthMessages";

describe("authMessage", () => {
  it("says in plain words why it could not sign in", () => {
    expect(
      authMessage(
        { code: "invalid_credentials", message: "Invalid login credentials" },
        "login",
      ),
    ).toBe("Correo o contraseña incorrectos.");
    expect(
      authMessage(
        { name: "AuthRetryableFetchError", message: "Network request failed" },
        "login",
      ),
    ).toBe("No hay conexión. Para entrar necesitas internet.");
    expect(authMessage({ code: "email_not_confirmed" }, "login")).toBe(
      "Confirma tu correo antes de entrar.",
    );
    expect(authMessage({ code: "user_already_exists" }, "register")).toBe(
      "Ese correo ya tiene cuenta.",
    );
    expect(authMessage({ code: "over_request_rate_limit" }, "login")).toBe(
      "Demasiados intentos. Espera un momento.",
    );
    expect(authMessage({ code: "weak_password" }, "register")).toContain(
      "débil",
    );
  });
  it("never passes an unknown technical message through", () => {
    for (const error of [new Error("JWT audience invalid"), null, "boom"]) {
      expect(authMessage(error, "login")).toBe(
        "No se pudo entrar. Inténtalo de nuevo.",
      );
      expect(authMessage(error, "register")).toBe(
        "No se pudo crear la cuenta. Inténtalo de nuevo.",
      );
    }
  });
});
