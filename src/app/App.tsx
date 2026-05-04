import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuthProvider } from "./providers/AuthContext";
import { StreamProvider } from "./providers/StreamContext";

export default function App() {
  return (
    <AuthProvider>
      <StreamProvider>
        <RouterProvider router={router} />
      </StreamProvider>
    </AuthProvider>
  );
}

