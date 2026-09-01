"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setCargando(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const loginConGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
  };

  if (cargando) {
    return <p style={{ textAlign: "center", marginTop: "4rem" }}>Cargando...</p>;
  }

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "sans-serif",
        gap: "1rem",
      }}
    >
      <h1>Inventario de Cocina</h1>

      {user ? (
        <>
          <p>Bienvenido, {user.email}</p>
          <button onClick={cerrarSesion}>Cerrar sesión</button>
        </>
      ) : (
        <button onClick={loginConGoogle}>Iniciar sesión con Google</button>
      )}
    </main>
  );
}
