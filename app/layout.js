export const metadata = {
  title: "My Item Tracker",
  description: "Gestión del inventario de tu cocina por zonas",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
