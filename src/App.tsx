import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import Login from "./pages/Login";
import Company from "./pages/Company";
import Project from "./pages/Project";
import CategoryItems from "./pages/CategoryItems";
import Vendor from "./pages/Vendor";
import AccessControl from "./pages/AccessControl";
import { AuthProvider } from "./context/AuthContext";
import Test from "./pages/Test";
import Stage from "./pages/Stages";
import Po from "./pages/Po";
import PoView from "./pages/PoView";
import Unit from "./pages/Unit";
import PoAssign from "./pages/PoAssign";
import EnterpriseDashboard from "./pages/EnterpriseDashboard";
import CurrentInspection from "./pages/CurrentInspection";
import InspectionDetail from "./pages/InspectionDetail";
import Reports from "./pages/Reports";

function LegacyInspectionRedirect() {
  const location = useLocation();
  const strippedPath = location.pathname.replace(/^\/Inspection/, "") || "/";
  const normalizedPath =
    strippedPath === "/" ? strippedPath : strippedPath.replace(/\/+$/, "") || "/";

  return <Navigate to={`${normalizedPath}${location.search}${location.hash}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/Inspection/*" element={<LegacyInspectionRedirect />} />

          {/* Authentication gate temporarily disabled so the app can open without credentials. */}
          <Route path="/" element={<AppLayout />}>
            <Route path="user" element={<AccessControl />} />
            <Route path="company" element={<Company />} />
            <Route path="role" element={<AccessControl />} />
            <Route path="role/edit-role" element={<AccessControl />} />
            <Route path="categories" element={<CategoryItems />} />
            <Route path="items" element={<CategoryItems />} />
            <Route path="permission" element={<AccessControl />} />
            <Route path="units" element={<Unit />} />
            <Route path="vendor" element={<Vendor />} />
            <Route path="test-step" element={<Test />} />
            <Route path="test-stage" element={<Stage />} />
            <Route path="assign_inspector" element={<PoAssign />} />
            <Route path="po" element={<Po />} />
            <Route path="po-view/:id" element={<PoView />} />
            <Route path="project" element={<Project />} />
            <Route index element={<EnterpriseDashboard />} />
            <Route path="dashboard" element={<EnterpriseDashboard />} />
            <Route path="current-inspection" element={<CurrentInspection />} />
            <Route path="current-inspection/admin/inspections/:id" element={<InspectionDetail />} />
            <Route path="reports" element={<Reports />} />
            <Route path="*" element={<div>404 Not Found</div>} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
