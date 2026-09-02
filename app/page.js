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

  const [zonas, setZonas] = useState([]);
  const [zonaActiva, setZonaActiva] = useState(null);
  const [nombreZona, setNombreZona] = useState("");

  const [productos, setProductos] = useState([]);
  const [nombreProducto, setNombreProducto] = useState("");
  const [cantidadProducto] = useState(0);
  const [fechaCaducidad, setFechaCaducidad] = useState("");
  const [cantidadIdeal, setCantidadIdeal] = useState("");

  const [nombreHogar, setNombreHogar] = useState("");
  const [codigoInvitacion, setCodigoInvitacion] = useState("");
  const [mensajeError, setMensajeError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [mostrarInvitacion, setMostrarInvitacion] = useState(false);
  const [tema, setTema] = useState("light");

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    const temaGuardado = typeof window !== "undefined" ? localStorage.getItem("tema") : null;
    if (temaGuardado === "dark") {
      setTema("dark");
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", tema);
    localStorage.setItem("tema", tema);
  }, [tema]);

  const alternarTema = () => {
    setTema((t) => (t === "light" ? "dark" : "light"));
  };

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

  // Cuando cambia el espacio activo, recargamos sus zonas
  useEffect(() => {
    if (hogarActivo) {
      cargarZonas(hogarActivo.id);
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
    if (!hogarId) return;

    const { data: miembroExistente } = await supabase
      .from("miembros_hogar")
      .select("rol")
      .eq("hogar_id", hogarId)
      .eq("user_id", userId)
      .maybeSingle();

    let rol = miembroExistente?.rol;

    if (!miembroExistente) {
      const { error } = await supabase
        .from("miembros_hogar")
        .insert({ hogar_id: hogarId, user_id: userId, rol: "miembro" });

      if (error) return;
      rol = "miembro";
    }

    const { data: hogarInfo } = await supabase
      .from("hogares")
      .select("id, nombre")
      .eq("id", hogarId)
      .maybeSingle();

    if (!hogarInfo) return;

    await cargarMisHogares(userId);
    setZonaActiva(null);
    setHogarActivo({ id: hogarInfo.id, nombre: hogarInfo.nombre, rol });
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
      setMensajeError("No se pudo crear el espacio. Intenta de nuevo.");
      return;
    }

    const { error: errorMiembro } = await supabase
      .from("miembros_hogar")
      .insert({ hogar_id: nuevoHogar.id, user_id: user.id, rol: "dueño" });

    if (errorMiembro) {
      setMensajeError("El espacio se creó pero hubo un error al unirte. Contacta soporte.");
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
      setMensajeError("Código inválido, o ya perteneces a ese espacio.");
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

  const compartirInvitacion = async () => {
    setMensajeError("");
    const url = `${window.location.origin}?hogar=${hogarActivo.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Únete a ${hogarActivo.nombre}`,
          text: `Únete a mi espacio en My Item Tracker`,
          url,
        });
      } catch (e) {
        // el usuario cerró el cuadro de compartir sin enviar nada
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      } catch (e) {
        setMensajeError("No se pudo copiar el link.");
      }
    }
  };

  const volverAlMenu = () => {
    setHogarActivo(null);
    setZonaActiva(null);
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
      setMensajeError("No se pudo eliminar el espacio. Intenta de nuevo.");
      return;
    }

    setHogarActivo(null);
    await cargarMisHogares(user.id);
  };

  const salirDeCasa = async () => {
    const confirmar = window.confirm(
      `¿Seguro que quieres salir de "${hogarActivo.nombre}"? Ya no verás su inventario, a menos que te vuelvan a invitar.`
    );
    if (!confirmar) return;

    const { error } = await supabase
      .from("miembros_hogar")
      .delete()
      .eq("hogar_id", hogarActivo.id)
      .eq("user_id", user.id);

    if (error) {
      setMensajeError("No se pudo salir del espacio. Intenta de nuevo.");
      return;
    }

    setHogarActivo(null);
    await cargarMisHogares(user.id);
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

  const manejarCambioFecha = (valorIngresado) => {
    const soloDigitos = valorIngresado.replace(/\D/g, "").slice(0, 6);
    let formateado = soloDigitos;
    if (soloDigitos.length > 2) {
      formateado = `${soloDigitos.slice(0, 2)}/${soloDigitos.slice(2)}`;
    }
    setFechaCaducidad(formateado);
  };

  const cargarProductos = async (zonaId) => {
    const { data } = await supabase
      .from("productos")
      .select("id, nombre, cantidad, unidad, fecha_caducidad, cantidad_ideal")
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
      fecha_caducidad: fechaCaducidad.length === 7 ? fechaCaducidad : null,
      cantidad_ideal: cantidadIdeal.trim() ? Number(cantidadIdeal) : null,
    });

    if (error) {
      setMensajeError("No se pudo añadir el producto.");
      return;
    }

    setNombreProducto("");
    setFechaCaducidad("");
    setCantidadIdeal("");
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
    return (
      <main className="app-shell">
        <p className="muted">Cargando...</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <div className="brand">
        <span className="brand-mark">MIT</span>
        <h1>My Item Tracker</h1>
      </div>

      {/* No ha iniciado sesión */}
      {!user && (
        <div className="stack stack-md">
          <p className="muted">
            Lleva el inventario de tus cosas por espacios y zonas, y compártelo con quien quieras.
          </p>
          <button className="btn btn-primary" onClick={loginConGoogle}>
            Iniciar sesión con Google
          </button>
        </div>
      )}

      {/* Ya inició sesión pero no ha elegido un nombre para mostrar */}
      {user && perfil === null && (
        <div className="stack stack-sm">
          <p>¿Cómo quieres que te llamemos dentro de la app?</p>
          <input
            type="text"
            placeholder="Tu nombre"
            value={nombrePreferido}
            onChange={(e) => setNombrePreferido(e.target.value)}
          />
          <button className="btn btn-primary" onClick={guardarPerfil}>
            Guardar
          </button>
          {mensajeError && <p className="error-text">{mensajeError}</p>}
        </div>
      )}

      {/* Menú principal: elegir espacio, crear uno nuevo, o unirse a otro */}
      {user && perfil !== null && !hogarActivo && (
        <div className="stack stack-lg">
          <p className="welcome-line">Hola {perfil}, ¿a qué espacio quieres entrar?</p>

          {misHogares.length > 0 && (
            <div className="stack stack-sm">
              {misHogares.map((h) => (
                <button
                  key={h.id}
                  className="tag-name-btn"
                  onClick={() => {
                    setZonaActiva(null);
                    setHogarActivo(h);
                  }}
                >
                  {h.nombre} <span className="muted">({h.rol})</span>
                </button>
              ))}
            </div>
          )}

          <div className="stack stack-sm">
            <h3 className="section-title">Añadir un espacio</h3>
            <input
              type="text"
              placeholder="Nombre del espacio"
              value={nombreHogar}
              onChange={(e) => setNombreHogar(e.target.value)}
            />
            <button className="btn btn-primary" onClick={crearHogar}>
              Añadir espacio
            </button>
          </div>

          <div className="stack stack-sm">
            <h3 className="section-title">Unirme a un espacio existente</h3>
            <input
              type="text"
              placeholder="Código de invitación"
              value={codigoInvitacion}
              onChange={(e) => setCodigoInvitacion(e.target.value)}
            />
            <button className="btn" onClick={unirseAHogar}>
              Unirme
            </button>
          </div>

          {mensajeError && <p className="error-text">{mensajeError}</p>}

          <button className="btn" onClick={cerrarSesion}>
            Cerrar sesión
          </button>

          <button className="theme-toggle" onClick={alternarTema}>
            {tema === "light" ? "🌙 Modo oscuro" : "☀️ Modo claro"}
          </button>
        </div>
      )}

      {/* Dentro de un espacio específico, viendo sus zonas */}
      {user && hogarActivo && !zonaActiva && (
        <div className="stack stack-lg">
          <p className="welcome-line">
            Bienvenido a <strong>{hogarActivo.nombre}</strong>{" "}
            <span className="muted">(rol: {hogarActivo.rol})</span>
          </p>

          <button className="btn" onClick={volverAlMenu}>
            ← Cambiar de espacio
          </button>

          <div className="stack stack-sm">
            <button className="btn" onClick={() => setMostrarInvitacion(!mostrarInvitacion)}>
              {mostrarInvitacion ? "Ocultar invitación" : "Compartir invitación"}
            </button>

            {mostrarInvitacion && (
              <div className="center-col">
                <p className="muted">Código de invitación:</p>
                <code className="code-chip">{hogarActivo.id}</code>
                <button className="btn" onClick={copiarCodigo}>
                  {copiado ? "¡Copiado!" : "Copiar código"}
                </button>

                <div className="qr-frame">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                      `${typeof window !== "undefined" ? window.location.origin : ""}?hogar=${hogarActivo.id}`
                    )}`}
                    alt="Código QR de invitación"
                    width={200}
                    height={200}
                  />
                </div>
                <button className="btn btn-primary" onClick={compartirInvitacion}>
                  {copiado ? "¡Enlace copiado!" : "Enviar invitación"}
                </button>
              </div>
            )}
          </div>

          <div className="stack stack-sm">
            <h3 className="section-title">Zonas</h3>
            {zonas.length === 0 && <p className="muted">Aún no hay zonas.</p>}
            {zonas.map((z) => (
              <div key={z.id} className="list-row">
                <button className="tag-name-btn" onClick={() => setZonaActiva(z)}>
                  {z.nombre}
                </button>
                <button className="btn btn-danger btn-icon" onClick={() => eliminarZona(z)}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="stack stack-sm">
            <input
              type="text"
              placeholder="Nombre de la zona"
              value={nombreZona}
              onChange={(e) => setNombreZona(e.target.value)}
            />
            <button className="btn btn-primary" onClick={crearZona}>
              Añadir zona
            </button>
          </div>

          {mensajeError && <p className="error-text">{mensajeError}</p>}

          <hr className="divider" />

          {hogarActivo.rol === "dueño" ? (
            <button className="btn btn-danger" onClick={eliminarHogar}>
              Eliminar este espacio
            </button>
          ) : (
            <button className="btn btn-danger" onClick={salirDeCasa}>
              Salir de este espacio
            </button>
          )}

          <button className="btn" onClick={cerrarSesion}>
            Cerrar sesión
          </button>
        </div>
      )}

      {/* Dentro de una zona específica, viendo sus productos */}
      {user && zonaActiva && (
        <div className="stack stack-md">
          <p className="welcome-line">
            <strong>{zonaActiva.nombre}</strong>{" "}
            <span className="muted">— {hogarActivo.nombre}</span>
          </p>

          <button className="btn" onClick={volverAHogar}>
            ← Volver a {hogarActivo.nombre}
          </button>

          <div className="stack stack-sm">
            {productos.length === 0 && <p className="muted">Aún no hay productos aquí.</p>}
            {productos.map((p) => (
              <div key={p.id} className="product-row">
                <span>
                  <span className="product-name">{p.nombre}</span>
                  {p.fecha_caducidad && (
                    <span className="product-expiry">Vence: {p.fecha_caducidad}</span>
                  )}
                </span>
                <div className="qty-control">
                  <button className="qty-btn" onClick={() => cambiarCantidad(p, -1)}>
                    -
                  </button>
                  <span className={`qty-value ${p.cantidad_ideal && p.cantidad < p.cantidad_ideal ? "qty-low" : ""}`}>
                    {p.cantidad}
                    {p.cantidad_ideal ? `/${p.cantidad_ideal}` : ""}
                  </span>
                  <button className="qty-btn qty-plus" onClick={() => cambiarCantidad(p, 1)}>
                    +
                  </button>
                  <button className="btn btn-danger btn-icon" onClick={() => eliminarProducto(p)}>
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="stack stack-sm">
            <input
              type="text"
              placeholder="Nombre del producto"
              value={nombreProducto}
              onChange={(e) => setNombreProducto(e.target.value)}
            />
            <input
              type="text"
              inputMode="numeric"
              placeholder="Caducidad MM/AAAA (opcional)"
              value={fechaCaducidad}
              maxLength={7}
              onChange={(e) => manejarCambioFecha(e.target.value)}
            />
            <input
              type="number"
              min="0"
              placeholder="Cantidad ideal a tener (opcional)"
              value={cantidadIdeal}
              onChange={(e) => setCantidadIdeal(e.target.value)}
            />
            <button className="btn btn-primary" onClick={agregarProducto}>
              Añadir producto
            </button>
          </div>

          {mensajeError && <p className="error-text">{mensajeError}</p>}
        </div>
      )}
    </main>
  );
}
