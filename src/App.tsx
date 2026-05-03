import { Toaster as Sonner } from "@/components/ui/sonner";
import { useEffect } from "react";
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
import NotFound from "./pages/NotFound";
import { useCartSync } from "./hooks/useCartSync";

const Layout = () => {
  useCartSync();

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal-on-scroll').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div className="cinematic-grain" aria-hidden="true" />
      <ScrollRestoration />
      <Outlet />
    </>
  );
};

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Index /> },
      { path: "/product/:handle", element: <Product /> },
      { path: "/success", element: <Success /> },
      { path: "/b/:slug", element: <Bridge /> },
      { path: "/admin", element: <Admin /> },
      { path: "/login", element: <Login /> },
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
