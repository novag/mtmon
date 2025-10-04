import { ThemeProvider } from "./components/theme-provider";
import { RouterProvider } from "react-router-dom";
import createRouter from "./router";
import { StateProvider } from "./providers/StateProvider";

function App() {
  const router = createRouter();

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <StateProvider>
        <RouterProvider router={router} />
      </StateProvider>
    </ThemeProvider>
  );
}

export default App;
