import { createRoot } from "react-dom/client";
import { RecoilRoot } from "recoil";
import { RouterProvider } from "react-router-dom";
import { router } from "./pages/Root";

const domNode = document.getElementById("root");
const root = createRoot(domNode);
root.render(
  <RecoilRoot>
    <RouterProvider router={router} />
  </RecoilRoot>
);
