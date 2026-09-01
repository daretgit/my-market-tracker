"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [user, setUser] = useState(null);
  const [hogar, setHogar] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [nombreHogar, setNombreHogar] = useState("");
  const [codigoInvitacion, setCodigoInvitacion] = useState("");
  const [mensajeError, setMensajeError] = useState("");

  useEffect(() => {
    const inicializar = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (data.user) {
        await cargarHogar(data.user.id);
      }
      setCargando(false);
    };

    inicializar();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await cargarHogar(session.user.id);
        } else {
          setHogar(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const cargarHogar = async (userId) => {
    const { data } = await supabase
      .from("miembros_hogar")
      .select("hogar_id, rol, hogares(id, nombre)")
      .eq("user_id", userId)
      .maybeSingle();

    setHogar(data ? { id: data.hogares.id, nombre: data.hogares.nombre, rol: data.rol } : null);
  };

  const loginConGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setHogar(null);
  };

  const crearHogar = async () => {
    setMensajeError("");
    if (!nombreHogar.trim()) return;

    const { data: nuevoHogar, error: errorHogar } = await supabase
      .from("hogares")
      .insert({ nombre: nombreHogar.trim(), creado_por: user.id })
      .select()
      .single();

    if (errorHogar) {
      setMensajeError("No se pudo crear el hogar. Intenta de nuevo.");
      return;
    }

    const { error: errorMiembro } = await supabase
      .from("miembros_hogar")
      .insert({ hogar_id: nuevoHogar.id, user_id: user.id, rol: "dueño" });

    if (errorMiembro) {
      setMensajeError("El hogar se creó pero hubo un error al unirte. Contacta soporte.");
      return;
    }

    await cargarHogar(user.id);
  };

  const unirseAHogar = async () => {
    setMensajeError("");
    if (!codigoInvitacion.trim()) return;

    const { error } = await supabase
      .from("miembros_hogar")
      .insert({ hogar_id: codigoInvitacion.trim(), user_id: user.id, rol: "miembro" });

    if (error) {
      setMensajeError("Código inválido, o ya perteneces a ese hogar.");
      return;
    }

    await cargarHogar(user.id);
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
        padding: "1rem",
        textAlign: "center",
      }}
    >
      <h1>My Market Tracker</h1>

      {!user && (
        <button onClick={loginConGoogle}>Iniciar sesión con Google</button>
      )}

      {user && !hogar && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", width: "100%", maxWidth: "320px" }}>
          <p>Hola {user.email}, aún no perteneces a ningún hogar.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h3>Crear un hogar nuevo</h3>
            <input
              type="text"
              placeholder="Nombre del hogar (ej. Casa de David)"
              value={nombreHogar}
              onChange={(e) => setNombreHogar(e.target.value)}
            />
            <button onClick={crearHogar}>Crear hogar</button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h3>Unirme a un hogar existente</h3>
            <input
              type="text"
              placeholder="Código de invitación"
              value={codigoInvitacion}
              onChange={(e) => setCodigoInvitacion(e.target.value)}
            />
            <button onClick={unirseAHogar}>Unirme</button>
          </div>

          {mensajeError && <p style={{ color: "red" }}>{mensajeError}</p>}

          <button onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      )}

      {user && hogar && (
        <div>
          <p>Bienvenido a <strong>{hogar.nombre}</strong> (rol: {hogar.rol})</p>
          <p style={{ fontSize: "0.85rem", color: "#555" }}>
            Código de invitación para compartir con tu familia:
            <br />
            <code>{hogar.id}</code>
          </p>
          <button onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      )}
    </main>
  );
}
