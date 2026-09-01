"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [perfil, setPerfil] = useState(null);
  const [nombrePreferido, setNombrePreferido] = useState("");

  const [misHogares, setMisHogares] = useState([]);
  const [hogarActivo, setHogarActivo] = useState(null);

  const [nombreHogar, setNombreHogar] = useState("");
  const [codigoInvitacion, setCodigoInvitacion] = useState("");
  const [mensajeError, setMensajeError] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    const inicializar = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
      if (data.user) {
        await cargarPerfil(data.user.id);
        await cargarMisHogares(data.user.id);
      }
      setCargando(false);
    };

    inicializar();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await cargarPerfil(session.user.id);
          await cargarMisHogares(session.user.id);
        } else {
          setPerfil(null);
          setMisHogares([]);
          setHogarActivo(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const cargarPerfil = async (userId) => {
    const { data } = await supabase
      .from("perfiles")
      .select("nombre_mostrar")
      .eq("id", userId)
      .maybeSingle();

    setPerfil(data ? data.nombre_mostrar : null);
  };

  const guardarPerfil = async () => {
    setMensajeError("");
    if (!nombrePreferido.trim()) return;

    const { error } = await supabase
      .from("perfiles")
      .insert({ id: user.id, nombre_mostrar: nombrePreferido.trim() });

    if (error) {
      setMensajeError("No se pudo guardar tu nombre. Intenta de nuevo.");
      return;
    }

    setPerfil(nombrePreferido.trim());
  };

  const cargarMisHogares = async (userId) => {
    const { data } = await supabase
      .from("miembros_hogar")
      .select("hogar_id, rol, hogares(id, nombre)")
      .eq("user_id", userId);

    const lista = (data || []).map((fila) => ({
      id: fila.hogares.id,
      nombre: fila.hogares.nombre,
      rol: fila.rol,
    }));

    setMisHogares(lista);
  };

  const loginConGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  };

  const cerrarSesion = async () => {
    await supabase.auth.signOut();
    setPerfil(null);
    setMisHogares([]);
    setHogarActivo(null);
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

    setNombreHogar("");
    await cargarMisHogares(user.id);
    setHogarActivo({ id: nuevoHogar.id, nombre: nuevoHogar.nombre, rol: "dueño" });
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

    const { data: hogarUnido } = await supabase
      .from("hogares")
      .select("id, nombre")
      .eq("id", codigoInvitacion.trim())
      .maybeSingle();

    setCodigoInvitacion("");
    await cargarMisHogares(user.id);
    if (hogarUnido) {
      setHogarActivo({ id: hogarUnido.id, nombre: hogarUnido.nombre, rol: "miembro" });
    }
  };

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(hogarActivo.id);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch (e) {
      setMensajeError("No se pudo copiar. Copia el código manualmente.");
    }
  };

  const volverAlMenu = () => {
    setHogarActivo(null);
    setMensajeError("");
  };

  const eliminarHogar = async () => {
    const confirmar = window.confirm(
      `¿Seguro que quieres eliminar "${hogarActivo.nombre}"? Esto borra también todas sus zonas y productos. Esta acción no se puede deshacer.`
    );
    if (!confirmar) return;

    const { error } = await supabase
      .from("hogares")
      .delete()
      .eq("id", hogarActivo.id);

    if (error) {
      setMensajeError("No se pudo eliminar el hogar. Intenta de nuevo.");
      return;
    }

    setHogarActivo(null);
    await cargarMisHogares(user.id);
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

      {/* No ha iniciado sesión */}
      {!user && (
        <button onClick={loginConGoogle}>Iniciar sesión con Google</button>
      )}

      {/* Ya inició sesión pero no ha elegido un nombre para mostrar */}
      {user && perfil === null && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", width: "100%", maxWidth: "320px" }}>
          <p>¿Cómo quieres que te llamemos dentro de la app?</p>
          <input
            type="text"
            placeholder="Ej. David"
            value={nombrePreferido}
            onChange={(e) => setNombrePreferido(e.target.value)}
          />
          <button onClick={guardarPerfil}>Guardar</button>
          {mensajeError && <p style={{ color: "red" }}>{mensajeError}</p>}
        </div>
      )}

      {/* Menú principal: elegir casa, crear una nueva, o unirse a otra */}
      {user && perfil !== null && !hogarActivo && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem", width: "100%", maxWidth: "320px" }}>
          <p>Hola {perfil}, ¿a cuál casa quieres entrar?</p>

          {misHogares.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {misHogares.map((h) => (
                <button key={h.id} onClick={() => setHogarActivo(h)}>
                  {h.nombre} ({h.rol})
                </button>
              ))}
            </div>
          )}

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

      {/* Dentro de una casa específica */}
      {user && hogarActivo && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <p>Bienvenido a <strong>{hogarActivo.nombre}</strong> (rol: {hogarActivo.rol})</p>

          <div>
            <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "0.3rem" }}>
              Código de invitación para compartir con tu familia:
            </p>
            <code style={{ display: "block", marginBottom: "0.4rem" }}>{hogarActivo.id}</code>
            <button onClick={copiarCodigo}>
              {copiado ? "¡Copiado!" : "Copiar código"}
            </button>
          </div>

          <button onClick={volverAlMenu}>← Cambiar de casa</button>

          {hogarActivo.rol === "dueño" && (
            <button onClick={eliminarHogar} style={{ color: "red" }}>
              Eliminar esta casa
            </button>
          )}

          <button onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      )}
    </main>
  );
}
