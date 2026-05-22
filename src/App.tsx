import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import Login from "./pages/Login";
import Company from "./pages/Company";
import Project from "./pages/Project";
import CategoryItems from "./pages/CategoryItems";
import Vendor from "./pages/Vendor";
import AccessControl from "./pages/AccessControl";
import ProtectedRoute from "./components/ProtectedRoute";
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

const ACCESS_CONTROL_USER_PERMISSIONS = [
  "view_user",
  "add_user",
  "create_user",
  "update_user",
  "edit_user",
  "delete_user",
  "change_password_user",
];

const ACCESS_CONTROL_ROLE_PERMISSIONS = [
  "view_role",
  "create_role",
  "get_assign_role",
  "update_assign_role",
  "delete_assign_role",
];

const ACCESS_CONTROL_PERMISSION_PERMISSIONS = [
  "view_permission",
  "create_permission",
  "update_permission",
  "delete_permission",
];

const COMPANY_PERMISSIONS = ["view_company", "create_company", "update_company", "delete_company"];
const PROJECT_PERMISSIONS = ["view_project", "create_project", "update_project", "delete_project"];
const CATEGORY_PERMISSIONS = ["view_category"];
const ITEM_PERMISSIONS = ["view_items"];
const UNIT_PERMISSIONS = ["view_unit"];
const VENDOR_PERMISSIONS = ["view_vendor"];
const TEST_STEP_PERMISSIONS = ["view_teststep"];
const TEST_STAGE_PERMISSIONS = ["view_teststage"];
const PO_PERMISSIONS = ["view_po"];
const ASSIGN_INSPECTOR_PERMISSIONS = ["assigninspection_po"];
const INSPECTION_PERMISSIONS = ["view_inspection"];
const REPORT_PERMISSIONS = ["view_report"];

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/Inspection/*" element={<LegacyInspectionRedirect />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<AppLayout />}>
              <Route index element={<EnterpriseDashboard />} />
              <Route path="dashboard" element={<EnterpriseDashboard />} />

              <Route element={<ProtectedRoute permissions={ACCESS_CONTROL_USER_PERMISSIONS} />}>
                <Route path="user" element={<AccessControl />} />
              </Route>

              <Route element={<ProtectedRoute permissions={COMPANY_PERMISSIONS} />}>
                <Route path="company" element={<Company />} />
              </Route>

              <Route element={<ProtectedRoute permissions={ACCESS_CONTROL_ROLE_PERMISSIONS} />}>
                <Route path="role" element={<AccessControl />} />
                <Route path="role/edit-role" element={<AccessControl />} />
              </Route>

              <Route element={<ProtectedRoute permissions={CATEGORY_PERMISSIONS} />}>
                <Route path="categories" element={<CategoryItems />} />
              </Route>

              <Route element={<ProtectedRoute permissions={ITEM_PERMISSIONS} />}>
                <Route path="items" element={<CategoryItems />} />
              </Route>

              <Route element={<ProtectedRoute permissions={ACCESS_CONTROL_PERMISSION_PERMISSIONS} />}>
                <Route path="permission" element={<AccessControl />} />
              </Route>

              <Route element={<ProtectedRoute permissions={UNIT_PERMISSIONS} />}>
                <Route path="units" element={<Unit />} />
              </Route>

              <Route element={<ProtectedRoute permissions={VENDOR_PERMISSIONS} />}>
                <Route path="vendor" element={<Vendor />} />
              </Route>

              <Route element={<ProtectedRoute permissions={TEST_STEP_PERMISSIONS} />}>
                <Route path="test-step" element={<Test />} />
              </Route>

              <Route element={<ProtectedRoute permissions={TEST_STAGE_PERMISSIONS} />}>
                <Route path="test-stage" element={<Stage />} />
              </Route>

              <Route element={<ProtectedRoute permissions={ASSIGN_INSPECTOR_PERMISSIONS} />}>
                <Route path="assign_inspector" element={<PoAssign />} />
              </Route>

              <Route element={<ProtectedRoute permissions={PO_PERMISSIONS} />}>
                <Route path="po" element={<Po />} />
                <Route path="po-view/:id" element={<PoView />} />
              </Route>

              <Route element={<ProtectedRoute permissions={PROJECT_PERMISSIONS} />}>
                <Route path="project" element={<Project />} />
              </Route>

              <Route element={<ProtectedRoute permissions={INSPECTION_PERMISSIONS} />}>
                <Route path="current-inspection" element={<CurrentInspection />} />
                <Route path="current-inspection/admin/inspections/:id" element={<InspectionDetail />} />
              </Route>

              <Route element={<ProtectedRoute permissions={REPORT_PERMISSIONS} />}>
                <Route path="reports" element={<Reports />} />
              </Route>

              <Route path="*" element={<div>404 Not Found</div>} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
