// src/App.jsx
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useJsApiLoader } from '@react-google-maps/api';

// --- 核心組件導入 ---
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { Role } from './constants/roles'; // *** 確保這個文件存在且導出了 Role ***

// --- 頁面組件導入 ---
import HomePage from './pages/HomePage';
import ShopListPage from './pages/ShopListPage';
import ShopDetailPage from './pages/ShopDetailPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ShopOwnerSignupPage from './pages/ShopOwnerSignupPage';
import AddShopPage from './pages/AddShopPage';
import EditShopPage from './pages/EditShopPage';
import TopShopsPage from './pages/TopShopsPage';
import MyOwnedShopPage from './pages/MyOwnedShopPage';
import AdminUserManagementPage from './pages/AdminUserManagementPage';
import NotFoundPage from './pages/NotFoundPage';

// --- 全局樣式 ---
import './App.css';
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
// --- ---

// --- Google Maps API Key 和 Libraries ---
const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const libraries = ['places', 'maps'];
// --- ---

function App() {
  const { isLoaded: mapLoaded, loadError: mapLoadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey || "",
    libraries: libraries,
  });

   if (!googleMapsApiKey && !mapLoadError) {
       console.error("前端警告：未設定 Google Maps API 金鑰 (VITE_GOOGLE_MAPS_API_KEY)。地圖功能將無法使用。");
   }

  return (
    <AuthProvider>
        <Navbar />
        <div className="main-content">
          <Routes> {/* <--- Routes 開始 */}

            {/* --- 公開路由 --- */}
            <Route path="/" element={<HomePage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />} />
            <Route path="/shops" element={<ShopListPage />} />
            <Route path="/shops/:id" element={<ShopDetailPage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />} />
            {/* TopShopsPage 移至保護路由 */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/signup-shop" element={<ShopOwnerSignupPage />} />

            {/* --- 受保護路由 --- */}

            <Route
               path="/top-shops"
               element={
                 <ProtectedRoute allowedRoles={[Role.ROLE_USER, Role.ROLE_ADMIN]}>
                   <TopShopsPage />
                 </ProtectedRoute>
               }
             />

            <Route
              path="/add-shop"
              element={
                <ProtectedRoute allowedRoles={[Role.ROLE_ADMIN]}>
                  <AddShopPage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />
                </ProtectedRoute>
              }
            />

            <Route
              path="/shops/:id/edit"
              element={
                <ProtectedRoute allowedRoles={[Role.ROLE_ADMIN, Role.ROLE_SHOP_OWNER]}>
                  <EditShopPage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />
                </ProtectedRoute>
              }
            />

             <Route
               path="/my-shop"
               element={
                 <ProtectedRoute allowedRoles={[Role.ROLE_SHOP_OWNER]}>
                   <MyOwnedShopPage mapLoaded={mapLoaded} mapLoadError={mapLoadError} />
                 </ProtectedRoute>
               }
             />

             <Route
               path="/admin/users"
               element={
                 <ProtectedRoute allowedRoles={[Role.ROLE_ADMIN]}>
                   <AdminUserManagementPage />
                 </ProtectedRoute>
               }
             />

            {/* --- 404 Not Found 路由 --- */}
            <Route path="*" element={<NotFoundPage />} />

          </Routes> {/* <--- Routes 結束 */}
        </div>
    </AuthProvider>
  );
}

export default App; 