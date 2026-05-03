import { Toaster as Sonner } from "@/components/ui/sonner";
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
import NotFound from "./pages/NotFound";
import { useCartSync } from "./hooks/useCartSync";

const Layout = () => {
  useCartSync();
  return (
    <>
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
