"use client";

import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { supabase } from "../lib/supabaseClient";

export default function Home() {
  const [user, setUser] = useState(null);
  const [cargando, setCargando] = useState(true);

  const [perfil, setPerfil] = useState(null);
  const [nombrePreferido, setNombrePreferido] = useState("");

  const [misHogares, setMisHogares] = useState([]);
  const [hogarActivo, setHogarActivo] = useState(null);

  const [zonas, setZonas] = useState([]);
  const [zonaActiva, setZonaActiva] = useState(null);
  const [nombreZona, setNombreZona] = useState("");

  const [productos, setProductos] = useState([]);
  const [nombreProducto, setNombreProducto] = useState("");
  const [cantidadProducto, setCantidadProducto] = useState(1);

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
        await entrarPorQR(data.user.id);
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
          await entrarPorQR(session.user.id);
        } else {
          setPerfil(null);
          setMisHogares([]);
          setHogarActivo(null);
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  // Cuando cambia el hogar activo, recargamos sus zonas
  useEffect(() => {
    if (hogarActivo) {
      cargarZonas(hogarActivo.id);
      setZonaActiva(null);
      setProductos([]);
    } else {
      setZonas([]);
    }
  }, [hogarActivo?.id]);

  // Cuando cambia la zona activa, recargamos sus productos
  useEffect(() => {
    if (zonaActiva) {
      cargarProductos(zonaActiva.id);
    } else {
      setProductos([]);
    }
  }, [zonaActiva?.id]);

  const entrarPorQR = async (userId) => {
    const params = new URLSearchParams(window.location.search);
    const hogarId = params.get("hogar");
    const zonaId = params.get("zona");
    if (!hogarId || !zonaId) return;

    // ¿Ya es miembro de esta casa?
    const { data: miembroExistente } = await supabase
      .from("miembros_hogar")
      .select("rol")
      .eq("hogar_id", hogarId)
      .eq("user_id", userId)
      .maybeSingle();

    let rol = miembroExistente?.rol;

    // Si no es miembro, lo unimos automáticamente (eso es lo que hace el QR especial)
    if (!miembroExistente) {
      const { error } = await supabase
        .from("miembros_hogar")
        .insert({ hogar_id: hogarId, user_id: userId, rol: "miembro" });

      if (error) return; // la casa no existe o algo falló, no hacemos nada más
      rol = "miembro";
    }

    const { data: hogarInfo } = await supabase
      .from("hogares")
      .select("id, nombre")
      .eq("id", hogarId)
      .maybeSingle();

    const { data: zonaInfo } = await supabase
      .from("zonas")
      .select("id, nombre")
      .eq("id", zonaId)
      .maybeSingle();

    if (!hogarInfo || !zonaInfo) return;

    await cargarMisHogares(userId);
    setHogarActivo({ id: hogarInfo.id, nombre: hogarInfo.nombre, rol });
    setZonaActiva({ id: zonaInfo.id, nombre: zonaInfo.nombre });
  };

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
      options: { redirectTo: window.location.href },
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

  const descargarQR = async (zona) => {
    setMensajeError("");
    try {
      const urlZona = `${window.location.origin}?hogar=${hogarActivo.id}&zona=${zona.id}`;
      const urlImagenQR = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(urlZona)}`;

      const respuesta = await fetch(urlImagenQR);
      const blob = await respuesta.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(lector.result);
        lector.onerror = reject;
        lector.readAsDataURL(blob);
      });

      const doc = new jsPDF();
      doc.setFontSize(20);
      doc.text(hogarActivo.nombre, 105, 25, { align: "center" });
      doc.setFontSize(28);
      doc.text(zona.nombre, 105, 40, { align: "center" });
      doc.addImage(dataUrl, "PNG", 55, 55, 100, 100);
      doc.setFontSize(11);
      doc.text("Escanea este código para ver el inventario de esta zona", 105, 170, { align: "center" });
      doc.save(`QR-${zona.nombre}.pdf`);
    } catch (e) {
      setMensajeError("No se pudo generar el PDF. Intenta de nuevo.");
    }
  };

  // ---------- ZONAS ----------

  const cargarZonas = async (hogarId) => {
    const { data } = await supabase
      .from("zonas")
      .select("id, nombre")
      .eq("hogar_id", hogarId)
      .order("nombre");

    setZonas(data || []);
  };

  const crearZona = async () => {
    setMensajeError("");
    if (!nombreZona.trim()) return;

    const { error } = await supabase
      .from("zonas")
      .insert({ hogar_id: hogarActivo.id, nombre: nombreZona.trim() });

    if (error) {
      setMensajeError("No se pudo crear la zona. Intenta de nuevo.");
      return;
    }

    setNombreZona("");
    await cargarZonas(hogarActivo.id);
  };

  const eliminarZona = async (zona) => {
    const confirmar = window.confirm(
      `¿Eliminar la zona "${zona.nombre}"? Esto borra también sus productos.`
    );
    if (!confirmar) return;

    const { error } = await supabase.from("zonas").delete().eq("id", zona.id);

    if (error) {
      setMensajeError("No se pudo eliminar la zona.");
      return;
    }

    if (zonaActiva?.id === zona.id) {
      setZonaActiva(null);
    }
    await cargarZonas(hogarActivo.id);
  };

  const volverAHogar = () => {
    setZonaActiva(null);
    setMensajeError("");
  };

  // ---------- PRODUCTOS ----------

  const cargarProductos = async (zonaId) => {
    const { data } = await supabase
      .from("productos")
      .select("id, nombre, cantidad, unidad")
      .eq("zona_id", zonaId)
      .order("nombre");

    setProductos(data || []);
  };

  const agregarProducto = async () => {
    setMensajeError("");
    if (!nombreProducto.trim()) return;

    const { error } = await supabase.from("productos").insert({
      zona_id: zonaActiva.id,
      nombre: nombreProducto.trim(),
      cantidad: cantidadProducto,
      unidad: "unidad",
    });

    if (error) {
      setMensajeError("No se pudo añadir el producto.");
      return;
    }

    setNombreProducto("");
    setCantidadProducto(1);
    await cargarProductos(zonaActiva.id);
  };

  const cambiarCantidad = async (producto, delta) => {
    const nuevaCantidad = producto.cantidad + delta;
    if (nuevaCantidad < 0) return;

    await supabase
      .from("productos")
      .update({ cantidad: nuevaCantidad })
      .eq("id", producto.id);

    await cargarProductos(zonaActiva.id);
  };

  const eliminarProducto = async (producto) => {
    await supabase.from("productos").delete().eq("id", producto.id);
    await cargarProductos(zonaActiva.id);
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
            placeholder="Tu nombre"
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

      {/* Dentro de una casa específica, viendo sus zonas */}
      {user && hogarActivo && !zonaActiva && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%", maxWidth: "320px" }}>
          <p>Bienvenido a <strong>{hogarActivo.nombre}</strong> (rol: {hogarActivo.rol})</p>

          <div>
            <p style={{ fontSize: "0.85rem", color: "#555", marginBottom: "0.3rem" }}>
              Código de invitación:
            </p>
            <code style={{ display: "block", marginBottom: "0.4rem" }}>{hogarActivo.id}</code>
            <button onClick={copiarCodigo}>
              {copiado ? "¡Copiado!" : "Copiar código"}
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <h3>Zonas</h3>
            {zonas.length === 0 && <p style={{ fontSize: "0.85rem", color: "#777" }}>Aún no hay zonas.</p>}
            {zonas.map((z) => (
              <div key={z.id} style={{ display: "flex", gap: "0.4rem" }}>
                <button style={{ flex: 1 }} onClick={() => setZonaActiva(z)}>
                  {z.nombre}
                </button>
                <button onClick={() => eliminarZona(z)} style={{ color: "red" }}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              type="text"
              placeholder="Nombre de la zona (ej. Nevera)"
              value={nombreZona}
              onChange={(e) => setNombreZona(e.target.value)}
            />
            <button onClick={crearZona}>Añadir zona</button>
          </div>

          {mensajeError && <p style={{ color: "red" }}>{mensajeError}</p>}

          <button onClick={volverAlMenu}>← Cambiar de casa</button>

          {hogarActivo.rol === "dueño" && (
            <button onClick={eliminarHogar} style={{ color: "red" }}>
              Eliminar esta casa
            </button>
          )}

          <button onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      )}

      {/* Dentro de una zona específica, viendo sus productos */}
      {user && zonaActiva && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%", maxWidth: "320px" }}>
          <p>
            <strong>{zonaActiva.nombre}</strong> — {hogarActivo.nombre}
          </p>

          <button onClick={() => descargarQR(zonaActiva)}>
            📄 Descargar QR de esta zona
          </button>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {productos.length === 0 && (
              <p style={{ fontSize: "0.85rem", color: "#777" }}>Aún no hay productos aquí.</p>
            )}
            {productos.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  padding: "0.4rem 0.6rem",
                }}
              >
                <span>{p.nombre}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <button onClick={() => cambiarCantidad(p, -1)}>-</button>
                  <span>{p.cantidad}</span>
                  <button onClick={() => cambiarCantidad(p, 1)}>+</button>
                  <button onClick={() => eliminarProducto(p)} style={{ color: "red" }}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <input
              type="text"
              placeholder="Nombre del producto (ej. Leche)"
              value={nombreProducto}
              onChange={(e) => setNombreProducto(e.target.value)}
            />
            <input
              type="number"
              min="0"
              value={cantidadProducto}
              onChange={(e) => setCantidadProducto(Number(e.target.value))}
            />
            <button onClick={agregarProducto}>Añadir producto</button>
          </div>

          {mensajeError && <p style={{ color: "red" }}>{mensajeError}</p>}

          <button onClick={volverAHogar}>← Volver a {hogarActivo.nombre}</button>
        </div>
      )}
    </main>
  );
}
