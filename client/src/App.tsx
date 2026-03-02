import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import AdminIngest from './pages/AdminIngest';
import AdminSeedTopics from './pages/AdminSeedTopics';
import CreateTopic from './pages/CreateTopic';
import Timeline from './pages/Timeline';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import MyTopics from './pages/MyTopics';

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/timeline/:topicId" component={Timeline} />
      <Route path="/auth/login" component={LoginPage} />
      <Route path="/auth/register" component={RegisterPage} />
      <Route path={"/admin/ingest"} component={AdminIngest} />
      <Route path={"/admin/seed-topics"} component={AdminSeedTopics} />
      <Route path={"/create-topic"} component={CreateTopic} />
      <Route path="/my-topics" component={MyTopics} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
