import "./App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ExercisePage } from "./components/ExercisePage";
import { LandingPage } from "./components/LandingPage";
import { SignInPage } from "./components/auth/SignInPage";
import { SignUpPage } from "./components/auth/SignUpPage";
import { ToastProvider } from "./components/ToastProvider";

const App = () => {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/exercise" element={<ExercisePage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
};

export default App;
