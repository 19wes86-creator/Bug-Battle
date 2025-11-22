import { Bug, User } from "../types";
import { firebaseConfig } from "./firebaseConfig";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, addDoc } from "firebase/firestore";

const BUGS_KEY = 'bb_bugs';
const SESSION_KEY = 'bb_session_user';
const USERS_DB_KEY = 'bb_users_db';

// -- HYBRID SYSTEM --
// If apiKey is present, use Firebase. Otherwise, use LocalStorage.
const useFirebase = firebaseConfig.apiKey && firebaseConfig.apiKey.length > 0;

let auth: any;
let db: any;

if (useFirebase) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  console.log("Storage Mode: FIREBASE (Multiplayer Active)");
} else {
  console.log("Storage Mode: LOCAL STORAGE (Single Player Only - Add keys to firebaseConfig.ts to go live)");
}

// -- HELPER: LOCAL STORAGE --
const getLocalBugs = (): Bug[] => {
  const stored = localStorage.getItem(BUGS_KEY);
  return stored ? JSON.parse(stored) : [];
};
const getLocalUsers = (): User[] => {
  const stored = localStorage.getItem(USERS_DB_KEY);
  return stored ? JSON.parse(stored) : [];
};

// -- PUBLIC API (ASYNC) --

export const observeAuthState = (callback: (user: User | null) => void) => {
  if (useFirebase) {
    return onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        // Fetch our custom user details from Firestore
        const userDoc = await getDoc(doc(db, "users", fbUser.uid));
        if (userDoc.exists()) {
          callback(userDoc.data() as User);
        } else {
          // Fallback if doc missing
          callback({
            id: fbUser.uid,
            email: fbUser.email || "",
            username: "Unknown",
            isVerified: fbUser.emailVerified
          });
        }
      } else {
        callback(null);
      }
    });
  } else {
    // Local Storage implementation
    const checkSession = () => {
      const u = localStorage.getItem(SESSION_KEY);
      callback(u ? JSON.parse(u) : null);
    };
    checkSession();
    return () => {}; // No-op unsubscribe
  }
};

export const getBugs = async (): Promise<Bug[]> => {
  if (useFirebase) {
    const snapshot = await getDocs(collection(db, "bugs"));
    return snapshot.docs.map(d => d.data() as Bug);
  } else {
    return new Promise(resolve => setTimeout(() => resolve(getLocalBugs()), 300));
  }
};

export const saveBug = async (bug: Bug): Promise<void> => {
  if (useFirebase) {
    // Use addDoc to let Firestore generate ID, or setDoc if ID is pre-generated
    await setDoc(doc(db, "bugs", bug.id), bug); 
  } else {
    const bugs = getLocalBugs();
    bugs.push(bug);
    localStorage.setItem(BUGS_KEY, JSON.stringify(bugs));
    return Promise.resolve();
  }
};

export const updateBug = async (updatedBug: Bug): Promise<void> => {
  if (useFirebase) {
    await updateDoc(doc(db, "bugs", updatedBug.id), { ...updatedBug });
  } else {
    const bugs = getLocalBugs();
    const index = bugs.findIndex(b => b.id === updatedBug.id);
    if (index !== -1) {
      bugs[index] = updatedBug;
      localStorage.setItem(BUGS_KEY, JSON.stringify(bugs));
    }
    return Promise.resolve();
  }
};

// -- AUTH --

export const registerUser = async (userData: User, password?: string): Promise<User> => {
  if (useFirebase && password) {
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, password);
    const newUser: User = {
      ...userData,
      id: userCredential.user.uid,
      isVerified: false // In real app, use sendEmailVerification(userCredential.user)
    };
    // Save extra profile data to Firestore
    await setDoc(doc(db, "users", newUser.id), newUser);
    return newUser;
  } else {
    const users = getLocalUsers();
    if (users.some(u => u.email.toLowerCase() === userData.email.toLowerCase())) {
      throw new Error("Email already registered.");
    }
    users.push(userData);
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
    localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
    return Promise.resolve(userData);
  }
};

export const authenticateUser = async (email: string, password?: string): Promise<User> => {
  if (useFirebase && password) {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
    if (userDoc.exists()) {
      return userDoc.data() as User;
    }
    throw new Error("User profile not found.");
  } else {
    const users = getLocalUsers();
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) throw new Error("Invalid email or password.");
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return Promise.resolve(user);
  }
};

export const logoutUser = async (): Promise<void> => {
  if (useFirebase) {
    await signOut(auth);
  } else {
    localStorage.removeItem(SESSION_KEY);
    return Promise.resolve();
  }
};

export const updateUserSession = async (user: User): Promise<void> => {
  if (useFirebase) {
    await updateDoc(doc(db, "users", user.id), { ...user });
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    const users = getLocalUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = user;
      localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
    }
    return Promise.resolve();
  }
};