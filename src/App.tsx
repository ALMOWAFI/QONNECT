import { Toaster as Sonner } from "@/components/ui/sonner";
import { useEffect, useState } from "react";
import {
  RouterProvider,
  createBrowserRouter,
  ScrollRestoration,
  Outlet,
} from "react-router-dom";
import Index from "./pages/Index";
import Product from "./pages/Product";
import Success from "./pages/Success";
import Bridge from "./pages/Bridge";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import Members from "./pages/Members";
import Claim from "./pages/Claim";
import NotFound from "./pages/NotFound";
import { useCartSync } from "./hooks/useCartSync";

const Layout = () => {
  useCartSync();

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('active');
      });
    }, { threshold: 0.1 });

    // Observe elements already in the DOM
    const observe = (root: Element | Document = document) =>
      root.querySelectorAll('.reveal-on-scroll:not(.active)').forEach(el => io.observe(el));
    observe();

    // Watch for elements added later (e.g. product cards after async load)
    const mo = new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(node => {
        if (!(node instanceof Element)) return;
        if (node.classList.contains('reveal-on-scroll')) io.observe(node);
        observe(node);
      }));
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => { io.disconnect(); mo.disconnect(); };
  }, []);

  return (
    <>
      <div className="cinematic-grain" aria-hidden="true" />
      <ScrollRestoration />
      <Outlet />
    </>
  );
};

// Lightweight guard — ensures a password is stored before rendering the admin page.
// The Admin page itself handles 401s (re-prompt on bad password).
// Real security is the server-side password check on every API call.
const AdminGuard = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const pw = sessionStorage.getItem('qonnect-admin-pw');
    if (pw) { setReady(true); return; }

    const input = prompt('Access Restricted. Enter Command Center Password:');
    if (input) {
      sessionStorage.setItem('qonnect-admin-pw', input);
      setReady(true);
    }
    // If they dismiss the prompt, stay on blank page — nothing leaks
  }, []);

  if (!ready) return null;
  return <Admin />;
};

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Index /> },
      { path: "/product/:handle", element: <Product /> },
      { path: "/success", element: <Success /> },
      { path: "/b/:slug", element: <Bridge /> },
      { path: "/claim", element: <Claim /> },
      { path: "/admin", element: <AdminGuard /> },
      { path: "/login", element: <Login /> },
      { path: "/members", element: <Members /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const App = () => (
  <>
    <Sonner position="top-center" />
    <RouterProvider router={router} />
  </>
);

export default App;
