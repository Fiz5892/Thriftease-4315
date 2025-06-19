import type { MetaFunction, LoaderFunction } from "@remix-run/node";
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import styles from "./tailwind.css?url";
import customStyles from "./app.css?url";

export const meta: MetaFunction = () => {
  return [
    { title: "ThriftEase" },
    { name: "description", content: "Platform UMKM Thrift Fashion" },
  ];
};

export function links() {
  return [
  { rel: "stylesheet", href: styles },
  { rel: "stylesheet", href: customStyles },
  { rel: "stylesheet", href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css" },
]}

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}