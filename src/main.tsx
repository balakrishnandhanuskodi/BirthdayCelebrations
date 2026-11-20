import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// No StrictMode: it would connect to the video room twice in development.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
