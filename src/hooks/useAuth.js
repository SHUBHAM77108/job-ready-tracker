import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, firebaseEnabled } from "../firebase";

export function useAuth() {
  const [user,setUser] = useState(undefined);
  useEffect(() => {
    if (!firebaseEnabled) { setUser(null); return; }
    return onAuthStateChanged(auth, setUser);
  },[]);
  return {user, setUser, loading:user===undefined, firebaseEnabled};
}
