import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Redeem from "./pages/Redeem";
import StaffLogin from "./pages/StaffLogin";
import DrawDisplay from "./pages/DrawDisplay";

function Router() {
  return <Switch>
    {/* Peserta langsung masuk ke form registrasi (tanpa landing page) */}
    <Route path="/">{() => <Redirect to="/registrasi" />}</Route>
    <Route path="/registrasi" component={Home} />
    <Route path="/login-dashboard" component={StaffLogin} />
    <Route path="/dashboard" component={Dashboard} />
    <Route path="/layar-undian" component={DrawDisplay} />
    <Route path="/redeem" component={Redeem} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}

export default App;
