import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firebaseEnabled } from "../firebase";
import { getGoogleRedirectResult } from "../services/authService";

export function useAuth() {
  const [user,setUser] = useState(undefined);
  const [redirectError,setRedirectError] = useState(null);
  useEffect(() => {
    if (!firebaseEnabled) { setUser(null); return; }
    const unsubscribe = onAuthStateChanged(auth, setUser);
    getGoogleRedirectResult().catch(setRedirectError);
    return unsubscribe;
  },[]);
  return {user, setUser, loading:user===undefined, firebaseEnabled, redirectError, clearRedirectError:()=>setRedirectError(null)};
}
