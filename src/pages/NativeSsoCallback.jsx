import { useEffect, useRef, useState } from "react";
import { signInWithCustomToken, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";

const messages = {
  invalid_code: "This sign-in link is invalid. Reopen the tracker from the Android app.",
  code_expired: "This sign-in link expired. Reopen the tracker from the Android app.",
  code_already_used: "This sign-in link was already used. Reopen the tracker from the Android app.",
  origin_not_allowed: "This sign-in link came from an unrecognized website.",
  backend_not_deployed: "Secure sign-in is not available yet because its Firebase backend has not been deployed.",
  network_error: "Could not reach the secure sign-in service. Check your connection and retry from the Android app.",
  unauthorized: "The secure sign-in request was not authorized. Sign in again in the Android app.",
  callback_failed: "The secure sign-in response could not be completed. Reopen the tracker from the Android app.",
  sso_unavailable: "Secure sign-in is temporarily unavailable. Try again from the Android app.",
};

function safeDiagnostic(stage, code) {
  console.warn("[NativeSSO]", { stage, code });
}

export default function NativeSsoCallback() {
  const navigate = useNavigate();
  const codeRef = useRef("");
  const startedRef = useRef(false);
  const [state, setState] = useState("working");
  const [message, setMessage] = useState("Connecting your Android account securely…");

  const exchange = async (switchAccount = false) => {
    if (!auth || !codeRef.current) return;
    setState("working");
    setMessage("Connecting your Android account securely…");
    try {
      await auth.authStateReady();
      if (switchAccount) await signOut(auth);
      let response;
      try {
        response = await fetch("/api/exchangeNativeSsoCode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify({ code: codeRef.current, currentUid: auth.currentUser?.uid || null }),
        signal: AbortSignal.timeout(15000),
        });
      } catch (error) {
        safeDiagnostic("exchange_request", error?.name === "TimeoutError" ? "timeout" : "network_error");
        setState("error");
        setMessage(messages.network_error);
        return;
      }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("application/json")) {
        safeDiagnostic("exchange_response", `http_${response.status}_non_json`);
        setState("error");
        setMessage(messages.backend_not_deployed);
        return;
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result.error === "web_user_mismatch") {
          setState("mismatch");
          setMessage("This browser is signed into a different tracker account. Switch to the Android account to continue.");
          return;
        }
        safeDiagnostic("exchange_response", typeof result.error === "string" && /^[a-z_]{1,48}$/.test(result.error) ? result.error : `http_${response.status}`);
        setState("error");
        setMessage(messages[result.error] || (response.status === 404 ? messages.backend_not_deployed : "Secure sign-in failed. Reopen the tracker from the Android app."));
        return;
      }
      if (typeof result.customToken !== "string" || !result.customToken || typeof result.uid !== "string" || !result.uid) {
        safeDiagnostic("exchange_response", "malformed_success_response");
        throw new Error("callback_failed");
      }
      const credential = await signInWithCustomToken(auth, result.customToken);
      if (credential.user.uid !== result.uid) {
        await signOut(auth);
        throw new Error("identity_mismatch");
      }
      codeRef.current = "";
      navigate("/", { replace: true });
    } catch (error) {
      const authCode = error?.code;
      const code = typeof authCode === "string" && /^auth\/[a-z0-9-]{1,48}$/.test(authCode) ? authCode : "callback_failed";
      safeDiagnostic("web_auth", code);
      setState("error");
      setMessage(messages[code] || messages.callback_failed);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    codeRef.current = params.get("code") || "";
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    if (!codeRef.current) {
      safeDiagnostic("callback", "missing_code");
      setState("error");
      setMessage("No sign-in code was received. Reopen the tracker from the Android app.");
      return;
    }
    if (!startedRef.current) {
      startedRef.current = true;
      void exchange();
    }
  }, []);

  return <main className="sso-screen" aria-live="polite">
    <section className="sso-card">
      <img src="/app-icon-v2-192.png" alt="" className="sso-logo" />
      <h1>{state === "working" ? "Signing you in" : state === "mismatch" ? "Account confirmation" : "Sign-in needs attention"}</h1>
      <p>{message}</p>
      {state === "mismatch" && <button className="button" type="button" onClick={() => void exchange(true)}>Switch to Android account</button>}
      {state === "error" && <a className="button secondary" href="https://build-skills-9320a.web.app">Return to tracker</a>}
      {state === "working" && <span className="sso-spinner" role="status" aria-label="Loading" />}
    </section>
  </main>;
}
