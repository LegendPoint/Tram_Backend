import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, signInWithEmailAndPassword } from '../config/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const UserAuthContext = createContext();

export function UserAuthContextProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    function login(email, password) {
        return signInWithEmailAndPassword(auth, email, password);
    }

    function logout() {
        return signOut(auth);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    return (
        <UserAuthContext.Provider value={{ user, loading, login, logout }}>
            {!loading && children}
        </UserAuthContext.Provider>
    );
}

export function useUserAuth() {
    const context = useContext(UserAuthContext);
    if (!context) {
        throw new Error('useUserAuth must be used within a UserAuthContextProvider');
    }
    return context;
}


